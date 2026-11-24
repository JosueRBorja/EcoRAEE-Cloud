"""Conexión local y creación del esquema. Cada operación usa su transacción."""
import os
import sqlite3
from contextlib import contextmanager, closing
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get('ECORAEE_DB', str(BASE / 'data' / 'ecoraee.db')))


@contextmanager
def connection():
    if dsn := os.getenv('ECORAEE_POSTGRES_DSN'):
        from .postgres import postgres_connection
        with postgres_connection(dsn) as db:
            yield db
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize():
    # Copia consistente antes de aplicar AWStore a una instalación existente.
    if DB_PATH.exists():
        with closing(sqlite3.connect(DB_PATH)) as source:
            migrated = source.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").fetchone()
            if not migrated:
                backup = DB_PATH.with_name(DB_PATH.stem + '.before-awstore.db')
                if not backup.exists():
                    with closing(sqlite3.connect(backup)) as target:
                        source.backup(target)
    schema = BASE.parent / 'database' / 'esquema.sql'
    with connection() as db:
        db.executescript(schema.read_text(encoding='utf-8'))
        db.executescript((BASE.parent / 'database' / 'negocio.sql').read_text(encoding='utf-8'))
        # Migración aditiva para instalaciones que ya tienen información.
        additions = {
            'users': [('active', 'INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))'), ('photo_filename', 'TEXT')],
            'products': [('photo_filename', 'TEXT')],
            'devices': [('photo_filename', 'TEXT'), ('center_id', 'INTEGER REFERENCES centers(id)'), ('batch_id', 'INTEGER REFERENCES batches(id)'), ('active_transfer_id', 'INTEGER REFERENCES transfers(id)')],
            'components': [('destination_type', 'TEXT')],
            'orders': [('delivery_mode', "TEXT NOT NULL DEFAULT 'RETIRO'"),
                       ('delivery_address', "TEXT NOT NULL DEFAULT ''"),
                       ('contact_phone', "TEXT NOT NULL DEFAULT ''"),
                       ('delivered_at', 'TEXT'), ('delivered_by', 'INTEGER REFERENCES users(id)')],
        }
        for table, columns in additions.items():
            existing = {row['name'] for row in db.execute(f'PRAGMA table_info({table})')}
            for name, definition in columns:
                if name not in existing:
                    db.execute(f'ALTER TABLE {table} ADD COLUMN {name} {definition}')
        from .migraciones import migrate
        migrate(db)
        # Los datos sintéticos se insertan una sola vez, incluso si se vacían tablas.
        if db.execute("SELECT value FROM settings WHERE key='seeded'").fetchone():
            return
        db.executemany('INSERT INTO clients (name, document, phone, address) VALUES (?, ?, ?, ?)', [
            ('Camila Andrade', 'DEMO-001', '0990000001', 'Quito · sector norte'),
            ('Mateo Cevallos', 'DEMO-002', '0990000002', 'Quito · sector centro'),
        ])
        samples = [
            ('RAEE-0001', 'Laptop para diagnóstico', 'Computadoras', 1, 'RECEPCIONADO', 'AWStore Quito', 'Equipo recibido por plan canje.'),
            ('RAEE-0002', 'Monitor para recuperación', 'Monitores', 2, 'EN_EVALUACION', 'Taller', 'Revisar fuente y pantalla.'),
        ]
        for code, model, category, client, state, location, notes in samples:
            cur = db.execute('INSERT INTO devices (code, model, category, client_id, status, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', (code, model, category, client, state, location, notes))
            db.execute('INSERT INTO events (device_id, action, detail, responsible) VALUES (?, ?, ?, ?)', (cur.lastrowid, 'Recepción', 'Equipo recibido en ' + location, 'Equipo de recepción'))
        db.execute('UPDATE devices SET center_id=(SELECT min(id) FROM centers) WHERE center_id IS NULL')
        db.execute("INSERT INTO settings VALUES ('seeded', '1')")
