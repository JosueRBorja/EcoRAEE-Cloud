"""Operaciones comerciales atómicas. Los valores monetarios son centavos enteros."""
import calendar
from datetime import date
from fastapi import HTTPException


def audit(db, user, action, detail):
    db.execute('INSERT INTO business_events (user_id,action,detail) VALUES (?,?,?)', (user['id'], action, detail))


def get_order(db, order_id, user):
    row = db.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Pedido no encontrado.')
    if user['role'] == 'client' and row['client_id'] != user['client_id']:
        raise HTTPException(404, 'Pedido no encontrado.')
    return row


def change_stock(db, product_id, quantity, reason, user, order_id=None):
    if not quantity:
        raise HTTPException(422, 'El movimiento debe ser distinto de cero.')
    updated = db.execute('UPDATE products SET stock=stock+? WHERE id=? AND stock+?>=0', (quantity, product_id, quantity))
    if updated.rowcount != 1:
        raise HTTPException(409, 'Producto inexistente o existencias insuficientes. No se guardó ningún cambio.')
    db.execute('INSERT INTO stock_movements (product_id,quantity,reason,user_id,order_id) VALUES (?,?,?,?,?)', (product_id, quantity, reason, user['id'], order_id))


def tradein_rewards(db, client_id):
    return db.execute('''SELECT t.order_id,
        CASE v.classification WHEN 'REUTILIZABLE' THEN 2000
             WHEN 'REPARABLE' THEN 1000 WHEN 'RECICLABLE' THEN 500 ELSE 0 END AS amount_cents
        FROM order_tradeins t JOIN orders o ON o.id=t.order_id
        JOIN vw_device_classification v ON v.device_id=t.device_id
        JOIN evaluations e ON e.device_id=t.device_id WHERE o.client_id=?''', (client_id,))


def tradein_balance(db, client_id):
    earned = sum(row['amount_cents'] for row in tradein_rewards(db, client_id))
    used = db.execute('''SELECT coalesce(sum(d.amount_cents),0) FROM order_tradein_discounts d
        JOIN orders o ON o.id=d.order_id WHERE o.client_id=? AND o.status IN ('PENDIENTE','CONFIRMADO')''',
                      (client_id,)).fetchone()[0]
    return max(0, earned - used)


def create_order(db, data, user):
    client_id = user['client_id'] if user['role'] == 'client' else data.client_id
    if not client_id or not db.execute('SELECT id FROM clients WHERE id=?', (client_id,)).fetchone():
        raise HTTPException(422, 'Selecciona un cliente válido.')
    if data.payment_type == 'CONTADO' and data.installments != 1:
        raise HTTPException(422, 'Una compra de contado no lleva cuotas.')
    if data.payment_type == 'CREDITO' and data.installments not in (3, 6, 12):
        raise HTTPException(422, 'Selecciona 3, 6 o 12 cuotas.')
    if len({item.product_id for item in data.items}) != len(data.items):
        raise HTTPException(422, 'Agrupa la cantidad de cada producto en una sola línea.')
    lines = []
    for item in data.items:
        product = db.execute('SELECT * FROM products WHERE id=? AND active=1', (item.product_id,)).fetchone()
        if product is None or product['stock'] < item.quantity:
            raise HTTPException(409, 'Uno de los productos ya no tiene existencias suficientes.')
        lines.append((item.product_id, item.quantity, product['price_cents']))
    total = sum(quantity * price for _, quantity, price in lines)
    discount = data.tradein_discount_cents
    if discount:
        if user['role'] != 'client':
            raise HTTPException(403, 'El saldo de canje se usa desde la cuenta del cliente.')
        if discount > min(tradein_balance(db, client_id), total - data.installments):
            raise HTTPException(409, 'El saldo de canje o el total cambió. Vuelve a abrir el carrito.')
        total -= discount
    if data.payment_type == 'CREDITO' and total < data.installments:
        raise HTTPException(422, 'El total debe permitir al menos un centavo por cuota.')
    cur = db.execute('''INSERT INTO orders (client_id,created_by,payment_type,installments,total_cents,tradein_model)
        VALUES (?,?,?,?,?,?)''', (client_id, user['id'], data.payment_type, data.installments, total, data.tradein_model))
    if discount:
        db.execute('INSERT INTO order_tradein_discounts VALUES (?,?)', (cur.lastrowid, discount))
    if data.delivery_mode == 'ENTREGA' and (len(data.delivery_address) < 8 or len(data.contact_phone) < 7):
        raise HTTPException(422, 'Para entrega a domicilio indica una dirección de al menos 8 caracteres y un teléfono de al menos 7.')
    db.execute('UPDATE orders SET delivery_mode=?,delivery_address=?,contact_phone=? WHERE id=?',
               (data.delivery_mode, data.delivery_address, data.contact_phone, cur.lastrowid))
    for product_id, quantity, price in lines:
        db.execute('INSERT INTO order_items (order_id,product_id,quantity,price_cents) VALUES (?,?,?,?)', (cur.lastrowid, product_id, quantity, price))
    audit(db, user, 'Pedido creado', f'Pedido #{cur.lastrowid}; total {total} centavos.')
    return cur.lastrowid


