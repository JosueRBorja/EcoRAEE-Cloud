"""Sesiones locales con cookie HttpOnly y contraseñas derivadas con PBKDF2."""
import hashlib
import hmac
import secrets
import time
import unicodedata
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .base_datos import connection
from .validaciones import Input
from typing import Literal
import uuid
import os

router = APIRouter(prefix='/api/auth', tags=['Acceso'])
ROLES = ('admin', 'client', 'sales', 'technician', 'inventory', 'finance')


def hash_password(password):
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000)
    return salt + ':' + derived.hex()


def verify_password(password, stored):
    salt, expected = stored.split(':')
    actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260_000).hex()
    return hmac.compare_digest(actual, expected)


def current_user(request: Request):
    token = request.cookies.get('ecoraee_session', '')
    digest = hashlib.sha256(token.encode()).hexdigest()
    with connection() as db:
        user = db.execute('''SELECT u.id, u.name, u.email, u.role, u.client_id, u.photo_filename
            FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.expires_at>? AND u.active=1''', (digest, int(time.time()))).fetchone()
    if user is None:
        raise HTTPException(401, 'Inicia sesión para continuar.')
    request.state.user = dict(user)
    return dict(user)


def require_roles(*roles):
    def dependency(user=Depends(current_user)):
        if user['role'] != 'admin' and user['role'] not in roles:
            raise HTTPException(403, 'Tu perfil no tiene permiso para esta operación.')
        return user
    return dependency


class LoginInput(Input):
    email: str = Field(min_length=5, max_length=120, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=1, max_length=128)
    portal: Literal['client', 'staff'] | None = None


class RegisterInput(Input):
    name: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=5, max_length=120, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(min_length=8, max_length=128)


def start_session(db, user, response):
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM sessions WHERE expires_at<=?', (int(time.time()),))
    db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), user['id'], int(time.time()) + 8 * 3600))
    response.set_cookie('ecoraee_session', token, httponly=True, secure=os.environ.get('ECORAEE_SECURE_COOKIES') == '1', samesite='strict', max_age=8 * 3600, path='/')
    return {key: user[key] for key in ('id', 'name', 'email', 'role', 'client_id', 'photo_filename')}


@router.post('/register', status_code=201)
def register(data: RegisterInput, response: Response):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM users WHERE email=?', (data.email.lower(),)).fetchone():
            raise HTTPException(409, 'Este correo ya está registrado. Inicia sesión con tu contraseña.')
        client_id = db.execute('INSERT INTO clients (name,document) VALUES (?,?)',
                               (data.name, 'WEB-' + uuid.uuid4().hex[:12].upper())).lastrowid
        user_id = db.execute('INSERT INTO users (name,email,password_hash,role,client_id) VALUES (?,?,?,?,?)',
                            (data.name, data.email.lower(), hash_password(data.password), 'client', client_id)).lastrowid
        user = db.execute('SELECT * FROM users WHERE id=?', (user_id,)).fetchone()
        return start_session(db, user, response)


