"""Reglas del negocio. Las escrituras relacionadas se confirman juntas."""
from fastapi import HTTPException


def get_device(db, device_id):
    row = db.execute('SELECT d.*,v.classification FROM devices d JOIN vw_device_classification v ON v.device_id=d.id WHERE d.id=?', (device_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Equipo no encontrado.')
    return row


def event(db, device_id, action, detail, responsible='Recepción local'):
    db.execute('INSERT INTO events (device_id, action, detail, responsible) VALUES (?, ?, ?, ?)', (device_id, action, detail, responsible))


def evaluate(db, device_id, data):
    device = get_device(db, device_id)
    if device['status'] != 'EN_EVALUACION':
        raise HTTPException(409, 'Primero debes enviar el equipo al taller. Solo se admite un diagnóstico por equipo.')
    db.execute('INSERT INTO evaluations (device_id, technician, notes) VALUES (?, ?, ?)', (device_id, data.technician, data.notes))
    for component in data.components:
        db.execute('INSERT INTO components (device_id, name, classification, voltage, observations) VALUES (?, ?, ?, ?, ?)', (device_id, component.name, component.classification, component.voltage, component.observations))
    db.execute("UPDATE devices SET status='CLASIFICADO', location='Bodega' WHERE id=?", (device_id,))
    count = len(data.components)
    label = 'componente clasificado' if count == 1 else 'componentes clasificados'
    event(db, device_id, 'Diagnóstico', f'{count} {label}. {data.notes}', data.technician)


def close_component(db, component_id, data):
    component = db.execute('SELECT * FROM components WHERE id=?', (component_id,)).fetchone()
    if component is None:
        raise HTTPException(404, 'Componente no encontrado.')
    if get_device(db, component['device_id'])['active_transfer_id']:
        raise HTTPException(409, 'Confirma o cancela la transferencia antes de cerrar el expediente.')
    if component['closed_at']:
        raise HTTPException(409, 'Este componente ya tiene un destino confirmado.')
    allowed = {
        'REUTILIZABLE': {'REUTILIZACION', 'REPARACION', 'RECICLAJE', 'DISPOSICION', 'BENEFICIARIO', 'FABRICACION'},
        'REPARABLE': {'REPARACION', 'RECICLAJE', 'DISPOSICION'},
        'RECICLABLE': {'RECICLAJE', 'DISPOSICION'},
        'NO_RECUPERABLE': {'DISPOSICION'},
    }
    if data.destination_type not in allowed[component['classification']]:
        raise HTTPException(422, 'El tipo de destino no es compatible con la clasificación técnica.')
    if not db.execute('SELECT id FROM evidence WHERE device_id=?', (component['device_id'],)).fetchone():
        raise HTTPException(409, 'Adjunta una fotografía o acta al equipo antes de confirmar el destino.')
    db.execute("UPDATE components SET destination=?, destination_type=?, closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (data.destination, data.destination_type, component_id))
    event(db, component['device_id'], 'Destino confirmado', f"{component['name']} ({component['classification']}) → {data.destination}", data.responsible)
    pending = db.execute('SELECT count(*) FROM components WHERE device_id=? AND closed_at IS NULL', (component['device_id'],)).fetchone()[0]
    if pending == 0:
        db.execute("UPDATE devices SET status='CERRADO', location='Destinos confirmados' WHERE id=?", (component['device_id'],))
        event(db, component['device_id'], 'Cierre', 'Todos los componentes tienen un destino confirmado y evidencia.', data.responsible)
