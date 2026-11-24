-- Ampliación aditiva: conserva los datos RAEE de la primera versión.
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','client','sales','technician','inventory','finance')),
 client_id INTEGER REFERENCES clients(id) ON DELETE RESTRICT,
 CHECK(role != 'client' OR client_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sku TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL,
 condition TEXT NOT NULL CHECK(condition IN ('NUEVO','REACONDICIONADO')),
 price_cents INTEGER NOT NULL CHECK(price_cents > 0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 client_id INTEGER NOT NULL REFERENCES clients(id),
 created_by INTEGER NOT NULL REFERENCES users(id),
 payment_type TEXT NOT NULL CHECK(payment_type IN ('CONTADO','CREDITO')),
 installments INTEGER NOT NULL CHECK(installments IN (1,3,6,12)),
 status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(status IN ('PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO')),
 total_cents INTEGER NOT NULL CHECK(total_cents > 0),
 tradein_model TEXT NOT NULL DEFAULT '',
 rejection_reason TEXT NOT NULL DEFAULT '',
 confirmed_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id),
 product_id INTEGER NOT NULL REFERENCES products(id),
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 price_cents INTEGER NOT NULL CHECK(price_cents > 0),
 UNIQUE(order_id, product_id)
);
CREATE TABLE IF NOT EXISTS order_tradeins (
 order_id INTEGER PRIMARY KEY REFERENCES orders(id),
 device_id INTEGER NOT NULL UNIQUE REFERENCES devices(id)
);
CREATE TABLE IF NOT EXISTS order_tradein_discounts (
 order_id INTEGER PRIMARY KEY REFERENCES orders(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0)
);
CREATE TABLE IF NOT EXISTS installments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id),
 number INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 due_date TEXT NOT NULL,
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents >= 0 AND paid_cents <= amount_cents),
 UNIQUE(order_id, number)
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 installment_id INTEGER NOT NULL REFERENCES installments(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 reference TEXT NOT NULL UNIQUE,
 recorded_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id INTEGER NOT NULL REFERENCES products(id),
 quantity INTEGER NOT NULL CHECK(quantity != 0),
 reason TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 order_id INTEGER REFERENCES orders(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS assemblies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id INTEGER NOT NULL REFERENCES products(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 notes TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS component_consumptions (
 component_id INTEGER PRIMARY KEY REFERENCES components(id),
 assembly_id INTEGER NOT NULL REFERENCES assemblies(id)
);
CREATE TABLE IF NOT EXISTS business_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 action TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_installments_order ON installments(order_id);
CREATE TABLE IF NOT EXISTS checkout_requests (
 user_id INTEGER NOT NULL REFERENCES users(id),
 request_key TEXT NOT NULL,
 order_id INTEGER NOT NULL REFERENCES orders(id),
 PRIMARY KEY(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS cash_receipts (
 order_id INTEGER PRIMARY KEY REFERENCES orders(id),
 reference TEXT NOT NULL UNIQUE,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS profile_identity (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    given_names TEXT NOT NULL CHECK(length(trim(given_names)) BETWEEN 1 AND 50),
    surnames TEXT NOT NULL CHECK(length(trim(surnames)) BETWEEN 1 AND 49)
);

CREATE TABLE IF NOT EXISTS profile_addresses (
    client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    city TEXT NOT NULL CHECK(length(trim(city)) BETWEEN 1 AND 45),
    street TEXT NOT NULL CHECK(length(trim(street)) BETWEEN 1 AND 75),
    street_number TEXT NOT NULL CHECK(length(trim(street_number)) BETWEEN 1 AND 15),
    reference TEXT NOT NULL CHECK(length(reference) <= 55)
);