@router.post('/login')
def login(data: LoginInput, response: Response, request: Request):
    key = hashlib.sha256((data.email.lower() + '|' + (request.client.host if request.client else 'local')).encode()).hexdigest()
    now = int(time.time())
    # Los fallos se conservan en una transacción independiente del resultado HTTP.
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM login_attempts WHERE window_start<=?', (now - 900,))
        attempt = db.execute('SELECT attempts FROM login_attempts WHERE key_hash=?', (key,)).fetchone()
        if attempt and attempt['attempts'] >= 10:
            raise HTTPException(429, 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.')
        db.execute('INSERT INTO login_attempts(key_hash,attempts,window_start) VALUES (?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=login_attempts.attempts+1', (key, now))
    with connection() as db:
        user = db.execute('SELECT * FROM users WHERE email=?', (data.email.lower(),)).fetchone()
        if user is None or not user['active'] or not verify_password(data.password, user['password_hash']):
            raise HTTPException(401, 'Correo o contraseña incorrectos.')
        # Compatibilidad con clientes anteriores: el portal nunca asigna ni restringe el rol.
        # El rol se obtiene exclusivamente de la cuenta autenticada.
        db.execute('DELETE FROM login_attempts WHERE key_hash=?', (key,))
        return start_session(db, user, response)


@router.get('/me')
def me(user=Depends(current_user)):
    return user


class ProfileIdentity(Input):
    given_names: str = Field(min_length=1, max_length=50)
    surnames: str = Field(min_length=1, max_length=49)

    @field_validator('given_names', 'surnames')
    @classmethod
    def validate_name(cls, value):
        value = ' '.join(unicodedata.normalize('NFC', value).split())
        if not value or not value[0].isalpha() or not all(
            char.isalpha() or unicodedata.category(char).startswith('M') or char in " -'’" for char in value
        ):
            raise ValueError('Usa letras, espacios, guiones o apóstrofos en los nombres y apellidos.')
        return value


class ProfileAddress(Input):
    city: str = Field(min_length=1, max_length=45, pattern=r'^\p{L}[\p{L}\p{M} .’\x27-]*$')
    street: str = Field(min_length=1, max_length=75, pattern=r'^[\p{L}\p{N}][\p{L}\p{M}\p{N} .’\x27/-]*$')
    street_number: str = Field(min_length=1, max_length=15, pattern=r'^(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*|[sS]/[nN])$')
    reference: str = Field(default='', max_length=55, pattern=r'^[^\r\n\t]*$')


class ProfileContact(Input):
    phone: str = Field(default='', max_length=13, pattern=r'^(?:\+593[0-9]{9})?$')
    address: ProfileAddress | None = None


class ProfileInput(Input):
    identity: ProfileIdentity | None = None
    contact: ProfileContact | None = None


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


@router.get('/profile')
def profile(user=Depends(current_user)):
    with connection() as db:
        identity = db.execute('SELECT given_names,surnames FROM profile_identity WHERE user_id=?', (user['id'],)).fetchone()
        contact = db.execute('SELECT phone,address FROM clients WHERE id=?', (user['client_id'],)).fetchone() if user['role'] == 'client' else None
        parts = db.execute('SELECT city,street,street_number,reference FROM profile_addresses WHERE client_id=?', (user['client_id'],)).fetchone() if contact else None
    return {**user, 'identity': dict(identity) if identity else None,
            'contact': {**dict(contact), 'address_parts': dict(parts) if parts else None} if contact else None}


@router.put('/profile')
def update_profile(data: ProfileInput, user=Depends(current_user)):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if data.contact is not None:
            if user['role'] != 'client' or user['client_id'] is None:
                raise HTTPException(403, 'Esta cuenta no tiene una ficha de cliente.')
            address = data.contact.address
            formatted = None
            if address:
                formatted = ', '.join(filter(None, [f'{address.street} {address.street_number}', address.city, address.reference]))
                db.execute('INSERT INTO profile_addresses VALUES (?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET city=excluded.city,street=excluded.street,street_number=excluded.street_number,reference=excluded.reference',
                           (user['client_id'], address.city, address.street, address.street_number, address.reference))
            db.execute('UPDATE clients SET phone=?, address=COALESCE(?,address) WHERE id=?',
                       (data.contact.phone, formatted, user['client_id']))
        if data.identity:
            identity = data.identity
            name = f'{identity.given_names} {identity.surnames}'
            db.execute('INSERT INTO profile_identity VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET given_names=excluded.given_names,surnames=excluded.surnames',
                       (user['id'], identity.given_names, identity.surnames))
            db.execute('UPDATE users SET name=? WHERE id=?', (name, user['id']))
            user = {**user, 'name': name}
    return profile(user)


@router.post('/profile/password')
def change_password(data: PasswordChange, request: Request, user=Depends(current_user)):
    if data.new_password != data.new_password.strip():
        raise HTTPException(422, 'La contraseña nueva no puede comenzar ni terminar con espacios.')
    if data.new_password == data.current_password or not data.new_password.strip():
        raise HTTPException(422, 'Elige una contraseña nueva diferente de la actual.')
    digest = hashlib.sha256(request.cookies['ecoraee_session'].encode()).hexdigest()
    with connection() as db:
        stored = db.execute('SELECT password_hash FROM users WHERE id=?', (user['id'],)).fetchone()
        if not verify_password(data.current_password, stored['password_hash']):
            raise HTTPException(400, 'La contraseña actual es incorrecta.')
        updated = db.execute('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?',
                             (hash_password(data.new_password), user['id'], stored['password_hash']))
        if not updated.rowcount:
            raise HTTPException(409, 'La contraseña cambió. Vuelve a intentarlo.')
        db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?', (user['id'], digest))
    return {'message': 'Contraseña actualizada. Se cerraron las demás sesiones.'}


@router.post('/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get('ecoraee_session', '')
    with connection() as db:
        db.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie('ecoraee_session', path='/')
    return {'message': 'Sesión cerrada.'}


def authorize_raee(request: Request, user=Depends(current_user)):
    """Permisos del módulo original; protege también las peticiones directas."""
    path = request.url.path
    if request.method == 'GET':
        roles = ('sales', 'technician', 'inventory')
        if '/clients' in path:
            roles = ('sales', 'finance')
    elif '/evaluation' in path:
        roles = ('technician',)
    elif '/close' in path:
        roles = ('inventory',)
    elif '/evidence' in path:
        roles = ('sales', 'technician', 'inventory')
    else:
        roles = ('sales',)
    if user['role'] != 'admin' and user['role'] not in roles:
        raise HTTPException(403, 'Tu perfil no tiene permiso para esta operación.')


def seed_business():
    """Credenciales sintéticas públicas de demostración, documentadas en README."""
    with connection() as db:
        if db.execute("SELECT value FROM settings WHERE key='business_seeded'").fetchone():
            return
        client = db.execute("SELECT id FROM clients ORDER BY id LIMIT 1").fetchone()
        if client is None:
            client_id = db.execute("INSERT INTO clients (name,document) VALUES ('Camila Andrade','DEMO-BUSINESS')").lastrowid
        else:
            client_id = client['id']
        users = [('Valia Paredes · Admin', 'admin', None), ('Camila Andrade · Cliente', 'client', client_id),
                 ('Daniel Morales · Ventas', 'sales', None), ('Andrés Vega · Técnico', 'technician', None),
                 ('Sofía Herrera · Inventario', 'inventory', None), ('Lucía Torres · Finanzas', 'finance', None)]
        for name, role, linked in users:
            email_name = {'client': 'cliente', 'sales': 'ventas', 'technician': 'tecnico', 'inventory': 'inventario', 'finance': 'finanzas'}.get(role, role)
            db.execute('INSERT INTO users (name,email,password_hash,role,client_id) VALUES (?,?,?,?,?)',
                       (name, email_name + '@ecoraee.local', hash_password('Demo12345!'), role, linked))
        from .migraciones import TECH_PRODUCTS
        products = TECH_PRODUCTS[:5]
        admin_id = db.execute("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()['id']
        for row in products:
            cur = db.execute('INSERT INTO products (sku,name,description,category,condition,price_cents,stock) VALUES (?,?,?,?,?,?,?)', row)
            db.execute('INSERT INTO stock_movements (product_id,quantity,reason,user_id) VALUES (?,?,?,?)', (cur.lastrowid, row[-1], 'Inventario de apertura', admin_id))
        db.execute("INSERT INTO settings VALUES ('business_seeded','1')")
