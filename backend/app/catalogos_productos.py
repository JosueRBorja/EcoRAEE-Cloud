"""Catálogos persistentes para categorías y descripciones autorizadas."""
from fastapi import HTTPException
import json
from pathlib import Path

SPEC_CONFIG = json.loads((Path(__file__).resolve().parents[2] / 'frontend/src/utilidades/caracteristicasProducto.json').read_text(encoding='utf-8'))


def product_values(data):
    return (data.sku, data.name, data.description, data.category, data.condition, data.price_cents)


def prepare_catalogs(db):
    if 'specifications' not in {r['name'] for r in db.execute('PRAGMA table_info(products)')}:
        db.execute("ALTER TABLE products ADD COLUMN specifications TEXT NOT NULL DEFAULT '{}'")
    if 'description_edit_reason' not in {r['name'] for r in db.execute('PRAGMA table_info(products)')}:
        db.execute("ALTER TABLE products ADD COLUMN description_edit_reason TEXT NOT NULL DEFAULT ''")
    db.execute('CREATE TABLE IF NOT EXISTS product_categories (name TEXT PRIMARY KEY COLLATE NOCASE CHECK(length(trim(name)) BETWEEN 3 AND 60))')
    db.execute('CREATE TABLE IF NOT EXISTS product_descriptions (category TEXT NOT NULL COLLATE NOCASE REFERENCES product_categories(name), description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 3 AND 600), PRIMARY KEY(category, description))')
    db.execute('CREATE TABLE IF NOT EXISTS product_models (category TEXT NOT NULL COLLATE NOCASE REFERENCES product_categories(name), name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 100), description TEXT NOT NULL, PRIMARY KEY(category,name,description), FOREIGN KEY(category,description) REFERENCES product_descriptions(category,description))')
    for category in ('Computadoras', 'Monitores', 'Periféricos', 'Audio', 'Tablets', 'Redes', 'Componentes', 'Batería'):
        db.execute('INSERT OR IGNORE INTO product_categories VALUES (?)', (category,))
        for description in (f'{category}: producto nuevo con garantía.', f'{category}: equipo reacondicionado con pruebas funcionales.'):
            db.execute('INSERT OR IGNORE INTO product_descriptions VALUES (?,?)', (category, description))
    # Conserva los productos y las descripciones anteriores como opciones válidas.
    for row in db.execute('SELECT DISTINCT category,description FROM products').fetchall():
        db.execute('INSERT OR IGNORE INTO product_categories VALUES (?)', (row['category'],))
        if row['description'].strip():
            db.execute('INSERT OR IGNORE INTO product_descriptions VALUES (?,?)', (row['category'], row['description']))
    for row in db.execute("SELECT DISTINCT category,name,description FROM products WHERE length(trim(description))>=3").fetchall():
        db.execute('INSERT OR IGNORE INTO product_models VALUES (?,?,?)', (row['category'], row['name'], row['description']))


def validate_product_catalog(db, data, user):
    prepare_catalogs(db)
    if data.specifications is not None:
        category = db.execute('SELECT name FROM product_categories WHERE name=?', (data.category,)).fetchone()
        if not category:
            raise HTTPException(422, 'Registra o selecciona una categoría antes de guardar.')
        data.category = category['name']
        data.name = data.name.strip()
        if len(data.name) < 3:
            raise HTTPException(422, 'Indica el modelo exacto del producto.')
        allowed = SPEC_CONFIG['profiles'].get(data.category, SPEC_CONFIG['profiles']['General'])
        for key, value in data.specifications.items():
            if key not in allowed or value not in SPEC_CONFIG['fields'][key]['options']:
                raise HTTPException(422, 'Característica no válida para la categoría seleccionada.')
        if not data.specifications:
            raise HTTPException(422, 'Selecciona al menos una característica técnica.')
        parts = [f"{SPEC_CONFIG['fields'][key]['label']}: {data.specifications[key]}" for key in allowed if key in data.specifications]
        generated = f"{data.name}. " + ' · '.join(parts) + ('. Condición: Nuevo.' if data.condition == 'NUEVO' else '. Condición: Reacondicionado.')
        if data.description_edit_reason.strip():
            if len(data.description_edit_reason.strip()) < 5 or len(data.description.strip()) < 5:
                raise HTTPException(422, 'Explica la corrección y completa la descripción.')
        else:
            data.description = generated
        if len(data.description) > 600:
            raise HTTPException(422, 'La descripción supera los 600 caracteres.')
        return
    if user['role'] == 'admin':
        db.execute('INSERT OR IGNORE INTO product_categories VALUES (?)', (data.category,))
        if data.description.strip():
            db.execute('INSERT OR IGNORE INTO product_descriptions VALUES (?,?)', (data.category, data.description))
        else:
            # Compatibilidad con productos históricos sin descripción; la interfaz exige elegirla.
            return
    if not db.execute('SELECT 1 FROM product_categories WHERE name=?', (data.category,)).fetchone():
        raise HTTPException(422, 'Selecciona una categoría registrada por el administrador.')
    if not db.execute('SELECT 1 FROM product_descriptions WHERE category=? AND description=?', (data.category, data.description)).fetchone():
        raise HTTPException(422, 'Selecciona una descripción autorizada para esta categoría.')
    if user['role'] != 'admin' and not db.execute('SELECT 1 FROM product_models WHERE category=? AND name=? AND description=?', (data.category, data.name, data.description)).fetchone():
        raise HTTPException(422, 'El modelo y sus características deben estar registrados en la categoría por el administrador.')
