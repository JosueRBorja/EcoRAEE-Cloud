#!/bin/bash
set -euo pipefail
dnf install -y python3.12 unzip
id ecoraee >/dev/null 2>&1 || useradd --system --home-dir /opt/ecoraee ecoraee
install -d -o ecoraee -g ecoraee /opt/ecoraee
aws s3 cp "s3://__ARTIFACT_BUCKET__/__ARTIFACT_KEY__" /tmp/ecoraee-backend.zip --region "__REGION__"
unzip -oq /tmp/ecoraee-backend.zip -d /opt/ecoraee
cd /opt/ecoraee
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements-aws.txt
curl -fsS https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/ecoraee/rds-ca.pem
install -m 0600 /dev/null /etc/ecoraee.env
export AWS_REGION="__REGION__" DB_HOST="__DB_HOST__" DB_SECRET="__DB_SECRET__" DEMO_SECRET="__DEMO_SECRET__"
export EVIDENCE_BUCKET="__EVIDENCE_BUCKET__"
.venv/bin/python - <<'PY'
import hashlib
import hmac
import json
import os
import shlex
import time
from pathlib import Path

import boto3
import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo

secret_client = boto3.client('secretsmanager', region_name=os.environ['AWS_REGION'])
master = json.loads(secret_client.get_secret_value(SecretId=os.environ['DB_SECRET'])['SecretString'])
key = json.loads(secret_client.get_secret_value(SecretId=os.environ['DEMO_SECRET'])['SecretString'])['password']
demo = {role: hmac.new(key.encode(), role.encode(), hashlib.sha256).hexdigest()[:32]
        for role in ('admin', 'sales', 'technician', 'inventory', 'finance', 'client', 'db_password')}
options = dict(host=os.environ['DB_HOST'], sslmode='verify-full',
               sslrootcert='/opt/ecoraee/rds-ca.pem', connect_timeout=5)
for attempt in range(30):
    try:
        admin = psycopg.connect(**options, dbname='postgres', user=master['username'],
                                password=master['password'], autocommit=True)
        break
    except psycopg.OperationalError:
        if attempt == 29:
            raise
        time.sleep(5)
with admin:
    if not admin.execute("SELECT 1 FROM pg_roles WHERE rolname='ecoraee_app'").fetchone():
        admin.execute(sql.SQL('CREATE ROLE ecoraee_app LOGIN PASSWORD {}').format(sql.Literal(demo['db_password'])))
    if not admin.execute("SELECT 1 FROM pg_database WHERE datname='ecoraee'").fetchone():
        admin.execute('GRANT ecoraee_app TO CURRENT_USER')
        admin.execute('CREATE DATABASE ecoraee OWNER ecoraee_app')
        admin.execute('REVOKE ecoraee_app FROM CURRENT_USER')

env = {
    'ECORAEE_POSTGRES_DSN': make_conninfo(**options, dbname='ecoraee', user='ecoraee_app',
                                         password=demo['db_password']),
    'ECORAEE_EVIDENCE_BUCKET': os.environ['EVIDENCE_BUCKET'],
    'ECORAEE_SECURE_COOKIES': '1',
    'ECORAEE_CLOUDFRONT_ORIGIN': '1',
    'AWS_DEFAULT_REGION': os.environ['AWS_REGION'],
}
Path('/etc/ecoraee.env').write_text(''.join(f'{key}={shlex.quote(value)}\n' for key, value in env.items()))
Path('/etc/ecoraee-bootstrap.env').write_text(
    ''.join(f'export ECORAEE_DEMO_{role.upper()}_PASSWORD={shlex.quote(password)}\n'
            for role, password in demo.items() if role in {'admin', 'sales', 'technician', 'inventory', 'finance', 'client'}))
PY
chmod 600 /etc/ecoraee-bootstrap.env
set -a
source /etc/ecoraee.env
source /etc/ecoraee-bootstrap.env
set +a
.venv/bin/python -m backend.app.bootstrap_postgres
cat > /etc/systemd/system/ecoraee.service <<'UNIT'
[Unit]
Description=EcoRAEE API
After=network-online.target

[Service]
User=ecoraee
WorkingDirectory=/opt/ecoraee
EnvironmentFile=/etc/ecoraee.env
ExecStart=/opt/ecoraee/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
chown -R ecoraee:ecoraee /opt/ecoraee/backend
systemctl daemon-reload
systemctl enable --now ecoraee
