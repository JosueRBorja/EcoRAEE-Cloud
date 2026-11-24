"""Pruebas de integración con base y evidencias temporales; no alteran la demo."""
import os
import tempfile
import unittest
from pathlib import Path

TEMP = tempfile.TemporaryDirectory()
os.environ['ECORAEE_DB'] = str(Path(TEMP.name) / 'test.db')
os.environ['ECORAEE_UPLOADS'] = str(Path(TEMP.name) / 'uploads')
os.environ['ECORAEE_MEDIA'] = str(Path(TEMP.name) / 'media')

from fastapi.testclient import TestClient
from backend.app.principal import app
from backend.app.base_datos import connection


class WorkflowTests(unittest.TestCase):
    def test_complete_workflow_and_constraints(self):
        with TestClient(app) as client:
            self.assertEqual(client.post('/api/auth/login', json={'email': 'admin@ecoraee.local', 'password': 'Demo12345!'}).status_code, 200)
            generator = {'name': 'Generador de prueba', 'document': 'PRUEBA-101', 'phone': '', 'address': 'Sector de prueba'}
            response = client.post('/api/clients', json=generator)
            self.assertEqual(response.status_code, 201)
            generator_id = response.json()['id']
            self.assertEqual(client.post('/api/clients', json=generator).status_code, 409)
            self.assertEqual(client.post('/api/clients', json={**generator, 'name': ' '}).status_code, 422)
            self.assertEqual(client.put(f'/api/clients/{generator_id}', json={**generator, 'phone': '0990000000'}).status_code, 200)
            device_data = {'model': 'Carrito de prueba', 'category': 'Vehículo infantil', 'client_id': generator_id, 'notes': ''}
            device = client.post('/api/devices', json=device_data).json()
            device_id = device['id']
            self.assertEqual(client.delete(f'/api/clients/{generator_id}').status_code, 409)
            self.assertEqual(client.put(f'/api/devices/{device_id}', json={**device_data, 'notes': 'Editado'}).status_code, 200)
            evaluation = {'technician': 'Técnico demo', 'notes': 'Motor útil y batería dañada.', 'components': [
                {'name': 'Motor', 'classification': 'REUTILIZABLE', 'voltage': 12},
                {'name': 'Batería', 'classification': 'NO_RECUPERABLE', 'voltage': 0},
            ]}
            self.assertEqual(client.post(f'/api/devices/{device_id}/evaluation', json=evaluation).status_code, 409)
            self.assertEqual(client.post(f'/api/devices/{device_id}/workshop').status_code, 200)
            self.assertEqual(client.post(f'/api/devices/{device_id}/workshop').status_code, 409)
            self.assertEqual(client.delete(f'/api/devices/{device_id}').status_code, 409)
            bad = {**evaluation, 'components': [{**evaluation['components'][0], 'voltage': -1}]}
            self.assertEqual(client.post(f'/api/devices/{device_id}/evaluation', json=bad).status_code, 422)
            self.assertEqual(client.get(f'/api/devices/{device_id}').json()['components'], [])
            self.assertEqual(client.post(f'/api/devices/{device_id}/evaluation', json=evaluation).status_code, 201)
            self.assertEqual(client.post(f'/api/devices/{device_id}/evaluation', json=evaluation).status_code, 409)
            components = client.get(f'/api/devices/{device_id}').json()['components']
            closing = {'destination': 'Gestor demo', 'responsible': 'Logística demo'}
            self.assertEqual(client.post(f"/api/components/{components[0]['id']}/close", json=closing).status_code, 409)
            # PDF sintético solo para verificar subida, firma y persistencia local.
            upload = client.post(f'/api/devices/{device_id}/evidence', content=b'%PDF-1.4\n%%EOF', headers={'content-type': 'application/pdf'})
            self.assertEqual(upload.status_code, 201)
            self.assertEqual(client.get('/uploads/' + upload.json()['filename']).status_code, 200)
            self.assertEqual(client.post(f'/api/devices/{device_id}/evidence', content=b'fake', headers={'content-type': 'image/png'}).status_code, 422)
            for component in components:
                destination_type = 'DISPOSICION' if component['classification'] == 'NO_RECUPERABLE' else 'REUTILIZACION'
                self.assertEqual(client.post(f"/api/components/{component['id']}/close", json={**closing, 'destination_type': destination_type}).status_code, 200)
            final = client.get(f'/api/devices/{device_id}').json()
            self.assertEqual(final['status'], 'CERRADO')
            self.assertTrue(all(c['closed_at'] for c in final['components']))
            self.assertEqual(final['events'][-1]['action'], 'Cierre')
            self.assertEqual(client.post(f"/api/components/{components[0]['id']}/close", json=closing).status_code, 409)
            self.assertEqual(client.get('/api/devices/999999').status_code, 404)
            # Datos persistidos consultados desde una conexión nueva.
            with connection() as db:
                self.assertEqual(db.execute('SELECT status FROM devices WHERE id=?', (device_id,)).fetchone()[0], 'CERRADO')
            disposable = client.post('/api/devices', json=device_data).json()['id']
            self.assertEqual(client.delete(f'/api/devices/{disposable}').status_code, 200)
            independent = client.post('/api/clients', json={**generator, 'document': 'PRUEBA-102'}).json()['id']
            self.assertEqual(client.delete(f'/api/clients/{independent}').status_code, 200)

    def test_transaction_rolls_back(self):
        with TestClient(app):
            with self.assertRaises(RuntimeError):
                with connection() as db:
                    db.execute("INSERT INTO clients (name, document) VALUES ('Temporal rollback', 'ROLLBACK-TEST')")
                    raise RuntimeError('Fallo simulado antes del commit')
            with connection() as db:
                self.assertIsNone(db.execute("SELECT id FROM clients WHERE document='ROLLBACK-TEST'").fetchone())


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        TEMP.cleanup()
