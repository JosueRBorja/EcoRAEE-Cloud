"""Contratos de AWStore: autenticación, fotos, migraciones y logística transaccional."""
import io
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from PIL import Image
from fastapi.testclient import TestClient
from test_flujo import app, connection
from test_negocio import login
from backend.app.flujo import maximum_flow
from backend.app.base_datos import initialize


def png():
    output = io.BytesIO()
    Image.new('RGB', (24, 24), (30, 100, 220)).save(output, format='PNG')
    return output.getvalue()


class FlowTests(unittest.TestCase):
    def test_manual_network_and_two_scenarios(self):
        nodes = [{'id': i} for i in range(1, 5)]
        base = [(1, 2, 3), (1, 3, 2), (2, 3, 1), (2, 4, 2), (3, 4, 3)]
        for factor, expected in [(1, 5), (2, 10), (3, 15)]:
            edges = [{'id': i+1, 'source_id': u, 'target_id': v, 'capacity': c*factor} for i, (u, v, c) in enumerate(base)]
            result = maximum_flow(nodes, edges, 1, 4)
            self.assertEqual(result['max_flow'], expected)
            self.assertEqual(result['cut_capacity'], expected)
            for e in result['edges']:
                self.assertTrue(0 <= e['flow'] <= e['capacity'])
            for node in (2, 3):
                self.assertEqual(sum(e['flow'] for e in result['edges'] if e['target_id'] == node), sum(e['flow'] for e in result['edges'] if e['source_id'] == node))

    def test_antiparallel_edges_and_disconnected_sink(self):
        nodes = [{'id': n} for n in (1, 2, 3)]
        edges = [{'id': i, 'source_id': u, 'target_id': v, 'capacity': c} for i,u,v,c in [(1,1,2,4),(2,2,1,3),(3,2,3,2)]]
        self.assertEqual(maximum_flow(nodes, edges, 1, 3)['max_flow'], 2)
        self.assertEqual(maximum_flow(nodes, edges[:2], 1, 3)['max_flow'], 0)
        with self.assertRaises(ValueError): maximum_flow(nodes, edges, 1, 1)


