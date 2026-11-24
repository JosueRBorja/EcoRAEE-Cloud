"""Migraciones aditivas e idempotentes. Nunca renombra PK ni borra datos comerciales."""


def migrate(db):
    from pathlib import Path
    db.executescript((Path(__file__).resolve().parents[2] / 'database' / 'logistica.sql').read_text(encoding='utf-8'))
    db.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    db.execute('CREATE TABLE IF NOT EXISTS login_attempts (key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL CHECK(attempts>0), window_start INTEGER NOT NULL)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status, id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_evidence_device ON evidence(device_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id, id)')
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_nocase ON products(sku COLLATE NOCASE)')
    # CHECK nuevas operaciones, también para bases creadas antes de esta versión.
    db.executescript('''
    CREATE TRIGGER IF NOT EXISTS validate_product_insert BEFORE INSERT ON products
    WHEN typeof(NEW.price_cents)!='integer' OR typeof(NEW.stock)!='integer' OR length(trim(NEW.name))<3 OR length(trim(NEW.sku))<3
    BEGIN SELECT RAISE(ABORT, 'Producto inválido o importes no enteros'); END;
    CREATE TRIGGER IF NOT EXISTS validate_product_update BEFORE UPDATE ON products
    WHEN typeof(NEW.price_cents)!='integer' OR typeof(NEW.stock)!='integer' OR length(trim(NEW.name))<3 OR length(trim(NEW.sku))<3
    BEGIN SELECT RAISE(ABORT, 'Producto inválido o importes no enteros'); END;
    CREATE TRIGGER IF NOT EXISTS validate_device_transition BEFORE UPDATE OF status ON devices
    WHEN OLD.status != NEW.status AND NOT (
        (OLD.status='RECEPCIONADO' AND NEW.status='EN_EVALUACION') OR
        (OLD.status='EN_EVALUACION' AND NEW.status='CLASIFICADO') OR
        (OLD.status='CLASIFICADO' AND NEW.status='CERRADO'))
    BEGIN SELECT RAISE(ABORT, 'Transición de estado no permitida'); END;
    CREATE TRIGGER IF NOT EXISTS validate_device_close BEFORE UPDATE OF status ON devices
    WHEN NEW.status='CERRADO' AND (
        NOT EXISTS(SELECT 1 FROM components WHERE device_id=NEW.id) OR
        EXISTS(SELECT 1 FROM components WHERE device_id=NEW.id AND closed_at IS NULL) OR
        NOT EXISTS(SELECT 1 FROM evidence WHERE device_id=NEW.id))
    BEGIN SELECT RAISE(ABORT, 'Cierre sin destinos completos y evidencia'); END;
    CREATE TRIGGER IF NOT EXISTS immutable_closed_component BEFORE UPDATE ON components
    WHEN OLD.closed_at IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'Componente cerrado no modificable'); END;
    CREATE TRIGGER IF NOT EXISTS validate_component_destination BEFORE UPDATE OF destination, destination_type, closed_at ON components
    WHEN NEW.closed_at IS NOT NULL AND (
        NEW.destination IS NULL OR length(trim(NEW.destination)) < 3 OR
        NEW.destination_type IS NULL OR
        (NEW.classification='NO_RECUPERABLE' AND NEW.destination_type!='DISPOSICION') OR
        (NEW.classification='RECICLABLE' AND NEW.destination_type NOT IN ('RECICLAJE','DISPOSICION')) OR
        (NEW.classification='REPARABLE' AND NEW.destination_type NOT IN ('REPARACION','RECICLAJE','DISPOSICION')))
    BEGIN SELECT RAISE(ABORT, 'Destino incompatible o incompleto'); END;
    CREATE VIEW IF NOT EXISTS vw_raee_summary AS
        SELECT d.status, count(DISTINCT d.id) AS devices, count(c.id) AS components,
        sum(CASE WHEN c.closed_at IS NOT NULL THEN 1 ELSE 0 END) AS closed_components
        FROM devices d LEFT JOIN components c ON c.device_id=d.id GROUP BY d.status;
    CREATE VIEW IF NOT EXISTS vw_inventory_value AS
        SELECT category, sum(stock) AS units, sum(stock * price_cents) AS value_cents
        FROM products WHERE active=1 GROUP BY category;
    CREATE VIEW IF NOT EXISTS vw_device_classification AS
        SELECT d.id AS device_id,
        CASE WHEN count(c.id)=0 THEN 'PENDIENTE'
             WHEN sum(c.classification='REUTILIZABLE')=count(c.id) THEN 'REUTILIZABLE'
             WHEN sum(c.classification IN ('REUTILIZABLE','REPARABLE'))=count(c.id) THEN 'REPARABLE'
             WHEN sum(c.classification='NO_RECUPERABLE')=count(c.id) THEN 'NO_RECUPERABLE'
             ELSE 'RECICLABLE' END AS classification
        FROM devices d LEFT JOIN components c ON c.device_id=d.id GROUP BY d.id;
    ''')
    db.execute('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)')
    if not db.execute('SELECT 1 FROM schema_migrations WHERE version=3').fetchone():
        for name, kind, capacity in [('AWStore Quito', 'RECOLECCION', 100), ('Taller Técnico AWStore', 'TALLER', 60), ('Centro de Reciclaje Andino', 'RECICLAJE', 80), ('Centro Comunitario La Floresta', 'BENEFICIARIO', 100)]:
            db.execute('INSERT OR IGNORE INTO centers(name,kind,capacity) VALUES (?,?,?)', (name, kind, capacity))
        ids = {r['name']: r['id'] for r in db.execute('SELECT id,name FROM centers')}
        for source, target, capacity in [('AWStore Quito', 'Taller Técnico AWStore', 30), ('AWStore Quito', 'Centro de Reciclaje Andino', 20), ('Taller Técnico AWStore', 'Centro de Reciclaje Andino', 10), ('Taller Técnico AWStore', 'Centro Comunitario La Floresta', 20)]:
            db.execute('INSERT OR IGNORE INTO network_edges(source_id,target_id,capacity) VALUES (?,?,?)', (ids[source], ids[target], capacity))
        db.execute('UPDATE devices SET center_id=? WHERE center_id IS NULL', (ids['AWStore Quito'],))
        db.execute('INSERT INTO schema_migrations(version) VALUES (3)')


