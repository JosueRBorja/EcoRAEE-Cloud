"""Fotos por recurso: contenido decodificado, sin metadatos, nombres aleatorios y permisos."""
import io
import os
import uuid
import warnings
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError

from .base_datos import BASE, connection
from .seguridad import current_user, require_roles
from .servicios_negocio import audit

router = APIRouter(prefix='/api', tags=['Fotografías'])
MEDIA = Path(os.environ.get('ECORAEE_MEDIA', str(BASE / 'media')))
TABLES = {'products': 'products', 'devices': 'devices', 'users': 'users'}
Image.MAX_IMAGE_PIXELS = 16_000_000


def authorize(kind, resource_id, user):
    if kind == 'users':
        if user['id'] != resource_id and user['role'] != 'admin':
            raise HTTPException(403, 'Solo puedes modificar tu foto de perfil.')
    elif user['role'] not in (('admin', 'inventory') if kind == 'products' else ('admin', 'sales', 'technician', 'inventory')):
        raise HTTPException(403, 'Tu perfil no puede modificar esta fotografía.')


def resource(db, kind, resource_id):
    table = TABLES.get(kind)
    if table is None:
        raise HTTPException(404, 'Tipo de fotografía no encontrado.')
    row = db.execute(f'SELECT * FROM {table} WHERE id=?', (resource_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Registro no encontrado.')
    return row


async def normalized_image(request):
    mime = request.headers.get('content-type', '').split(';')[0]
    if mime not in ('image/png', 'image/jpeg', 'image/webp'):
        raise HTTPException(415, 'Usa una fotografía PNG, JPG o WebP.')
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 5 * 1024 * 1024:
            raise HTTPException(413, 'La fotografía no puede superar 5 MB.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(body)) as source:
                if source.format not in ('PNG', 'JPEG', 'WEBP'):
                    raise ValueError('Formato no permitido')
                source.load()
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((1600, 1600))
                output = io.BytesIO()
                image.save(output, format='JPEG', quality=88, optimize=True)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'La fotografía está dañada, tiene un formato inválido o supera 16 megapíxeles.')


@router.post('/photos/{kind}/{resource_id}')
async def upload_photo(kind: str, resource_id: int, request: Request, user=Depends(current_user)):
    with connection() as db:
        resource(db, kind, resource_id)
        authorize(kind, resource_id, user)
    content = await normalized_image(request)
    MEDIA.mkdir(parents=True, exist_ok=True)
    filename = uuid.uuid4().hex + '.jpg'
    path = MEDIA / filename
    try:
        path.write_bytes(content)
        with connection() as db:
            db.execute('BEGIN IMMEDIATE')
            old = resource(db, kind, resource_id)['photo_filename']
            db.execute(f'UPDATE {TABLES[kind]} SET photo_filename=? WHERE id=?', (filename, resource_id))
            audit(db, user, 'Fotografía actualizada', f'{kind} #{resource_id}')
    except Exception:
        path.unlink(missing_ok=True)
        raise
    if old:
        (MEDIA / old).unlink(missing_ok=True)
    return {'photo_filename': filename}


@router.delete('/photos/{kind}/{resource_id}')
def remove_photo(kind: str, resource_id: int, user=Depends(current_user)):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = resource(db, kind, resource_id)
        authorize(kind, resource_id, user)
        filename = row['photo_filename']
        db.execute(f'UPDATE {TABLES[kind]} SET photo_filename=NULL WHERE id=?', (resource_id,))
        audit(db, user, 'Fotografía retirada', f'{kind} #{resource_id}')
    if filename:
        (MEDIA / filename).unlink(missing_ok=True)
    return {'photo_filename': None}


def photo_response(row):
    filename = row['photo_filename']
    if not filename or Path(filename).name != filename or not (MEDIA / filename).is_file():
        raise HTTPException(404, 'Sin fotografía. Se utiliza la ilustración predeterminada.')
    return FileResponse(MEDIA / filename, media_type='image/jpeg', headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})


@router.get('/photos/products/{resource_id}')
def product_photo(resource_id: int):
    with connection() as db:
        row = resource(db, 'products', resource_id)
        if not row['active']:
            raise HTTPException(404, 'Producto no disponible.')
        return photo_response(row)


@router.get('/photos/devices/{resource_id}')
def device_photo(resource_id: int, user=Depends(require_roles('sales', 'technician', 'inventory'))):
    with connection() as db:
        return photo_response(resource(db, 'devices', resource_id))


@router.get('/photos/users/{resource_id}')
def avatar(resource_id: int, user=Depends(current_user)):
    authorize('users', resource_id, user)
    with connection() as db:
        return photo_response(resource(db, 'users', resource_id))