class AWStoreTests(unittest.TestCase):
    def test_two_sales_cannot_consume_the_last_unit_twice(self):
        with TestClient(app) as first, TestClient(app) as second:
            login(first, 'admin'); login(second, 'admin')
            data = {'sku':'RACE-UNIT','name':'Última unidad prueba','description':'','category':'Computadoras','condition':'NUEVO','price_cents':1000}
            product = first.post('/api/products',json=data).json()['id']
            first.post(f'/api/products/{product}/stock',json={'quantity':1,'reason':'Existencia para concurrencia'})
            order = {'client_id':1,'payment_type':'CONTADO','installments':1,'items':[{'product_id':product,'quantity':1}]}
            orders = [client.post('/api/orders',json=order).json()['id'] for client in (first, second)]
            barrier = Barrier(2)
            def approve(pair):
                client, order_id = pair
                barrier.wait(timeout=10)
                return client.post(f'/api/orders/{order_id}/decision',json={'approve':True}).status_code
            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(approve,zip((first,second),orders)))
            self.assertEqual(sorted(statuses),[200,409])
            with connection() as db:
                self.assertEqual(db.execute('SELECT stock FROM products WHERE id=?',(product,)).fetchone()[0],0)
                self.assertEqual(db.execute("SELECT count(*) FROM orders WHERE id IN (?,?) AND status='CONFIRMADO'",orders).fetchone()[0],1)

    def test_cross_site_mutations_and_login_flood_are_denied(self):
        with TestClient(app) as client:
            response = client.post('/api/auth/login',json={'email':'admin@ecoraee.local','password':'Demo12345!'},headers={'origin':'https://untrusted.invalid'})
            self.assertEqual(response.status_code,403)
            for _ in range(10):
                self.assertEqual(client.post('/api/auth/login',json={'email':'limiter@example.test','password':'incorrecta'}).status_code,401)
            self.assertEqual(client.post('/api/auth/login',json={'email':'limiter@example.test','password':'incorrecta'}).status_code,429)

    def test_single_login_assigns_database_role_for_all_accounts(self):
        with TestClient(app) as client:
            for email, role in [('admin','admin'),('cliente','client'),('ventas','sales'),('tecnico','technician'),('inventario','inventory'),('finanzas','finance')]:
                response = client.post('/api/auth/login', json={'email': email.upper() + '@ECORAEE.LOCAL', 'password': 'Demo12345!'})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()['role'], role)
            self.assertEqual(client.post('/api/auth/login', json={'email': 'admin@ecoraee.local', 'password': 'Demo12345!', 'role': 'admin'}).status_code, 422)

    def test_product_photo_public_profile_private_and_invalid_image_rejected(self):
        with TestClient(app) as client:
            login(client, 'admin')
            product_id = client.get('/api/products').json()[0]['id']
            endpoint = f'/api/photos/products/{product_id}'
            self.assertEqual(client.post(endpoint, content=b'not a photo', headers={'content-type': 'image/png'}).status_code, 422)
            self.assertEqual(client.post(endpoint, content=b'<svg/>', headers={'content-type': 'image/svg+xml'}).status_code, 415)
            response = client.post(endpoint, content=png(), headers={'content-type': 'image/png'})
            self.assertEqual(response.status_code, 200, response.text)
            login(client, 'cliente')
            profile_id = client.get('/api/auth/me').json()['id']
            profile = f'/api/photos/users/{profile_id}'
            self.assertEqual(client.post(profile, content=png(), headers={'content-type':'image/png'}).status_code, 200)
            self.assertEqual(client.post(endpoint, content=png(), headers={'content-type':'image/png'}).status_code, 403)
            client.post('/api/auth/logout')
            public = client.get(endpoint)
            self.assertEqual(public.status_code, 200)
            self.assertEqual(public.headers['content-type'], 'image/jpeg')
            self.assertEqual(client.get(profile).status_code, 401)
            login(client, 'ventas')
            self.assertEqual(client.get(profile).status_code, 403)
            login(client, 'admin')
            self.assertEqual(client.delete(endpoint).status_code, 200)
            self.assertEqual(client.get(endpoint).status_code, 404)

    def test_batch_transfer_capacity_evidence_and_rollback(self):
        with TestClient(app) as client:
            login(client, 'admin')
            origin = client.post('/api/centers', json={'name':'Origen prueba logística','kind':'RECOLECCION','capacity':10}).json()['id']
            target = client.post('/api/centers', json={'name':'Destino prueba logística','kind':'TALLER','capacity':10}).json()['id']
            edge = client.post('/api/network/edges', json={'source_id':origin,'target_id':target,'capacity':2}).json()['id']
            batch = {'client_id':1,'center_id':origin,'devices':[{'model':f'Laptop lote {i}','category':'Computadoras','client_id':1} for i in range(3)]}
            response = client.post('/api/batches', json=batch)
            self.assertEqual(response.status_code, 201, response.text)
            ids = response.json()['device_ids']
            data = {'edge_id':edge,'period':'2026-11','device_ids':ids}
            self.assertEqual(client.post('/api/transfers', json=data).status_code, 409)
            data['device_ids'] = ids[:2]
            transfer = client.post('/api/transfers', json=data)
            self.assertEqual(transfer.status_code, 201, transfer.text)
            transfer_id = transfer.json()['id']
            # Una evidencia faltante debe revertir también el primer equipo actualizado.
            client.post(f'/api/devices/{ids[0]}/evidence', content=png(), headers={'content-type':'image/png'})
            self.assertEqual(client.post(f'/api/transfers/{transfer_id}/confirm').status_code, 409)
            with connection() as db:
                self.assertEqual([r[0] for r in db.execute('SELECT center_id FROM devices WHERE id IN (?,?)', ids[:2])], [origin, origin])
            client.post(f'/api/devices/{ids[1]}/evidence', content=png(), headers={'content-type':'image/png'})
            self.assertEqual(client.post(f'/api/transfers/{transfer_id}/confirm').status_code, 200)
            self.assertEqual(client.post(f'/api/transfers/{transfer_id}/confirm').status_code, 409)
            self.assertEqual(client.post('/api/transfers', json={**data,'device_ids':[ids[2]]}).status_code, 409)
            analysis = client.post('/api/network/analyze', json={'source_id':origin,'sink_id':target,'scenario':'Después del movimiento','period':'2026-11'})
            self.assertEqual(analysis.status_code, 201, analysis.text)
            self.assertEqual(analysis.json()['max_flow'], 0)

    def test_migrations_keep_existing_records_and_are_repeatable(self):
        with TestClient(app):
            with connection() as db:
                before = [tuple(r) for r in db.execute('SELECT id,sku,price_cents,stock FROM products ORDER BY id')]
            initialize(); initialize()
            with connection() as db:
                self.assertEqual(before, [tuple(r) for r in db.execute('SELECT id,sku,price_cents,stock FROM products ORDER BY id')])
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_no_recoverable_cannot_go_to_beneficiary(self):
        with TestClient(app) as client:
            login(client, 'admin')
            device = client.post('/api/devices', json={'model':'Batería de prueba','category':'Componentes','client_id':1}).json()['id']
            client.post(f'/api/devices/{device}/workshop')
            client.post(f'/api/devices/{device}/evaluation', json={'technician':'Técnico prueba','notes':'Componente no recuperable','components':[{'name':'Batería','classification':'NO_RECUPERABLE'}]})
            part = client.get(f'/api/devices/{device}').json()['components'][0]['id']
            client.post(f'/api/devices/{device}/evidence', content=png(), headers={'content-type':'image/png'})
            response = client.post(f'/api/components/{part}/close', json={'destination':'Beneficiario demo','responsible':'No suplantar','destination_type':'BENEFICIARIO'})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(client.get(f'/api/devices/{device}').json()['status'], 'CLASIFICADO')

    def test_client_collection_is_scoped_to_authenticated_account(self):
        with TestClient(app) as client:
            login(client, 'cliente')
            response = client.post('/api/collections', json={'client_id':2,'description':'Laptop para recolección','pickup_address':'Dirección sintética de prueba'})
            self.assertEqual(response.status_code, 201)
            records = client.get('/api/collections').json()
            self.assertTrue(all(r['client_id'] == client.get('/api/auth/me').json()['client_id'] for r in records))
            self.assertEqual(client.get('/api/network').status_code, 403)
            self.assertEqual(client.post('/api/centers', json={'name':'No permitido','kind':'TALLER','capacity':2}).status_code, 403)

    def test_collection_tracks_each_device_after_sales_approval(self):
        with TestClient(app) as client:
            login(client, 'cliente')
            owner = client.get('/api/auth/me').json()['client_id']
            request = client.post('/api/collections', json={
                'description': 'Otro equipo: UPS',
            })
            self.assertEqual(request.status_code, 201)
            collection_id = request.json()['id']
            approve = f'/api/collections/{collection_id}/approve'
            self.assertEqual(client.post(approve).status_code, 403)
            login(client, 'ventas')
            center = next(node for node in client.get('/api/network').json()['nodes'] if node['kind'] == 'TALLER')
            batch = {
                'client_id': owner, 'center_id': center['id'], 'collection_id': collection_id,
                'send_to_workshop': True,
                'devices': [{'client_id': owner, 'model': model, 'category': 'Equipo tecnológico'}
                            for model in ['Portátil', 'Monitor']],
            }
            self.assertEqual(client.post('/api/batches', json=batch).status_code, 409)
            self.assertEqual(client.post(approve).status_code, 200)
            received = client.post('/api/batches', json=batch)
            self.assertEqual(received.status_code, 201, received.text)
            login(client, 'tecnico')
            first_id = received.json()['device_ids'][0]
            evaluated = client.post(f'/api/devices/{first_id}/evaluation', json={
                'technician': 'Técnico', 'notes': 'Diagnóstico de prueba',
                'components': [{'name': 'Pantalla', 'classification': 'RECICLABLE'}],
            })
            self.assertEqual(evaluated.status_code, 201, evaluated.text)
            login(client, 'cliente')
            tracked = next(row for row in client.get('/api/collections').json() if row['id'] == collection_id)
            self.assertEqual(tracked['status'], 'RECIBIDA')
            self.assertEqual({row['model']: row['status'] for row in tracked['devices']},
                             {'Portátil': 'CLASIFICADO', 'Monitor': 'EN_EVALUACION'})
            self.assertEqual(len({row['code'] for row in tracked['devices']}), 2)
