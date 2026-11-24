"""Rutas de catálogo, ventas, finanzas, inventario y administración."""
import uuid
from pydantic import BaseModel, Field
from .catalogos_productos import prepare_catalogs, validate_product_catalog, product_values
import json
import unicodedata
from fastapi import APIRouter, Depends, HTTPException
from .base_datos import connection
from .seguridad import current_user, require_roles, hash_password
from .validaciones_negocio import ProductInput, StockInput, OrderInput, DecisionInput, PaymentInput, AssemblyInput, UserInput, CheckoutInput, UserUpdateInput
from .servicios_negocio import audit, get_order, change_stock, create_order, decide_order, record_payment, confirm_order, tradein_balance, tradein_rewards
from .servicios import close_component, event
from .validaciones import CloseInput

router = APIRouter(prefix='/api', tags=['Operación empresarial'])

class ProductCategoryInput(BaseModel):
    name: str = Field(min_length=3, max_length=60)
    description: str = Field(min_length=3, max_length=600)
    model: str | None = Field(default=None, min_length=3, max_length=100)


class CategoryNameInput(BaseModel):
    name: str = Field(min_length=3, max_length=60)


@router.post('/product-categories/register', status_code=201)
def register_category(data: CategoryNameInput, user=Depends(require_roles('inventory'))):
    name = ' '.join(data.name.split())
    if len(name) < 3:
        raise HTTPException(422, 'La categoría debe tener al menos tres caracteres.')
    normalize = lambda value: ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        prepare_catalogs(db)
        for row in db.execute('SELECT name FROM product_categories').fetchall():
            if normalize(row['name']) == normalize(name):
                return {'name': row['name'], 'created': False}
        db.execute('INSERT INTO product_categories VALUES (?)', (name,))
        audit(db, user, 'Categoría registrada', name)
    return {'name': name, 'created': True}


@router.get('/product-categories')
def product_categories(user=Depends(current_user)):
    with connection() as db:
        prepare_catalogs(db)
        return [{'name': row['name'], 'descriptions': [d['description'] for d in db.execute('SELECT description FROM product_descriptions WHERE category=? ORDER BY description', (row['name'],))], 'models': [dict(m) for m in db.execute('SELECT name,description FROM product_models WHERE category=? ORDER BY name,description', (row['name'],))]} for row in db.execute('SELECT name FROM product_categories ORDER BY name').fetchall()]


@router.post('/product-categories', status_code=201)
def create_product_category(data: ProductCategoryInput, user=Depends(require_roles())):
    name, description = data.name.strip(), data.description.strip()
    if len(name) < 3 or len(description) < 3:
        raise HTTPException(422, 'El nombre y la descripción requieren al menos tres caracteres.')
    with connection() as db:
        prepare_catalogs(db)
        existing = db.execute('SELECT name FROM product_categories WHERE name=?', (name,)).fetchone()
        name = existing['name'] if existing else name
        db.execute('INSERT OR IGNORE INTO product_categories VALUES (?)', (name,))
        db.execute('INSERT OR IGNORE INTO product_descriptions VALUES (?,?)', (name, description))
        if data.model is not None:
            model = data.model.strip()
            if len(model) < 3:
                raise HTTPException(422, 'El modelo requiere al menos tres caracteres.')
            db.execute('INSERT OR IGNORE INTO product_models VALUES (?,?,?)', (name, model, description))
        audit(db, user, 'Catálogo de productos actualizado', name)
    return {'name': name, 'description': description}


@router.get('/catalog')
def public_catalog():
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT * FROM products WHERE active=1 ORDER BY id')]


