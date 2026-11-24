"""Integración entre departamentos y aislamiento de los pedidos por cliente."""
import unittest
# Comparte el almacenamiento temporal con las pruebas originales.
from test_flujo import app, connection
from fastapi.testclient import TestClient


def login(client, account):
    response = client.post('/api/auth/login', json={'email': account + '@ecoraee.local', 'password': 'Demo12345!'})
    assert response.status_code == 200, response.text


class BusinessTests(unittest.TestCase):
    def test_credit_permissions_payment_and_tradein(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/orders').status_code, 401)
            login(client, 'cliente')
            products = client.get('/api/products').json()
            product = products[0]
            original_stock = product['stock']
            self.assertEqual(client.get('/api/devices').status_code, 403)
            self.assertEqual(client.get('/api/users').status_code, 403)
            self.assertEqual(client.post('/api/products/1/stock', json={'quantity': 1, 'reason': 'Intento cliente'}).status_code, 403)
            data = {'client_id': 2, 'payment_type': 'CREDITO', 'installments': 3, 'tradein_model': 'Carrito usado demo', 'items': [{'product_id': product['id'], 'quantity': 1}]}
            response = client.post('/api/orders', json=data)
            self.assertEqual(response.status_code, 201, response.text)
            order_id = response.json()['id']
            detail = client.get(f'/api/orders/{order_id}').json()
            self.assertNotEqual(detail['client_id'], 2, 'El cliente no puede suplantar al generador de otro usuario')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 403)
            login(client, 'ventas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 403)
            login(client, 'finanzas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 200)
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 409)
            detail = client.get(f'/api/orders/{order_id}').json()
            installments = detail['installments_detail']
            self.assertEqual(sum(i['amount_cents'] for i in installments), product['price_cents'])
            first = installments[0]
            url = f"/api/installments/{first['id']}/payments"
            self.assertEqual(client.post(url, json={'amount_cents': first['amount_cents']+1, 'reference': 'EXCESO-01'}).status_code, 409)
            self.assertEqual(client.post(url, json={'amount_cents': 100, 'reference': 'PAGO-PARCIAL-01'}).status_code, 201)
            self.assertEqual(client.post(url, json={'amount_cents': 100, 'reference': 'PAGO-PARCIAL-01'}).status_code, 409)
            self.assertEqual(client.get(f'/api/orders/{order_id}').json()['installments_detail'][0]['paid_cents'], 100)
            login(client, 'ventas')
            received = client.post(f'/api/orders/{order_id}/receive-tradein')
            self.assertEqual(received.status_code, 201, received.text)
            self.assertEqual(client.post(f'/api/orders/{order_id}/receive-tradein').status_code, 409)
            self.assertEqual(client.get(f"/api/devices/{received.json()['id']}").json()['model'], 'Carrito usado demo')
            self.assertEqual(client.get('/api/products').json()[0]['stock'], original_stock - 1)
            device_id = received.json()['id']
            self.assertEqual(client.post(f'/api/devices/{device_id}/workshop').status_code, 200)
            login(client, 'tecnico')
            diagnostic = client.post(f'/api/devices/{device_id}/evaluation', json={
                'technician': 'Técnico', 'notes': 'Equipo reutilizable',
                'components': [{'name': 'Pantalla', 'classification': 'REUTILIZABLE'}],
            })
            self.assertEqual(diagnostic.status_code, 201, diagnostic.text)
            login(client, 'cliente')
            self.assertEqual(client.get('/api/tradein-balance').json()['balance_cents'], 2000)
            discounted = client.post('/api/checkout', json={
                'items': data['items'], 'payment_type': 'CONTADO', 'demo_payment_confirmed': True,
                'request_key': 'prueba-canje-descuento-01', 'tradein_discount_cents': 2000,
            })
            self.assertEqual(discounted.status_code, 201, discounted.text)
            detail = client.get(f"/api/orders/{discounted.json()['id']}").json()
            self.assertEqual(detail['cash_receipt']['amount_cents'], product['price_cents'] - 2000)
            self.assertEqual(detail['tradein_discount_cents'], 2000)
            self.assertEqual(client.get('/api/tradein-balance').json()['balance_cents'], 0)
            # Una segunda cuenta cliente no ve ni modifica pedidos ajenos.
            login(client, 'admin')
            user = {'name': 'Otro cliente', 'email': 'otro@ecoraee.local', 'password': 'Demo12345!', 'role': 'client', 'client_id': 2}
            self.assertEqual(client.post('/api/users', json=user).status_code, 201)
            login(client, 'otro')
            self.assertEqual(client.get(f'/api/orders/{order_id}').status_code, 404)
            self.assertEqual(client.get('/api/orders').json(), [])
            self.assertEqual(client.post(f'/api/orders/{order_id}/cancel').status_code, 404)
            self.assertEqual(client.post('/api/auth/logout').status_code, 200)
            self.assertEqual(client.get('/api/auth/me').status_code, 401)

    def test_stock_rollback_on_order_approval(self):
        with TestClient(app) as client:
            login(client, 'ventas')
            products = client.get('/api/products').json()
            first, second = products[:2]
            data = {'client_id': 1, 'payment_type': 'CONTADO', 'items': [{'product_id': first['id'], 'quantity': 1}, {'product_id': second['id'], 'quantity': 1}]}
            order_id = client.post('/api/orders', json=data).json()['id']
            login(client, 'inventario')
            self.assertEqual(client.post(f"/api/products/{second['id']}/stock", json={'quantity': -second['stock'], 'reason': 'Salida de prueba para agotar'}).status_code, 200)
            login(client, 'ventas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 409)
            with connection() as db:
                self.assertEqual(db.execute('SELECT stock FROM products WHERE id=?', (first['id'],)).fetchone()[0], first['stock'])
                self.assertEqual(db.execute('SELECT status FROM orders WHERE id=?', (order_id,)).fetchone()[0], 'PENDIENTE')

    def test_assembly_consumes_only_reusable_and_prevents_reuse(self):
        with TestClient(app) as client:
            login(client, 'admin')
            device = client.post('/api/devices', json={'model': 'Equipo para ensamble', 'category': 'Carrito', 'client_id': 1}).json()['id']
            client.post(f'/api/devices/{device}/workshop')
            client.post(f'/api/devices/{device}/evaluation', json={'technician': 'No suplantar', 'notes': 'Evaluación para fabricar', 'components': [{'name': 'Motor útil', 'classification': 'REUTILIZABLE'}, {'name': 'Batería dañada', 'classification': 'NO_RECUPERABLE'}]})
            detail = client.get(f'/api/devices/{device}').json()
            self.assertEqual(detail['evaluation']['technician'], client.get('/api/auth/me').json()['name'])
            motor, battery = detail['components']
            product = next(p for p in client.get('/api/products').json() if p['condition'] == 'REACONDICIONADO')
            login(client, 'inventario')
            data = {'product_id': product['id'], 'component_ids': [motor['id']], 'notes': 'Ensamble de prueba'}
            self.assertEqual(client.post('/api/assemblies', json=data).status_code, 409, 'Se requiere evidencia')
            evidence = client.post(f'/api/devices/{device}/evidence', content=b'%PDF-1.4\n%%EOF', headers={'content-type': 'application/pdf'}).json()
            self.assertEqual(client.post('/api/assemblies', json={**data, 'component_ids': [motor['id'], battery['id']]}).status_code, 409)
            self.assertEqual(client.get(f'/api/devices/{device}').json()['components'][0]['closed_at'], None, 'El ensamble fallido hace rollback')
            self.assertEqual(client.post('/api/assemblies', json=data).status_code, 201)
            self.assertEqual(client.post('/api/assemblies', json=data).status_code, 409)
            self.assertEqual(next(p for p in client.get('/api/products').json() if p['id'] == product['id'])['stock'], product['stock'] + 1)
            login(client, 'cliente')
            self.assertEqual(client.get(f'/api/devices/{device}').status_code, 403)
            self.assertEqual(client.get('/uploads/' + evidence['filename']).status_code, 403)

    def test_cash_sale_product_management_and_rejection(self):
        with TestClient(app) as client:
            login(client, 'admin')
            self.assertEqual(client.post('/api/product-categories', json={'name': 'Carritos', 'description': 'Producto de prueba autorizado', 'model': 'Producto de prueba'}).status_code, 201)
            login(client, 'inventario')
            product = {'sku': 'TEST-CASH', 'name': 'Producto de prueba', 'description': 'Producto de prueba autorizado', 'category': 'Carritos', 'condition': 'NUEVO', 'price_cents': 1001}
            product_id = client.post('/api/products', json=product).json()['id']
            self.assertEqual(client.post(f'/api/products/{product_id}/stock', json={'quantity': 2, 'reason': 'Ingreso de prueba'}).status_code, 200)
            login(client, 'cliente')
            data = {'payment_type': 'CONTADO', 'items': [{'product_id': product_id, 'quantity': 1}]}
            order_id = client.post('/api/orders', json=data).json()['id']
            login(client, 'finanzas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 403)
            login(client, 'ventas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True}).status_code, 200)
            self.assertEqual(client.post(f'/api/orders/{order_id}/cancel').status_code, 409)
            login(client, 'inventario')
            self.assertEqual(client.put(f'/api/products/{product_id}', json={**product, 'price_cents': 1200}).status_code, 200)
            login(client, 'cliente')
            self.assertEqual(client.get(f'/api/orders/{order_id}').json()['items'][0]['price_cents'], 1001)
            pending = client.post('/api/orders', json=data).json()['id']
            login(client, 'ventas')
            self.assertEqual(client.post(f'/api/orders/{pending}/decision', json={'approve': False, 'reason': 'no'}).status_code, 422)
            self.assertEqual(client.post(f'/api/orders/{pending}/decision', json={'approve': False, 'reason': 'Solicitud duplicada de prueba'}).status_code, 200)
            login(client, 'inventario')
            self.assertEqual(client.post(f'/api/products/{product_id}/toggle').status_code, 200)
            login(client, 'cliente')
            self.assertFalse(any(p['id'] == product_id for p in client.get('/api/products').json()))
            self.assertEqual(client.post('/api/orders', json=data).status_code, 409)
