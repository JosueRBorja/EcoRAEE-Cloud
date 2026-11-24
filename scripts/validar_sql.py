"""Mide una consulta de historial con/sin índice en una base sintética independiente."""
import json
import platform
import sqlite3
import statistics
import time
from pathlib import Path


def benchmark():
    db = sqlite3.connect(':memory:')
    db.execute('CREATE TABLE events(id INTEGER PRIMARY KEY,device_id INTEGER NOT NULL,action TEXT NOT NULL)')
    db.executemany('INSERT INTO events(device_id,action) VALUES (?,?)', [(i % 1000, 'Evento sintético') for i in range(50000)])
    sql = 'SELECT * FROM events WHERE device_id=? ORDER BY id'
    def measure():
        times = []
        for i in range(40):
            start = time.perf_counter(); db.execute(sql, (i,)).fetchall(); times.append((time.perf_counter()-start)*1000)
        return {'median_ms':round(statistics.median(times),4),'p95_ms':round(sorted(times)[37],4),'plan':[r[3] for r in db.execute('EXPLAIN QUERY PLAN '+sql,(1,))]}
    before = measure()
    db.execute('CREATE INDEX idx_events_device ON events(device_id,id)')
    after = measure(); db.close()
    return {'conditions':{'rows':50000,'queries_per_scenario':40,'storage':'SQLite en memoria; datos sintéticos','python':platform.python_version(),'sqlite':sqlite3.sqlite_version},'before':before,'after':after}


if __name__ == '__main__':
    output = Path(__file__).resolve().parents[1]/'evidence/sql-optimization.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(benchmark(),indent=2),encoding='utf-8')
    print(output)
