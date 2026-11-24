import unittest
from fastapi.testclient import TestClient
from test_flujo import app
from test_negocio import login


class ProductCatalogTests(unittest.TestCase):
    def test_inventory_builds_specs_and_corrects_description(self):
        with TestClient(app) as client:
            login(client, 'inventario')
            category = client.post('/api/product-categories/register', json={'name': '  Computadoras  '})
            self.assertEqual(category.status_code, 201)
            self.assertFalse(category.json()['created'])
            data = {'sku': 'SPEC-TEST-001', 'name': 'Modelo Nuevo 15', 'category': category.json()['name'], 'condition': 'NUEVO', 'price_cents': 55000, 'description': 'Texto enviado que el servidor reemplaza', 'specifications': {'ram': '16 GB', 'storage': '512 GB', 'storage_type': 'SSD NVMe'}}
            result = client.post('/api/products', json=data)
            self.assertEqual(result.status_code, 201, result.text)
            product_id = result.json()['id']
            product = next(p for p in client.get('/api/products').json() if p['id'] == product_id)
            self.assertIn('Memoria RAM: 16 GB', product['description'])
            self.assertIn('Almacenamiento: 512 GB', product['description'])
            self.assertEqual(client.put(f'/api/products/{product_id}', json={**data, 'specifications': {'ram': '999 GB'}}).status_code, 422)
            self.assertEqual(client.put(f'/api/products/{product_id}', json={**data, 'category': 'Monitores'}).status_code, 422)
            corrected = {**data, 'description': 'Modelo Nuevo 15 con teclado en español y SSD de 512 GB.', 'description_edit_reason': 'Se añade la distribución verificada del teclado'}
            self.assertEqual(client.put(f'/api/products/{product_id}', json=corrected).status_code, 200)
            saved = next(p for p in client.get('/api/products').json() if p['id'] == product_id)
            self.assertEqual(saved['description'], corrected['description'])
            self.assertEqual(saved['description_edit_reason'], corrected['description_edit_reason'])
            self.assertEqual(client.put(f'/api/products/{product_id}', json={**corrected, 'description_edit_reason': 'x'}).status_code, 422)

    def test_admin_manages_options_and_inventory_cannot_bypass_them(self):
        with TestClient(app) as client:
            login(client, 'admin')
            self.assertEqual(client.post('/api/product-categories', json={'name': 'Accesorios especiales', 'description': 'Accesorio probado para uso tecnológico', 'model': 'Accesorio de prueba'}).status_code, 201)
            login(client, 'inventario')
            self.assertEqual(client.post('/api/product-categories', json={'name': 'No autorizado', 'description': 'Texto cualquiera'}).status_code, 403)
            options = client.get('/api/product-categories')
            self.assertEqual(options.status_code, 200)
            self.assertTrue(any(row['name'] == 'Accesorios especiales' for row in options.json()))
            data = {'sku': 'TEST-CATALOG-VALID', 'name': 'Accesorio de prueba', 'description': 'Accesorio probado para uso tecnológico', 'category': 'Accesorios especiales', 'condition': 'NUEVO', 'price_cents': 1500}
            self.assertEqual(client.post('/api/products', json={**data, 'description': 'Descripción mal escrita'}).status_code, 422)
            self.assertEqual(client.post('/api/products', json={**data, 'category': 'Categoría inexistente'}).status_code, 422)
            self.assertEqual(client.post('/api/products', json={**data, 'name': 'Modelo mal escrito'}).status_code, 422)
            result = client.post('/api/products', json=data)
            self.assertEqual(result.status_code, 201, result.text)
            self.assertEqual(client.put(f"/api/products/{result.json()['id']}", json={**data, 'category': 'Computadoras'}).status_code, 422)
