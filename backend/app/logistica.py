"""Red circular, lotes, recolecciones y movimientos atómicos entre centros."""
import json
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from .base_datos import connection
from .seguridad import current_user, require_roles
from .validaciones import Input, DeviceInput
from .servicios import event
from .servicios_negocio import audit
from .flujo import maximum_flow

router = APIRouter(prefix='/api', tags=['Red circular'])
operator = require_roles('inventory', 'sales', 'technician')
period_field = dict(pattern=r'^20\d{2}-(0[1-9]|1[0-2])$')


class CenterInput(Input):
    name: str = Field(min_length=3, max_length=100)
    kind: Literal['RECOLECCION', 'TALLER', 'RECICLAJE', 'DISPOSICION', 'BENEFICIARIO']
    capacity: int = Field(gt=0, le=1000000, strict=True)


class EdgeInput(Input):
    source_id: int = Field(gt=0)
    target_id: int = Field(gt=0)
    capacity: int = Field(gt=0, le=1000000, strict=True)


class FlowInput(Input):
    source_id: int = Field(gt=0)
    sink_id: int = Field(gt=0)
    scenario: str = Field(min_length=3, max_length=100)
    period: str = Field(**period_field)
    capacity_factor: int = Field(default=1, ge=1, le=10, strict=True)


class CollectionInput(Input):
    client_id: int | None = Field(default=None, gt=0)
    description: str = Field(min_length=5, max_length=500)
    pickup_address: str = Field(default='Entrega presencial en AWStore', min_length=5, max_length=250)


class BatchInput(Input):
    client_id: int = Field(gt=0)
    center_id: int = Field(gt=0)
    collection_id: int | None = Field(default=None, gt=0)
    devices: list[DeviceInput] = Field(min_length=1, max_length=100)
    send_to_workshop: bool = False


class TransferInput(Input):
    edge_id: int = Field(gt=0)
    period: str = Field(**period_field)
    device_ids: list[int] = Field(min_length=1, max_length=100)


