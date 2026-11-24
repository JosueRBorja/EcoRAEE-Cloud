"""Endpoints HTTP. El SQL usa parámetros para no concatenar datos del usuario."""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from .base_datos import BASE, connection
from .validaciones import ClientInput, DeviceInput, EvaluationInput, CloseInput
from .servicios import get_device, event, evaluate, close_component
from .almacen_evidencias import save_evidence, delete_evidence

router = APIRouter(prefix='/api')
UPLOADS = Path(os.environ.get('ECORAEE_UPLOADS', str(BASE / 'uploads')))
UPLOADS.mkdir(parents=True, exist_ok=True)


@router.get('/clients')
def clients():
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT * FROM clients ORDER BY id DESC')]


@router.post('/clients', status_code=201)
def create_client(data: ClientInput):
    with connection() as db:
        cur = db.execute('INSERT INTO clients (name, document, phone, address) VALUES (?, ?, ?, ?)', tuple(data.model_dump().values()))
        return {'id': cur.lastrowid, **data.model_dump()}


@router.put('/clients/{client_id}')
def update_client(client_id: int, data: ClientInput):
    with connection() as db:
        cur = db.execute('UPDATE clients SET name=?, document=?, phone=?, address=? WHERE id=?', (*data.model_dump().values(), client_id))
        if cur.rowcount == 0:
            raise HTTPException(404, 'Generador no encontrado.')
        return {'id': client_id, **data.model_dump()}


@router.delete('/clients/{client_id}')
def delete_client(client_id: int):
    with connection() as db:
        if db.execute('DELETE FROM clients WHERE id=?', (client_id,)).rowcount == 0:
            raise HTTPException(404, 'Generador no encontrado.')
    return {'message': 'Generador eliminado.'}


@router.get('/devices')
def devices():
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT d.*, c.name AS client_name,v.classification FROM devices d JOIN clients c ON c.id=d.client_id JOIN vw_device_classification v ON v.device_id=d.id ORDER BY d.id DESC')]


@router.post('/devices', status_code=201)
def create_device(data: DeviceInput, request: Request):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        center = db.execute("SELECT * FROM centers WHERE kind='RECOLECCION' AND active=1 ORDER BY id LIMIT 1").fetchone()
        if center is None or db.execute('SELECT count(*) FROM devices WHERE center_id=?', (center['id'],)).fetchone()[0] >= center['capacity']:
            raise HTTPException(409, 'No hay capacidad en el centro de recepción.')
        code = 'RAEE-' + uuid.uuid4().hex[:8].upper()
        cur = db.execute('INSERT INTO devices (code, model, category, client_id, notes,center_id,location) VALUES (?, ?, ?, ?, ?,?,?)', (code, data.model, data.category, data.client_id, data.notes, center['id'], center['name']))
        event(db, cur.lastrowid, 'Recepción', 'Equipo recibido en Showroom. ' + data.notes, request.state.user['name'])
        return dict(get_device(db, cur.lastrowid))


@router.get('/devices/{device_id}')
def detail(device_id: int):
    with connection() as db:
        device = dict(get_device(db, device_id))
        for key, table in [('events', 'events'), ('components', 'components'), ('evidence', 'evidence')]:
            device[key] = [dict(r) for r in db.execute(f'SELECT * FROM {table} WHERE device_id=? ORDER BY id', (device_id,))]
        evaluation = db.execute('SELECT * FROM evaluations WHERE device_id=?', (device_id,)).fetchone()
        device['evaluation'] = dict(evaluation) if evaluation else None
        return device


@router.put('/devices/{device_id}')
def update_device(device_id: int, data: DeviceInput, request: Request):
    with connection() as db:
        if get_device(db, device_id)['status'] != 'RECEPCIONADO':
            raise HTTPException(409, 'Solo puedes editar la recepción antes de enviarla al taller.')
        db.execute('UPDATE devices SET model=?, category=?, client_id=?, notes=? WHERE id=?', (data.model, data.category, data.client_id, data.notes, device_id))
        event(db, device_id, 'Actualización', 'Datos de recepción actualizados.', request.state.user['name'])
        return dict(get_device(db, device_id))


