-- Capacidades en dispositivos por periodo (mes YYYY-MM).
CREATE TABLE IF NOT EXISTS centers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE CHECK(length(trim(name))>=3),
 kind TEXT NOT NULL CHECK(kind IN ('RECOLECCION','TALLER','RECICLAJE','DISPOSICION','BENEFICIARIO')),
 capacity INTEGER NOT NULL CHECK(typeof(capacity)='integer' AND capacity>0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS network_edges (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 source_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
 target_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
 capacity INTEGER NOT NULL CHECK(typeof(capacity)='integer' AND capacity>0),
 CHECK(source_id!=target_id), UNIQUE(source_id,target_id)
);
CREATE TABLE IF NOT EXISTS collections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_id INTEGER NOT NULL REFERENCES clients(id),
 description TEXT NOT NULL CHECK(length(trim(description))>=5),
 pickup_address TEXT NOT NULL CHECK(length(trim(pickup_address))>=5),
 status TEXT NOT NULL DEFAULT 'SOLICITADA' CHECK(status IN ('SOLICITADA','RECIBIDA','CANCELADA')),
 created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS collection_approvals (
 collection_id INTEGER PRIMARY KEY REFERENCES collections(id),
 approved_by INTEGER NOT NULL REFERENCES users(id),
 approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS batches (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 client_id INTEGER NOT NULL REFERENCES clients(id),
 center_id INTEGER NOT NULL REFERENCES centers(id),
 collection_id INTEGER UNIQUE REFERENCES collections(id),
 created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS transfers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 edge_id INTEGER NOT NULL REFERENCES network_edges(id),
 period TEXT NOT NULL CHECK(length(period)=7),
 status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','CONFIRMADO','CANCELADO')),
 created_by INTEGER NOT NULL REFERENCES users(id),
 confirmed_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS transfer_items (
 transfer_id INTEGER NOT NULL REFERENCES transfers(id),
 device_id INTEGER NOT NULL REFERENCES devices(id),
 PRIMARY KEY(transfer_id,device_id)
);
CREATE TABLE IF NOT EXISTS flow_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 scenario TEXT NOT NULL,
 source_id INTEGER NOT NULL REFERENCES centers(id),
 sink_id INTEGER NOT NULL REFERENCES centers(id),
 period TEXT NOT NULL,
 input_json TEXT NOT NULL,
 result_json TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transfers_period ON transfers(edge_id,period,status);
CREATE INDEX IF NOT EXISTS idx_transfer_device ON transfer_items(device_id,transfer_id);
CREATE VIEW IF NOT EXISTS vw_transfer_usage AS
 SELECT t.edge_id,t.period,count(i.device_id) AS used FROM transfers t
 JOIN transfer_items i ON i.transfer_id=t.id
 WHERE t.status IN ('PENDIENTE','CONFIRMADO') GROUP BY t.edge_id,t.period;