def add_months(day, months):
    month_index = day.year * 12 + day.month - 1 + months
    year, month = divmod(month_index, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def decide_order(db, order_id, data, user):
    order = get_order(db, order_id, user)
    allowed = ('finance', 'admin') if order['payment_type'] == 'CREDITO' else ('sales', 'admin')
    if user['role'] not in allowed:
        raise HTTPException(403, 'Este pedido debe ser revisado por el departamento correspondiente.')
    if order['status'] != 'PENDIENTE':
        raise HTTPException(409, 'El pedido ya fue resuelto.')
    if not data.approve and len(data.reason.strip()) < 5:
        raise HTTPException(422, 'Indica el motivo del rechazo (al menos 5 caracteres).')
    if not data.approve:
        db.execute("UPDATE orders SET status='RECHAZADO', rejection_reason=?, confirmed_by=? WHERE id=?", (data.reason, user['id'], order_id))
        audit(db, user, 'Pedido rechazado', f'Pedido #{order_id}: {data.reason}')
        return
    if data.installments is not None:
        if order['payment_type'] != 'CREDITO':
            raise HTTPException(422, 'Una venta de contado no lleva plan de cuotas.')
        if order['total_cents'] < data.installments:
            raise HTTPException(422, 'El total no permite ese número de cuotas.')
        db.execute('UPDATE orders SET installments=? WHERE id=?', (data.installments, order_id))
        order = get_order(db, order_id, user)
    confirm_order(db, order, user)


def confirm_order(db, order, user):
    """Paso compartido por ventas, finanzas y el checkout de prueba autorizado."""
    order_id = order['id']
    if order['status'] != 'PENDIENTE':
        raise HTTPException(409, 'El pedido ya fue resuelto.')
    items = db.execute('SELECT i.*, p.active FROM order_items i JOIN products p ON p.id=i.product_id WHERE order_id=?', (order_id,)).fetchall()
    for item in items:
        if not item['active']:
            raise HTTPException(409, 'El pedido contiene un producto desactivado.')
        change_stock(db, item['product_id'], -item['quantity'], f'Venta #{order_id}', user, order_id)
    db.execute("UPDATE orders SET status='CONFIRMADO', confirmed_by=? WHERE id=?", (user['id'], order_id))
    if order['payment_type'] == 'CREDITO':
        base, remainder = divmod(order['total_cents'], order['installments'])
        for i in range(1, order['installments'] + 1):
            db.execute('INSERT INTO installments (order_id,number,amount_cents,due_date) VALUES (?,?,?,?)',
                       (order_id, i, base + (1 if i <= remainder else 0), add_months(date.today(), i).isoformat()))
    audit(db, user, 'Venta confirmada', f'Pedido #{order_id}. Inventario actualizado en la misma transacción.')


def record_payment(db, installment_id, data, user):
    installment = db.execute('''SELECT i.* FROM installments i JOIN orders o ON o.id=i.order_id
        WHERE i.id=? AND o.status='CONFIRMADO' ''', (installment_id,)).fetchone()
    if installment is None:
        raise HTTPException(404, 'Cuota no encontrada.')
    if data.amount_cents > installment['amount_cents'] - installment['paid_cents']:
        raise HTTPException(409, 'El pago supera el saldo de esta cuota.')
    db.execute('INSERT INTO payments (installment_id,amount_cents,reference,recorded_by) VALUES (?,?,?,?)', (installment_id, data.amount_cents, data.reference, user['id']))
    db.execute('UPDATE installments SET paid_cents=paid_cents+? WHERE id=?', (data.amount_cents, installment_id))
    audit(db, user, 'Pago registrado', f'Cuota #{installment_id}; {data.amount_cents} centavos. Ref. {data.reference}')