TECH_PRODUCTS = [
    ('AW-LAP-14', 'NovaBook 14', 'Laptop de 14 pulgadas, 16 GB RAM y SSD de 512 GB para estudiar y trabajar.', 'Computadoras', 'NUEVO', 74900, 6),
    ('AW-AUD-01', 'Pulse Wireless', 'Audífonos inalámbricos con micrófono y conexión Bluetooth.', 'Audio', 'NUEVO', 4900, 12),
    ('AW-MON-27', 'Vision 27', 'Monitor IPS de 27 pulgadas, resolución QHD y conexiones HDMI y DisplayPort.', 'Monitores', 'NUEVO', 22900, 5),
    ('AW-KEY-01', 'Core Mechanical', 'Teclado mecánico compacto con conexión USB y distribución en español.', 'Periféricos', 'NUEVO', 6900, 10),
    ('AW-RE-14', 'NovaBook Circular', 'Laptop reacondicionada con diagnóstico técnico y componentes recuperados.', 'Computadoras', 'REACONDICIONADO', 34900, 3),
    ('AW-MOU-01', 'Precision Mouse', 'Mouse óptico ergonómico con conexión USB.', 'Periféricos', 'NUEVO', 2400, 15),
    ('AW-SSD-1T', 'SSD 1 TB', 'Unidad de almacenamiento NVMe de 1 TB para equipos compatibles.', 'Componentes', 'NUEVO', 8900, 8),
    ('AW-HUB-07', 'Hub USB-C 7 en 1', 'Adaptador con HDMI, USB, lector de tarjetas y carga USB-C.', 'Accesorios', 'NUEVO', 3900, 9),
    ('AW-ROU-06', 'Router Wi-Fi 6', 'Router de doble banda para redes domésticas y espacios de trabajo.', 'Redes', 'NUEVO', 7900, 4),
    ('AW-TAB-10', 'Tablet Nova 10', 'Tablet de 10 pulgadas con 128 GB para lectura, estudio y entretenimiento.', 'Tablets', 'NUEVO', 18900, 6),
]


