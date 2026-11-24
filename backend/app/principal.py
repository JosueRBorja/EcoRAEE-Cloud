import logging
import sqlite3
import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi import Depends
from .almacen_evidencias import evidence_response
from .base_datos import initialize, connection
from .rutas import router, UPLOADS
from .seguridad import router as auth_router, seed_business, authorize_raee, require_roles
from .rutas_negocio import router as business_router
from .fotos import router as photo_router
from .migraciones import (
    migrate_demo_brand, migrate_example_names, migrate_example_role_labels,
    migrate_example_diagnosis_spelling,
)
from .logistica import router as logistics_router


def initialize_demo_data():
    initialize()
    seed_business()
    with connection() as db:
        migrate_demo_brand(db)
        migrate_example_names(db)
        migrate_example_role_labels(db)
        migrate_example_diagnosis_spelling(db)


@asynccontextmanager
async def lifespan(app):
    if not os.getenv('ECORAEE_POSTGRES_DSN'):
        initialize_demo_data()
    else:
        import psycopg
        app.add_exception_handler(psycopg.IntegrityError, integrity_error)
    yield


app = FastAPI(title='AWStore · Tecnología circular', version='0.3.0', lifespan=lifespan)
app.include_router(auth_router)
app.include_router(business_router)
app.include_router(photo_router)
app.include_router(logistics_router)
app.include_router(router, dependencies=[Depends(authorize_raee)])


@app.middleware('http')
async def browser_security(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        configured = os.environ.get('AWSTORE_ALLOWED_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174')
        allowed = {value.strip().rstrip('/') for value in configured.split(',') if value.strip()}
        host = request.url.hostname or ''
        if os.getenv('ECORAEE_CLOUDFRONT_ORIGIN') == '1' and re.fullmatch(r'[a-z0-9]+\.cloudfront\.net', host):
            allowed.add(f'https://{host}')
        if request.headers.get('sec-fetch-site') == 'cross-site' or (origin and origin.rstrip('/') not in allowed):
            return JSONResponse(status_code=403, content={'detail': 'Origen de la solicitud no autorizado.'})
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    if request.url.path.startswith('/api/auth'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.get('/api/health')
def health():
    with connection() as db:
        db.execute('SELECT 1')
    storage = 'PostgreSQL' if os.getenv('ECORAEE_POSTGRES_DSN') else 'SQLite local'
    return {'status': 'ok', 'version': '0.3.0', 'brand': 'AWStore', 'storage': storage}


@app.get('/uploads/{filename}')
def evidence_file(filename: str, user=Depends(require_roles('sales', 'technician', 'inventory'))):
    return evidence_response(UPLOADS, filename)


@app.exception_handler(sqlite3.IntegrityError)
async def integrity_error(request: Request, exc):
    if 'UNIQUE' in str(exc):
        message = 'Ya existe un registro con ese identificador.'
    else:
        message = 'La operación afecta registros relacionados o datos no válidos. Revisa las relaciones antes de continuar.'
    return JSONResponse(status_code=409, content={'detail': message})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc):
    logging.exception('Error no controlado en la API')
    return JSONResponse(status_code=500, content={'detail': 'No se pudo completar la operación. Revisa la consola del backend.'})
