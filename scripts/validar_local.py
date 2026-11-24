"""Latencia reproducible en ASGI local; no equivale a carga HTTP ni a disponibilidad AWS."""
import json
import os
import platform
import statistics
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


def main():
    with tempfile.TemporaryDirectory() as folder:
        root = Path(folder)
        for key, suffix in [('ECORAEE_DB','test.db'),('ECORAEE_UPLOADS','uploads'),('ECORAEE_MEDIA','media')]:
            os.environ[key] = str(root/suffix)
        from fastapi.testclient import TestClient
        from backend.app.principal import app
        results = {}
        with TestClient(app) as client:
            login = client.post('/api/auth/login',json={'email':'admin@ecoraee.local','password':'Demo12345!'})
            if login.status_code != 200: raise RuntimeError(login.text)
            for endpoint in ('/api/catalog','/api/network','/api/circular-metrics'):
                client.get(endpoint)
                timings, errors = [], 0
                for _ in range(100):
                    start = time.perf_counter()
                    response = client.get(endpoint)
                    timings.append((time.perf_counter()-start)*1000)
                    errors += response.status_code != 200
                results[endpoint] = {'requests':100,'median_ms':round(statistics.median(timings),3),'p95_ms':round(sorted(timings)[94],3),'error_rate':errors/100,'target_p95_ms':250,'target_met': sorted(timings)[94] <= 250 and errors == 0}
        output = Path(__file__).resolve().parents[1]/'evidence/local-performance.json'
        output.parent.mkdir(exist_ok=True)
        output.write_text(json.dumps({'timestamp_utc':datetime.now(timezone.utc).isoformat(),'python':platform.python_version(),'conditions':'TestClient ASGI, secuencial, calentamiento previo, SQLite temporal, datos sintéticos. No mide red ni AWS.','results':results},indent=2),encoding='utf-8')
        print(output)


if __name__ == '__main__': main()