def migrate_demo_brand(db):
    """Solo sustituye muestras originales intactas. Conserva IDs, precios y stock históricos."""
    if db.execute('SELECT 1 FROM schema_migrations WHERE version=2').fetchone():
        return
    originals = [('BT-EXP-12', 'Explorer 12V'), ('BT-MOTO-6', 'Mini Ride 6V'), ('BT-TRI-24', 'Adventure 24V'), ('BT-CUNA-01', 'Nido eléctrico'), ('BT-RE-12', 'Explorer circular 12V')]
    for (old_sku, old_name), new in zip(originals, TECH_PRODUCTS):
        if not db.execute('SELECT 1 FROM products WHERE sku=?', (new[0],)).fetchone():
            db.execute('UPDATE products SET sku=?,name=?,description=?,category=? WHERE sku=? AND name=?', (*new[:4], old_sku, old_name))
    for old, new, category in [('Carrito eléctrico Explorer', 'Laptop para diagnóstico', 'Computadoras'), ('Moto infantil Mini Ride', 'Monitor para recuperación', 'Monitores')]:
        db.execute("UPDATE devices SET model=?,category=? WHERE model=? AND code IN ('RAEE-0001','RAEE-0002')", (new, category, old))
    admin = db.execute("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()
    if admin:
        for row in TECH_PRODUCTS[5:]:
            if not db.execute('SELECT 1 FROM products WHERE sku=?', (row[0],)).fetchone():
                cur = db.execute('INSERT INTO products(sku,name,description,category,condition,price_cents,stock) VALUES (?,?,?,?,?,?,?)', row)
                db.execute('INSERT INTO stock_movements(product_id,quantity,reason,user_id) VALUES (?,?,?,?)', (cur.lastrowid, row[-1], 'Ingreso al catálogo tecnológico', admin['id']))
    db.execute('INSERT INTO schema_migrations(version) VALUES (2)')


def migrate_example_names(db):
    """Actualiza los nombres originales de ejemplo sin cambiar sus identificadores."""
    if db.execute('SELECT 1 FROM schema_migrations WHERE version=4').fetchone():
        return
    for old, new, kind in (
        ('Laboratorio circular', 'Taller Técnico AWStore', 'TALLER'),
        ('Gestor de reciclaje demo', 'Centro de Reciclaje Andino', 'RECICLAJE'),
        ('Destino circular demo', 'Centro Comunitario La Floresta', 'BENEFICIARIO'),
    ):
        db.execute('UPDATE centers SET name=? WHERE name=? AND kind=? AND NOT EXISTS (SELECT 1 FROM centers WHERE name=?)',
                   (new, old, kind, new))
    for document, old, new in (
        ('DEMO-001', 'Familia Demo Uno', 'Camila Andrade'),
        ('DEMO-002', 'Familia Demo Dos', 'Mateo Cevallos'),
        ('DEMO-BUSINESS', 'Cliente demo', 'Camila Andrade'),
    ):
        db.execute('UPDATE clients SET name=? WHERE document=? AND name=?', (new, document, old))
    for login, old, new in (
        ('admin', 'Administración demo', 'Valeria Paredes'),
        ('cliente', 'Cliente demo', 'Camila Andrade'),
        ('ventas', 'Ventas demo', 'Daniel Morales'),
        ('tecnico', 'Técnico demo', 'Andrés Vega'),
        ('inventario', 'Inventario demo', 'Sofía Herrera'),
        ('finanzas', 'Finanzas demo', 'Lucía Torres'),
    ):
        db.execute('UPDATE users SET name=? WHERE email=? AND name=?', (new, login + '@ecoraee.local', old))
    db.execute("UPDATE stock_movements SET reason='Inventario de apertura' WHERE reason='Existencias iniciales demo'")
    db.execute("UPDATE stock_movements SET reason='Ingreso al catálogo tecnológico' WHERE reason='Catálogo tecnológico de demostración'")
    db.execute('INSERT INTO schema_migrations(version) VALUES (4)')


def migrate_example_role_labels(db):
    if db.execute('SELECT 1 FROM schema_migrations WHERE version=5').fetchone():
        return
    for login, role, previous, label in (
        ('admin', 'admin', 'Valeria Paredes', 'Valia Paredes · Admin'),
        ('cliente', 'client', 'Camila Andrade', 'Camila Andrade · Cliente'),
        ('ventas', 'sales', 'Daniel Morales', 'Daniel Morales · Ventas'),
        ('tecnico', 'technician', 'Andrés Vega', 'Andrés Vega · Técnico'),
        ('inventario', 'inventory', 'Sofía Herrera', 'Sofía Herrera · Inventario'),
        ('finanzas', 'finance', 'Lucía Torres', 'Lucía Torres · Finanzas'),
    ):
        db.execute('UPDATE users SET name=? WHERE email=? AND role=? AND name=?',
                   (label, login + '@ecoraee.local', role, previous))
    db.execute('INSERT INTO schema_migrations(version) VALUES (5)')


def migrate_example_diagnosis_spelling(db):
    if db.execute('SELECT 1 FROM schema_migrations WHERE version=6').fetchone():
        return
    typo = 'el quipo se recivla'
    corrected = 'El equipo se recicla.'
    device = db.execute("SELECT id FROM devices WHERE code='RAEE-0002'").fetchone()
    if device:
        db.execute('UPDATE evaluations SET notes=? WHERE device_id=? AND lower(trim(notes))=?',
                   (corrected, device['id'], typo))
        db.execute("UPDATE events SET detail=? WHERE device_id=? AND action='Diagnóstico' AND lower(trim(detail))=?",
                   ('1 componente clasificado. ' + corrected, device['id'], '1 componentes clasificados. ' + typo))
    db.execute('INSERT INTO schema_migrations(version) VALUES (6)')
