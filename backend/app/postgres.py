"""PostgreSQL connection used by cloud deployments."""
import re
from contextlib import contextmanager


def indexed_row(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []

    class Row(dict):
        def __getitem__(self, key):
            return super().__getitem__(names[key] if isinstance(key, int) else key)

    return lambda values: Row(zip(names, values))


class PostgresConnection:
    def __init__(self, db):
        self.db = db

    def execute(self, sql, params=()):
        if sql == 'BEGIN IMMEDIATE':
            # Preserve the existing serialized write transactions in the cloud.
            return self.db.execute('SELECT pg_advisory_xact_lock(224651)')
        sql = sql.replace("strftime('%Y-%m-%dT%H:%M:%fZ','now')",
                          """to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')""")
        sql = sql.replace('max(0,e.capacity-coalesce(u.used,0))', 'greatest(0,e.capacity-coalesce(u.used,0))')
        sql = sql.replace("json_group_array(json_object('code', d.code, 'model', d.model, 'status', d.status))",
                          "coalesce(json_agg(json_build_object('code', d.code, 'model', d.model, 'status', d.status))::text, '[]')")
        sql = sql.replace('INSERT OR IGNORE INTO', 'INSERT INTO') + (' ON CONFLICT DO NOTHING' if 'INSERT OR IGNORE INTO' in sql else '')
        target = re.match(r'\s*INSERT INTO (\w+)', sql, re.I)
        if target and target[1].lower() in {
            'clients', 'devices', 'products', 'orders', 'users', 'centers', 'network_edges',
            'flow_runs', 'collections', 'batches', 'transfers', 'assemblies',
        }:
            return InsertResult(self.db.execute(sql.replace('?', '%s') + ' RETURNING id', params))
        return self.db.execute(sql.replace('?', '%s'), params)


class InsertResult:
    def __init__(self, cursor):
        self.rowcount = cursor.rowcount
        row = cursor.fetchone()
        self.lastrowid = row['id'] if row else None


@contextmanager
def postgres_connection(dsn):
    import psycopg

    with psycopg.connect(dsn, row_factory=indexed_row, connect_timeout=10) as db:
        yield PostgresConnection(db)
