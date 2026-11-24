"""Registro público, checkout de prueba y administración sin elevar privilegios."""
import unittest
from test_flujo import app, connection
from test_negocio import login
from fastapi.testclient import TestClient


class StorefrontTests(unittest.TestCase):
    def register(self, client, email):
        data = {'name': 'Visitante de prueba', 'email': email, 'password': 'ClaveDemo123!'}
        response = client.post('/api/auth/register', json=data)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()['role'], 'client')
        return data

    def product(self, client, sku):
        login(client, 'admin')
        data = {'sku': sku, 'name': 'Producto tienda de prueba', 'description': '', 'category': 'Carritos', 'condition': 'NUEVO', 'price_cents': 1001}
        product_id = client.post('/api/products', json=data).json()['id']
        client.post(f'/api/products/{product_id}/stock', json={'quantity': 3, 'reason': 'Ingreso para prueba de tienda'})
        client.post('/api/auth/logout')
        return product_id

    def test_public_registration_and_cash_checkout_are_atomic_and_idempotent(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/catalog').status_code, 200)
            self.assertEqual(client.get('/api/products').status_code, 401)
            product_id = self.product(client, 'TEST-STORE-CASH')
            account = self.register(client, 'visitante-tienda@example.test')
            self.assertEqual(client.post('/api/auth/register', json={**account, 'role': 'admin'}).status_code, 422)
            self.assertEqual(client.post('/api/auth/register', json=account).status_code, 409)
            data = {'payment_type': 'CONTADO', 'items': [{'product_id': product_id, 'quantity': 1}], 'request_key': 'checkout-atomic-test-0001', 'delivery_mode': 'ENTREGA', 'delivery_address': 'Calle ficticia 123, sector de prueba', 'contact_phone': '0990000000'}
            self.assertEqual(client.post('/api/checkout', json=data).status_code, 422)
            invalid_delivery = {**data, 'demo_payment_confirmed': True, 'delivery_address': ' '}
            self.assertEqual(client.post('/api/checkout', json=invalid_delivery).status_code, 422)
            self.assertEqual(client.get('/api/orders').json(), [])
            response = client.post('/api/checkout', json={**data, 'demo_payment_confirmed': True})
            self.assertEqual(response.status_code, 201, response.text)
            order_id = response.json()['id']
            repeated = client.post('/api/checkout', json={**data, 'demo_payment_confirmed': True})
            self.assertEqual(repeated.json()['id'], order_id)
            self.assertEqual(len(client.get('/api/orders').json()), 1)
            detail = client.get(f'/api/orders/{order_id}').json()
            self.assertEqual(detail['status'], 'CONFIRMADO')
            self.assertEqual(detail['cash_receipt']['amount_cents'], 1001)
            self.assertEqual(detail['delivery_address'], data['delivery_address'])
            self.assertEqual(client.post(f'/api/orders/{order_id}/deliver').status_code, 403)
            login(client, 'ventas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/deliver').status_code, 200)
            self.assertEqual(client.post(f'/api/orders/{order_id}/deliver').status_code, 409)
            with connection() as db:
                self.assertEqual(db.execute('SELECT stock FROM products WHERE id=?', (product_id,)).fetchone()[0], 2)
                self.assertEqual(db.execute('SELECT count(*) FROM cash_receipts WHERE order_id=?', (order_id,)).fetchone()[0], 1)

    def test_finance_defines_approved_installments(self):
        with TestClient(app) as client:
            product_id = self.product(client, 'TEST-STORE-CREDIT')
            self.register(client, 'credito-tienda@example.test')
            data = {'payment_type': 'CREDITO', 'installments': 3, 'items': [{'product_id': product_id, 'quantity': 1}], 'request_key': 'checkout-credit-test-0001'}
            order_id = client.post('/api/checkout', json=data).json()['id']
            login(client, 'finanzas')
            self.assertEqual(client.post(f'/api/orders/{order_id}/decision', json={'approve': True, 'installments': 6}).status_code, 200)
            detail = client.get(f'/api/orders/{order_id}').json()
            self.assertEqual(detail['installments'], 6)
            self.assertEqual(len(detail['installments_detail']), 6)
            self.assertEqual(sum(i['amount_cents'] for i in detail['installments_detail']), 1001)

    def test_employee_accounts_are_administered_and_sessions_are_revoked(self):
        with TestClient(app) as client:
            data = self.register(client, 'cuenta-gestion@example.test')
            account = client.get('/api/auth/me').json()
            previous_cookie = client.cookies.get('ecoraee_session')
            login(client, 'admin')
            admin_id = client.get('/api/auth/me').json()['id']
            self.assertEqual(client.post(f'/api/users/{admin_id}/toggle').status_code, 409)
            self.assertEqual(client.post(f"/api/users/{account['id']}/toggle").status_code, 200)
            client.cookies.set('ecoraee_session', previous_cookie)
            self.assertEqual(client.get('/api/auth/me').status_code, 401)
            client.cookies.clear()
            self.assertEqual(client.post('/api/auth/login', json={'email': data['email'], 'password': data['password']}).status_code, 401)
            login(client, 'admin')
            self.assertEqual(client.post(f"/api/users/{account['id']}/toggle").status_code, 200)
            edited = {'name': 'Empleado de prueba', 'email': data['email'], 'role': 'sales', 'client_id': None}
            self.assertEqual(client.put(f"/api/users/{account['id']}", json=edited).status_code, 200)
            client.post('/api/auth/logout')
            credentials = {'email': data['email'], 'password': data['password'], 'portal': 'client'}
            self.assertEqual(client.post('/api/auth/login', json=credentials).status_code, 200)
            self.assertEqual(client.post('/api/auth/login', json={**credentials, 'portal': 'staff'}).status_code, 200)
            self.assertEqual(client.get('/api/auth/me').json()['role'], 'sales')