def require_row(db, table, record_id):
    # Solo nombres internos, nunca entradas HTTP.
    row = db.execute(f'SELECT * FROM {table} WHERE id=?', (record_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Registro relacionado no encontrado.')
    return row


def center_usage(db, center_id, period):
    row = db.execute('''SELECT
        coalesce(sum(CASE WHEN e.source_id=? THEN 1 ELSE 0 END),0) AS outgoing,
        coalesce(sum(CASE WHEN e.target_id=? THEN 1 ELSE 0 END),0) AS incoming
        FROM transfers t JOIN network_edges e ON e.id=t.edge_id JOIN transfer_items i ON i.transfer_id=t.id
        WHERE t.period=? AND t.status IN ('PENDIENTE','CONFIRMADO')''', (center_id, center_id, period)).fetchone()
    return dict(row)


@router.get('/network')
def network(user=Depends(operator)):
    with connection() as db:
        return {
            'nodes': [dict(r) for r in db.execute('SELECT c.*, (SELECT count(*) FROM devices d WHERE d.center_id=c.id) AS inventory FROM centers c ORDER BY c.id')],
            'edges': [dict(r) for r in db.execute('SELECT e.*,s.name AS source_name,t.name AS target_name FROM network_edges e JOIN centers s ON s.id=e.source_id JOIN centers t ON t.id=e.target_id ORDER BY e.id')],
            'runs': [dict(r) for r in db.execute('SELECT id,scenario,period,created_at,result_json FROM flow_runs ORDER BY id DESC LIMIT 20')],
        }


@router.get('/circular-metrics')
def circular_metrics(user=Depends(operator)):
    with connection() as db:
        total = db.execute('SELECT count(*) FROM devices').fetchone()[0]
        closed = db.execute("SELECT count(*) FROM devices WHERE status='CERRADO'").fetchone()[0]
        return {
            'devices': total, 'closed': closed, 'traceability_percent': round(100 * closed / total, 2) if total else 0,
            'classification': [dict(r) for r in db.execute('SELECT classification,count(*) AS quantity FROM vw_device_classification GROUP BY classification')],
            'destinations': [dict(r) for r in db.execute('SELECT destination_type,count(*) AS quantity FROM components WHERE closed_at IS NOT NULL GROUP BY destination_type')],
            'inventory': [dict(r) for r in db.execute('SELECT * FROM vw_inventory_value')],
        }


@router.post('/centers', status_code=201)
def create_center(data: CenterInput, user=Depends(require_roles())):
    with connection() as db:
        cur = db.execute('INSERT INTO centers(name,kind,capacity) VALUES (?,?,?)', (data.name, data.kind, data.capacity))
        audit(db, user, 'Centro creado', data.name)
        return {'id': cur.lastrowid}


@router.post('/network/edges', status_code=201)
def create_edge(data: EdgeInput, user=Depends(require_roles())):
    with connection() as db:
        source = require_row(db, 'centers', data.source_id)
        target = require_row(db, 'centers', data.target_id)
        if data.source_id == data.target_id or data.capacity > min(source['capacity'], target['capacity']):
            raise HTTPException(422, 'La conexión necesita centros diferentes y capacidad compatible con ambos.')
        cur = db.execute('INSERT INTO network_edges(source_id,target_id,capacity) VALUES (?,?,?)', (data.source_id, data.target_id, data.capacity))
        audit(db, user, 'Conexión creada', f'{data.source_id} → {data.target_id}')
        return {'id': cur.lastrowid}


@router.post('/network/analyze', status_code=201)
def analyze(data: FlowInput, user=Depends(require_roles('inventory'))):
    with connection() as db:
        nodes = [dict(r) for r in db.execute('SELECT * FROM centers WHERE active=1')]
        edges = [dict(r) for r in db.execute('''SELECT e.id,e.source_id,e.target_id,
            max(0,e.capacity-coalesce(u.used,0)) AS capacity FROM network_edges e
            JOIN centers s ON s.id=e.source_id AND s.active=1 JOIN centers t ON t.id=e.target_id AND t.active=1
            LEFT JOIN vw_transfer_usage u ON u.edge_id=e.id AND u.period=?''', (data.period,))]
        # Node splitting: cada centro limita también el flujo que puede procesar.
        split_nodes = [{'id': n['id'] * 2} for n in nodes] + [{'id': n['id'] * 2 + 1} for n in nodes]
        usage = {n['id']: center_usage(db, n['id'], data.period) for n in nodes}
        split_edges = [{'id': -n['id'], 'source_id': n['id'] * 2, 'target_id': n['id'] * 2 + 1, 'capacity': max(0, n['capacity'] - max(usage[n['id']].values())) * data.capacity_factor} for n in nodes]
        split_edges += [{**e, 'source_id': e['source_id'] * 2 + 1, 'target_id': e['target_id'] * 2, 'capacity': e['capacity'] * data.capacity_factor} for e in edges]
        try:
            result = maximum_flow(split_nodes, split_edges, data.source_id * 2, data.sink_id * 2 + 1)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        edge_by_id = {e['id']: e for e in edges}
        result['node_flows'] = [{'center_id': -e['id'], 'flow': e['flow'], 'capacity': e['capacity']} for e in result['edges'] if e['id'] < 0]
        result['edges'] = [{**e, 'source_id': edge_by_id[e['id']]['source_id'], 'target_id': edge_by_id[e['id']]['target_id']} for e in result['edges'] if e['id'] > 0]
        result['bottleneck_centers'] = [-i for i in result['min_cut_edges'] if i < 0]
        result['min_cut_edges'] = [i for i in result['min_cut_edges'] if i > 0]
        snapshot = {'nodes': nodes, 'node_usage': usage, 'edges': edges, **data.model_dump()}
        cur = db.execute('INSERT INTO flow_runs(scenario,source_id,sink_id,period,input_json,result_json,user_id) VALUES (?,?,?,?,?,?,?)', (data.scenario, data.source_id, data.sink_id, data.period, json.dumps(snapshot), json.dumps(result), user['id']))
        audit(db, user, 'Análisis de capacidad', f'Escenario #{cur.lastrowid}: flujo máximo {result["max_flow"]}')
        return {'id': cur.lastrowid, **result}


@router.get('/collections')
def collections(user=Depends(require_roles('client', 'sales', 'inventory'))):
    with connection() as db:
        sql, args = '''SELECT c.*, cl.name AS client_name, u.name AS approved_by_name,
            (SELECT json_group_array(json_object('code', d.code, 'model', d.model, 'status', d.status))
             FROM devices d WHERE d.batch_id=b.id AND d.client_id=c.client_id) AS devices
            FROM collections c JOIN clients cl ON cl.id=c.client_id
            LEFT JOIN collection_approvals a ON a.collection_id=c.id
            LEFT JOIN users u ON u.id=a.approved_by
            LEFT JOIN batches b ON b.collection_id=c.id''', ()
        if user['role'] == 'client':
            sql += ' WHERE c.client_id=?'
            args = (user['client_id'],)
        return [dict(row, devices=json.loads(row['devices'])) for row in db.execute(sql + ' ORDER BY c.id DESC', args)]


@router.post('/collections/{collection_id}/approve')
def approve_collection(collection_id: int, user=Depends(require_roles('sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        collection = require_row(db, 'collections', collection_id)
        if collection['status'] != 'SOLICITADA':
            raise HTTPException(409, 'La solicitud ya fue procesada.')
        db.execute('INSERT OR IGNORE INTO collection_approvals(collection_id,approved_by) VALUES (?,?)',
                   (collection_id, user['id']))
    return {'message': 'Recolección aprobada.'}


@router.post('/collections', status_code=201)
def create_collection(data: CollectionInput, user=Depends(require_roles('client', 'sales'))):
    client_id = user['client_id'] if user['role'] == 'client' else data.client_id
    if not client_id:
        raise HTTPException(422, 'Selecciona un remitente.')
    with connection() as db:
        cur = db.execute('INSERT INTO collections(client_id,description,pickup_address,created_by) VALUES (?,?,?,?)', (client_id, data.description, data.pickup_address, user['id']))
        return {'id': cur.lastrowid}


@router.post('/batches', status_code=201)
def receive_batch(data: BatchInput, user=Depends(require_roles('sales'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        center = require_row(db, 'centers', data.center_id)
        occupancy = db.execute('SELECT count(*) FROM devices WHERE center_id=?', (data.center_id,)).fetchone()[0]
        if not center['active'] or occupancy + len(data.devices) > center['capacity']:
            raise HTTPException(409, 'El centro no tiene capacidad para recibir este lote.')
        if data.send_to_workshop and (not data.collection_id or center['kind'] != 'TALLER'):
            raise HTTPException(422, 'Selecciona un taller y una solicitud aprobada.')
        if any(d.client_id != data.client_id for d in data.devices):
            raise HTTPException(422, 'Todos los equipos deben pertenecer al remitente del lote.')
        if data.collection_id:
            collection = require_row(db, 'collections', data.collection_id)
            if collection['status'] != 'SOLICITADA' or collection['client_id'] != data.client_id:
                raise HTTPException(409, 'La solicitud no corresponde al lote o ya fue procesada.')
            if not db.execute('SELECT 1 FROM collection_approvals WHERE collection_id=?', (data.collection_id,)).fetchone():
                raise HTTPException(409, 'Aprueba primero la solicitud en Recepción RAEE.')
            db.execute("UPDATE collections SET status='RECIBIDA' WHERE id=?", (data.collection_id,))
        code = 'LOTE-' + uuid.uuid4().hex[:12].upper()
        batch_id = db.execute('INSERT INTO batches(code,client_id,center_id,collection_id,created_by) VALUES (?,?,?,?,?)', (code, data.client_id, data.center_id, data.collection_id, user['id'])).lastrowid
        ids = []
        for item in data.devices:
            device_id = db.execute('INSERT INTO devices(code,model,category,client_id,notes,center_id,batch_id,location) VALUES (?,?,?,?,?,?,?,?)', ('RAEE-' + uuid.uuid4().hex[:12].upper(), item.model, item.category, data.client_id, item.notes, data.center_id, batch_id, center['name'])).lastrowid
            ids.append(device_id)
            event(db, device_id, 'Recepción por lote', f'{code}; centro {center["name"]}', user['name'])
            if data.send_to_workshop:
                db.execute("UPDATE devices SET status='EN_EVALUACION' WHERE id=?", (device_id,))
                event(db, device_id, 'Envío a diagnóstico', 'Equipo recibido en taller y pendiente de diagnóstico.', user['name'])
        audit(db, user, 'Lote recibido', f'{code}; {len(ids)} equipos')
        return {'id': batch_id, 'code': code, 'device_ids': ids}


@router.get('/transfers')
def transfers(user=Depends(operator)):
    with connection() as db:
        return [dict(r) for r in db.execute('''SELECT t.*,s.name AS source_name,d.name AS target_name,
            (SELECT count(*) FROM transfer_items i WHERE i.transfer_id=t.id) AS quantity
            FROM transfers t JOIN network_edges e ON e.id=t.edge_id JOIN centers s ON s.id=e.source_id JOIN centers d ON d.id=e.target_id ORDER BY t.id DESC''')]


@router.post('/transfers', status_code=201)
def create_transfer(data: TransferInput, user=Depends(require_roles('inventory'))):
    if len(set(data.device_ids)) != len(data.device_ids):
        raise HTTPException(422, 'No repitas equipos en la transferencia.')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        edge = require_row(db, 'network_edges', data.edge_id)
        used = db.execute('SELECT used FROM vw_transfer_usage WHERE edge_id=? AND period=?', (edge['id'], data.period)).fetchone()
        if (used['used'] if used else 0) + len(data.device_ids) > edge['capacity']:
            raise HTTPException(409, 'La transferencia supera la capacidad disponible de la conexión.')
        target = require_row(db, 'centers', edge['target_id'])
        source = require_row(db, 'centers', edge['source_id'])
        if not target['active'] or not source['active']:
            raise HTTPException(409, 'Los centros deben estar activos.')
        if center_usage(db, source['id'], data.period)['outgoing'] + len(data.device_ids) > source['capacity'] or center_usage(db, target['id'], data.period)['incoming'] + len(data.device_ids) > target['capacity']:
            raise HTTPException(409, 'La transferencia supera la capacidad mensual de un centro.')
        for device_id in data.device_ids:
            device = require_row(db, 'devices', device_id)
            if device['center_id'] != edge['source_id'] or device['active_transfer_id'] or device['status'] == 'CERRADO':
                raise HTTPException(409, 'Un equipo no está disponible en el centro de origen.')
            if target['kind'] == 'BENEFICIARIO':
                parts = db.execute('SELECT classification FROM components WHERE device_id=?', (device_id,)).fetchall()
                if device['status'] != 'CLASIFICADO' or not parts or any(p['classification'] != 'REUTILIZABLE' for p in parts):
                    raise HTTPException(422, 'Solo equipos evaluados con todas sus piezas reutilizables pueden ir a un beneficiario.')
        transfer_id = db.execute('INSERT INTO transfers(edge_id,period,created_by) VALUES (?,?,?)', (edge['id'], data.period, user['id'])).lastrowid
        for device_id in data.device_ids:
            db.execute('INSERT INTO transfer_items VALUES (?,?)', (transfer_id, device_id))
            db.execute('UPDATE devices SET active_transfer_id=? WHERE id=?', (transfer_id, device_id))
            event(db, device_id, 'Transferencia pendiente', f'#{transfer_id}: {source["name"]} → {target["name"]}', user['name'])
        return {'id': transfer_id}


@router.post('/transfers/{transfer_id}/confirm')
def confirm_transfer(transfer_id: int, user=Depends(require_roles('inventory'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        transfer = require_row(db, 'transfers', transfer_id)
        if transfer['status'] != 'PENDIENTE':
            raise HTTPException(409, 'La transferencia ya fue procesada.')
        edge = require_row(db, 'network_edges', transfer['edge_id'])
        target = require_row(db, 'centers', edge['target_id'])
        ids = [r[0] for r in db.execute('SELECT device_id FROM transfer_items WHERE transfer_id=?', (transfer_id,))]
        current = db.execute('SELECT count(*) FROM devices WHERE center_id=?', (target['id'],)).fetchone()[0]
        if current + len(ids) > target['capacity']:
            raise HTTPException(409, 'El centro de destino no tiene espacio disponible.')
        for device_id in ids:
            device = require_row(db, 'devices', device_id)
            if device['active_transfer_id'] != transfer_id or device['center_id'] != edge['source_id']:
                raise HTTPException(409, 'El origen del equipo ya no coincide con la transferencia.')
            if not db.execute('SELECT 1 FROM evidence WHERE device_id=?', (device_id,)).fetchone():
                raise HTTPException(409, 'Cada equipo necesita evidencia antes de confirmar el movimiento.')
            db.execute('UPDATE devices SET center_id=?,location=?,active_transfer_id=NULL WHERE id=?', (target['id'], target['name'], device_id))
            event(db, device_id, 'Transferencia confirmada', f'#{transfer_id}; recepción en {target["name"]}', user['name'])
        db.execute("UPDATE transfers SET status='CONFIRMADO',confirmed_by=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?", (user['id'], transfer_id))
        audit(db, user, 'Transferencia confirmada', f'#{transfer_id}; {len(ids)} equipos')
        return {'message': 'Origen y destino actualizados en una sola transacción.'}


@router.post('/transfers/{transfer_id}/cancel')
def cancel_transfer(transfer_id: int, user=Depends(require_roles('inventory'))):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        transfer = require_row(db, 'transfers', transfer_id)
        if transfer['status'] != 'PENDIENTE':
            raise HTTPException(409, 'Solo puedes cancelar una transferencia pendiente.')
        db.execute("UPDATE transfers SET status='CANCELADO' WHERE id=?", (transfer_id,))
        for row in db.execute('SELECT device_id FROM transfer_items WHERE transfer_id=?', (transfer_id,)).fetchall():
            db.execute('UPDATE devices SET active_transfer_id=NULL WHERE id=?', (row['device_id'],))
            event(db, row['device_id'], 'Transferencia cancelada', f'#{transfer_id}', user['name'])
        return {'message': 'Transferencia cancelada. Capacidad liberada.'}