@router.post('/checkout', status_code=201)
def checkout(data: CheckoutInput, user=Depends(require_roles('client'))):
    if user['role'] != 'client':
        raise HTTPException(403, 'El checkout de la tienda es para cuentas de cliente.')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        previous = db.execute('SELECT order_id FROM checkout_requests WHERE user_id=? AND request_key=?', (user['id'], data.request_key)).fetchone()
        if previous:
            order = get_order(db, previous['order_id'], user)
            return {'id': order['id'], 'total_cents': order['total_cents'], 'message': 'Tu compra ya fue registrada.'}
        if data.payment_type == 'CONTADO' and not data.demo_payment_confirmed:
            raise HTTPException(422, 'Confirma el pago de demostración antes de finalizar.')
        order_id = create_order(db, data, user)
        order = get_order(db, order_id, user)
        if data.payment_type == 'CONTADO':
            confirm_order(db, order, user)
            db.execute('INSERT INTO cash_receipts (order_id,reference,amount_cents) VALUES (?,?,?)',
                       (order_id, 'DEMO-' + uuid.uuid4().hex[:12].upper(), order['total_cents']))
            audit(db, user, 'Pago de prueba confirmado', f'Compra #{order_id}. Sin cobro real.')
        db.execute('INSERT INTO checkout_requests VALUES (?,?,?)', (user['id'], data.request_key, order_id))
    return {'id': order_id, 'total_cents': order['total_cents'], 'message': 'Compra confirmada. Pago de demostración registrado.' if data.payment_type == 'CONTADO' else 'Solicitud de crédito enviada. Finanzas revisará el plan de cuotas.'}


@router.get('/products')
def products(user=Depends(current_user)):
    with connection() as db:
        sql = 'SELECT * FROM products'
        if user['role'] in ('client', 'sales', 'finance', 'technician'):
            sql += ' WHERE active=1'
        return [dict(r) for r in db.execute(sql + ' ORDER BY id')]


@router.post('/products', status_code=201)
def create_product(data: ProductInput, user=Depends(require_roles('inventory'))):
    with connection() as db:
        validate_product_catalog(db, data, user)
        cur = db.execute('INSERT INTO products (sku,name,description,category,condition,price_cents,specifications) VALUES (?,?,?,?,?,?,?)', (*product_values(data), json.dumps(data.specifications or {}, ensure_ascii=False)))
        db.execute('UPDATE products SET description_edit_reason=? WHERE id=?', (data.description_edit_reason.strip(), cur.lastrowid))
        if data.description_edit_reason.strip():
            audit(db, user, 'Descripción corregida', data.sku + ': ' + data.description_edit_reason)
        audit(db, user, 'Producto creado', data.sku)
        return {'id': cur.lastrowid}


@router.put('/products/{product_id}')
def update_product(product_id: int, data: ProductInput, user=Depends(require_roles('inventory'))):
    with connection() as db:
        validate_product_catalog(db, data, user)
        cur = db.execute('UPDATE products SET sku=?,name=?,description=?,category=?,condition=?,price_cents=? WHERE id=?', (*product_values(data), product_id))
        if data.specifications is not None:
            db.execute('UPDATE products SET specifications=?,description_edit_reason=? WHERE id=?', (json.dumps(data.specifications, ensure_ascii=False), data.description_edit_reason.strip(), product_id))
        if data.description_edit_reason.strip():
            audit(db, user, 'Descripción corregida', data.sku + ': ' + data.description_edit_reason)
        if not cur.rowcount:
            raise HTTPException(404, 'Producto no encontrado.')
        audit(db, user, 'Producto actualizado', data.sku)
    return {'message': 'Producto actualizado.'}


@router.post('/products/{product_id}/toggle')
def toggle_product(product_id: int, user=Depends(require_roles('inventory'))):
    with connection() as db:
        if not db.execute('UPDATE products SET active=1-active WHERE id=?', (product_id,)).rowcount:
            raise HTTPException(404, 'Producto no encontrado.')
        audit(db, user, 'Disponibilidad modificada', f'Producto #{product_id}')
    return {'message': 'Disponibilidad actualizada.'}