@router.delete('/devices/{device_id}')
def delete_device(device_id: int):
    with connection() as db:
        if get_device(db, device_id)['status'] != 'RECEPCIONADO':
            raise HTTPException(409, 'No se puede eliminar un equipo que ya inició su tratamiento.')
        db.execute('DELETE FROM devices WHERE id=?', (device_id,))
    return {'message': 'Recepción eliminada.'}


@router.post('/devices/{device_id}/workshop')
def send_to_workshop(device_id: int, request: Request):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if get_device(db, device_id)['active_transfer_id']:
            raise HTTPException(409, 'Confirma o cancela la transferencia pendiente antes de enviar al taller.')
        if get_device(db, device_id)['status'] != 'RECEPCIONADO':
            raise HTTPException(409, 'El equipo ya fue enviado al taller.')
        db.execute("UPDATE devices SET status='EN_EVALUACION', location='Taller' WHERE id=?", (device_id,))
        event(db, device_id, 'Traslado al taller', 'Showroom → Taller. Pendiente de diagnóstico.', request.state.user['name'])
    return {'message': 'Equipo enviado al taller.'}


@router.post('/devices/{device_id}/evaluation', status_code=201)
def create_evaluation(device_id: int, data: EvaluationInput, request: Request):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if get_device(db, device_id)['active_transfer_id']:
            raise HTTPException(409, 'Confirma o cancela la transferencia pendiente antes del diagnóstico.')
        data.technician = request.state.user['name']
        evaluate(db, device_id, data)
    return {'message': 'Diagnóstico y componentes registrados.'}


@router.get('/components')
def components():
    with connection() as db:
        return [dict(r) for r in db.execute('SELECT c.*, d.code, d.model FROM components c JOIN devices d ON d.id=c.device_id ORDER BY c.id DESC')]


@router.post('/components/{component_id}/close')
def close(component_id: int, data: CloseInput, request: Request):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        data.responsible = request.state.user['name']
        close_component(db, component_id, data)
    return {'message': 'Destino confirmado.'}


@router.post('/devices/{device_id}/evidence', status_code=201)
async def upload_evidence(device_id: int, request: Request):
    mime = request.headers.get('content-type', '').split(';')[0]
    extensions = {'image/png': '.png', 'image/jpeg': '.jpg', 'application/pdf': '.pdf'}
    if mime not in extensions:
        raise HTTPException(415, 'Adjunta un archivo PNG, JPG o PDF.')
    # Lectura limitada: evita cargar archivos grandes completos en memoria.
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(413, 'El archivo no puede superar 5 MB.')
    signatures = {'image/png': bytes(data).startswith(b'\x89PNG\r\n\x1a\n'), 'image/jpeg': bytes(data).startswith(b'\xff\xd8\xff'), 'application/pdf': bytes(data).startswith(b'%PDF-')}
    if not signatures[mime]:
        raise HTTPException(422, 'El contenido no coincide con el tipo de archivo.')
    filename = uuid.uuid4().hex + extensions[mime]
    stored = False
    try:
        with connection() as db:
            device = get_device(db, device_id)
            if device['status'] == 'CERRADO':
                raise HTTPException(409, 'El expediente ya está cerrado.')
            save_evidence(UPLOADS, filename, data, mime)
            stored = True
            db.execute('INSERT INTO evidence (device_id, filename) VALUES (?, ?)', (device_id, filename))
            event(db, device_id, 'Evidencia', 'Archivo adjuntado al expediente.', request.state.user['name'])
    except Exception:
        if stored:
            delete_evidence(UPLOADS, filename)
        raise
    return {'filename': filename}