@router.post('/products/{product_id}/stock')
def adjust_stock(product_id: int, data: StockInput, user=Depends(require_roles('inventory'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        change_stock(db, product_id, data.quantity, data.reason, user)
    return {'message': 'Movimiento de inventario guardado.'}


@router.get('/stock-movements')
def movements(user=Depends(require_roles('inventory', 'sales'))):
    with connection() as db:
        return [dict(r) for r in db.execute('''SELECT m.*, p.name AS product_name, u.name AS responsible
            FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN users u ON u.id=m.user_id
            ORDER BY m.id DESC LIMIT 200''')]


@router.get('/tradein-balance')
def my_tradein_balance(user=Depends(require_roles('client'))):
    with connection() as db:
        return {'balance_cents': tradein_balance(db, user['client_id'])}


@router.get('/orders')
def orders(user=Depends(require_roles('client', 'sales', 'finance'))):
    with connection() as db:
        sql = '''SELECT o.*, c.name AS client_name, t.device_id,
            coalesce((SELECT sum(amount_cents-paid_cents) FROM installments WHERE order_id=o.id),0) AS balance_cents
            FROM orders o JOIN clients c ON c.id=o.client_id LEFT JOIN order_tradeins t ON t.order_id=o.id'''
        params = ()
        if user['role'] == 'client':
            sql += ' WHERE o.client_id=?'
            params = (user['client_id'],)
        return [dict(r) for r in db.execute(sql + ' ORDER BY o.id DESC', params)]


@router.post('/orders', status_code=201)
def new_order(data: OrderInput, user=Depends(require_roles('client', 'sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        order_id = create_order(db, data, user)
    return {'id': order_id, 'message': 'Pedido creado. Pendiente de revisión.'}


@router.get('/orders/{order_id}')
def order_detail(order_id: int, user=Depends(require_roles('client', 'sales', 'finance'))):
    with connection() as db:
        result = dict(get_order(db, order_id, user))
        tradein = db.execute('SELECT device_id FROM order_tradeins WHERE order_id=?', (order_id,)).fetchone()
        result['tradein_device_id'] = tradein['device_id'] if tradein else None
        result['tradein_reward_cents'] = next(
            (row['amount_cents'] for row in tradein_rewards(db, result['client_id']) if row['order_id'] == order_id), None)
        discount = db.execute('SELECT amount_cents FROM order_tradein_discounts WHERE order_id=?', (order_id,)).fetchone()
        result['tradein_discount_cents'] = discount['amount_cents'] if discount else 0
        receipt = db.execute('SELECT reference,amount_cents,created_at FROM cash_receipts WHERE order_id=?', (order_id,)).fetchone()
        result['cash_receipt'] = dict(receipt) if receipt else None
        result['items'] = [dict(r) for r in db.execute('SELECT i.*, p.name FROM order_items i JOIN products p ON p.id=i.product_id WHERE order_id=?', (order_id,))]
        result['installments_detail'] = [dict(r) for r in db.execute('SELECT * FROM installments WHERE order_id=? ORDER BY number', (order_id,))]
        result['payments'] = [dict(r) for r in db.execute('''SELECT p.*, i.number FROM payments p JOIN installments i ON i.id=p.installment_id
            WHERE i.order_id=? ORDER BY p.id DESC''', (order_id,))]
        return result


@router.post('/orders/{order_id}/decision')
def decision(order_id: int, data: DecisionInput, user=Depends(require_roles('sales', 'finance'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        decide_order(db, order_id, data, user)
    return {'message': 'Pedido aprobado y existencias descontadas.' if data.approve else 'Pedido rechazado.'}


@router.post('/orders/{order_id}/cancel')
def cancel(order_id: int, user=Depends(require_roles('client', 'sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        order = get_order(db, order_id, user)
        if order['status'] != 'PENDIENTE':
            raise HTTPException(409, 'Solo se pueden cancelar pedidos pendientes.')
        db.execute("UPDATE orders SET status='CANCELADO' WHERE id=?", (order_id,))
        audit(db, user, 'Pedido cancelado', f'Pedido #{order_id}')
    return {'message': 'Pedido cancelado.'}


@router.post('/orders/{order_id}/deliver')
def deliver_order(order_id: int, user=Depends(require_roles('sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        order = get_order(db, order_id, user)
        if order['status'] != 'CONFIRMADO' or order['delivered_at']:
            raise HTTPException(409, 'La compra debe estar confirmada y pendiente de entrega.')
        db.execute("UPDATE orders SET delivered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),delivered_by=? WHERE id=?", (user['id'], order_id))
        audit(db, user, 'Compra entregada', f'Pedido #{order_id}; {order["delivery_mode"]}')
    return {'message': 'Entrega registrada correctamente.'}


@router.post('/orders/{order_id}/receive-tradein', status_code=201)
def receive_tradein(order_id: int, user=Depends(require_roles('sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        order = get_order(db, order_id, user)
        if order['status'] != 'CONFIRMADO' or not order['tradein_model']:
            raise HTTPException(409, 'El pedido debe estar confirmado y tener un equipo declarado para canje.')
        if db.execute('SELECT 1 FROM order_tradeins WHERE order_id=?', (order_id,)).fetchone():
            raise HTTPException(409, 'El canje ya fue recibido.')
        code = 'RAEE-' + uuid.uuid4().hex[:8].upper()
        center = db.execute("SELECT * FROM centers WHERE kind='RECOLECCION' AND active=1 ORDER BY id LIMIT 1").fetchone()
        if center is None or db.execute('SELECT count(*) FROM devices WHERE center_id=?', (center['id'],)).fetchone()[0] >= center['capacity']:
            raise HTTPException(409, 'No hay capacidad para recibir el equipo de canje.')
        cur = db.execute('INSERT INTO devices (code,model,category,client_id,notes,center_id,location) VALUES (?,?,?,?,?,?,?)',
                         (code, order['tradein_model'], 'Plan canje', order['client_id'], f'Recepción vinculada al pedido #{order_id}', center['id'], center['name']))
        db.execute('INSERT INTO order_tradeins VALUES (?,?)', (order_id, cur.lastrowid))
        event(db, cur.lastrowid, 'Recepción por canje', f'Entrega de equipo usado vinculada al pedido #{order_id}.', user['name'])
        return {'id': cur.lastrowid, 'code': code, 'message': 'Canje recibido y expediente RAEE creado.'}


@router.post('/installments/{installment_id}/payments', status_code=201)
def payment(installment_id: int, data: PaymentInput, user=Depends(require_roles('finance'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        record_payment(db, installment_id, data, user)
    return {'message': 'Pago registrado y saldo actualizado.'}


@router.post('/assemblies', status_code=201)
def assembly(data: AssemblyInput, user=Depends(require_roles('inventory'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        product = db.execute("SELECT * FROM products WHERE id=? AND condition='REACONDICIONADO' AND active=1", (data.product_id,)).fetchone()
        if product is None:
            raise HTTPException(422, 'Selecciona un producto reacondicionado activo.')
        if len(set(data.component_ids)) != len(data.component_ids):
            raise HTTPException(422, 'No repitas componentes.')
        cur = db.execute('INSERT INTO assemblies (product_id,user_id,notes) VALUES (?,?,?)', (data.product_id, user['id'], data.notes))
        for component_id in data.component_ids:
            component = db.execute('SELECT * FROM components WHERE id=?', (component_id,)).fetchone()
            if component is None or component['classification'] != 'REUTILIZABLE' or component['closed_at']:
                raise HTTPException(409, 'Solo se pueden consumir piezas reutilizables sin destino confirmado.')
            if db.execute('SELECT 1 FROM component_consumptions WHERE component_id=?', (component_id,)).fetchone():
                raise HTTPException(409, 'Una de las piezas ya fue utilizada.')
            close_component(db, component_id, CloseInput(destination=f'Fabricación: {product["name"]}', responsible=user['name'], destination_type='FABRICACION'))
            db.execute('INSERT INTO component_consumptions VALUES (?,?)', (component_id, cur.lastrowid))
            event(db, component['device_id'], 'Uso en fabricación', f'Pieza #{component_id} utilizada en ensamble #{cur.lastrowid}.', user['name'])
        change_stock(db, data.product_id, 1, f'Ensamble #{cur.lastrowid}: {data.notes}', user)
        audit(db, user, 'Ensamble registrado', f'Ensamble #{cur.lastrowid}; producto #{data.product_id}')
    return {'id': cur.lastrowid, 'message': 'Una unidad reacondicionada incorporada al inventario.'}


@router.get('/users')
def users(user=Depends(require_roles())):
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT id,name,email,role,client_id,active FROM users ORDER BY id')]


@router.post('/users', status_code=201)
def create_user(data: UserInput, user=Depends(require_roles())):
    if data.role == 'client' and not data.client_id:
        raise HTTPException(422, 'Un usuario cliente debe estar asociado a un generador.')
    if data.role != 'client' and data.client_id:
        raise HTTPException(422, 'Solo los clientes llevan un generador asociado.')
    with connection() as db:
        cur = db.execute('INSERT INTO users (name,email,password_hash,role,client_id) VALUES (?,?,?,?,?)',
                         (data.name, data.email.lower(), hash_password(data.password), data.role, data.client_id))
        audit(db, user, 'Usuario creado', f'{data.email}: {data.role}')
        return {'id': cur.lastrowid}


def validate_user_change(db, user_id, actor, role=None):
    target = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
    if target is None:
        raise HTTPException(404, 'Usuario no encontrado.')
    if user_id == actor['id']:
        raise HTTPException(409, 'No puedes modificar tu propia cuenta desde esta pantalla.')
    if target['role'] == 'admin' and target['active'] and role != 'admin':
        count = db.execute("SELECT count(*) FROM users WHERE role='admin' AND active=1").fetchone()[0]
        if count <= 1:
            raise HTTPException(409, 'Debe existir al menos un administrador activo.')
    return target


@router.put('/users/{user_id}')
def update_user(user_id: int, data: UserUpdateInput, user=Depends(require_roles())):
    if (data.role == 'client') != (data.client_id is not None):
        raise HTTPException(422, 'Solo los clientes deben tener una ficha de cliente asociada.')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        validate_user_change(db, user_id, user, data.role)
        db.execute('UPDATE users SET name=?,email=?,role=?,client_id=? WHERE id=?', (data.name, data.email.lower(), data.role, data.client_id, user_id))
        db.execute('DELETE FROM sessions WHERE user_id=?', (user_id,))
        audit(db, user, 'Usuario actualizado', f'Cuenta #{user_id}; perfil {data.role}. Sesiones anteriores invalidadas.')
    return {'message': 'Usuario actualizado. Deberá iniciar sesión de nuevo.'}


@router.post('/users/{user_id}/toggle')
def toggle_user(user_id: int, user=Depends(require_roles())):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        validate_user_change(db, user_id, user)
        db.execute('UPDATE users SET active=1-active WHERE id=?', (user_id,))
        db.execute('DELETE FROM sessions WHERE user_id=?', (user_id,))
        audit(db, user, 'Acceso de usuario modificado', f'Cuenta #{user_id}')
    return {'message': 'Estado de acceso actualizado.'}


@router.get('/admin-summary')
def admin_summary(user=Depends(require_roles())):
    with connection() as db:
        queries = {
            'active_users': 'SELECT count(*) FROM users WHERE active=1',
            'pending_credits': "SELECT count(*) FROM orders WHERE payment_type='CREDITO' AND status='PENDIENTE'",
            'confirmed_cents': "SELECT coalesce(sum(total_cents),0) FROM orders WHERE status='CONFIRMADO'",
            'balance_cents': 'SELECT coalesce(sum(amount_cents-paid_cents),0) FROM installments',
            'stock_units': 'SELECT coalesce(sum(stock),0) FROM products WHERE active=1',
            'low_stock': 'SELECT count(*) FROM products WHERE active=1 AND stock<=2',
            'workshop_pending': "SELECT count(*) FROM devices WHERE status='EN_EVALUACION'",
            'reusable': "SELECT count(*) FROM components WHERE classification='REUTILIZABLE' AND closed_at IS NULL",
            'pending_deliveries': "SELECT count(*) FROM orders WHERE status='CONFIRMADO' AND delivered_at IS NULL",
        }
        return {key: db.execute(sql).fetchone()[0] for key, sql in queries.items()}


@router.get('/business-events')
def business_events(user=Depends(require_roles())):
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT e.*,u.name AS responsible FROM business_events e JOIN users u ON u.id=e.user_id ORDER BY e.id DESC LIMIT 100')]
