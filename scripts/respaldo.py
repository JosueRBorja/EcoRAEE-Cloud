"""Respaldo y recuperación local verificables. Detén el backend antes de ejecutarlo."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_backup(output, database, uploads, media):
    if output.exists():
        raise ValueError('El respaldo ya existe. Elige otro nombre.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        copy = Path(temp) / 'ecoraee.db'
        with closing(sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(copy)) as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('La base de datos no supera la comprobación de integridad.')
        files = {'ecoraee.db': copy}
        for prefix, folder in [('uploads', uploads), ('media', media)]:
            if folder.exists():
                for file in folder.rglob('*'):
                    if file.is_file() and not file.is_symlink():
                        files[prefix + '/' + file.relative_to(folder).as_posix()] = file
        manifest = {name: digest(file) for name, file in files.items()}
        try:
            with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
                for name, file in files.items(): archive.write(file, name)
                archive.writestr('manifest.json', json.dumps({'version':1,'sha256':manifest}, indent=2))
        except Exception:
            output.unlink(missing_ok=True)
            raise
    return manifest


def restore_backup(archive_path, destination):
    if destination.exists():
        raise ValueError('La recuperación necesita una carpeta nueva. Nunca sobrescribe datos existentes.')
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        names = [e.filename for e in entries]
        if len(names) != len(set(names)) or sum(e.file_size for e in entries) > 1024**3:
            raise ValueError('Respaldo inválido o demasiado grande.')
        for name in names:
            path = PurePosixPath(name)
            if '\\' in name or path.is_absolute() or '..' in path.parts or not (name in ('ecoraee.db','manifest.json') or name.startswith(('uploads/','media/'))):
                raise ValueError('El respaldo contiene una ruta no permitida.')
        manifest = json.loads(archive.read('manifest.json'))['sha256']
        if set(names) != set(manifest) | {'manifest.json'}:
            raise ValueError('El manifiesto no coincide con los archivos.')
        for name, expected in manifest.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != expected:
                raise ValueError('El respaldo tiene un archivo alterado: ' + name)
        destination.mkdir(parents=True)
        for name in names:
            file = destination / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(archive.read(name))
    with closing(sqlite3.connect(destination / 'ecoraee.db')) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('La base recuperada no supera la validación. No la uses todavía.')
    return len(manifest)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    create = sub.add_parser('create')
    create.add_argument('--output', type=Path, required=True)
    create.add_argument('--database', type=Path, default=Path(os.environ.get('ECORAEE_DB', ROOT/'backend/data/ecoraee.db')))
    create.add_argument('--uploads', type=Path, default=Path(os.environ.get('ECORAEE_UPLOADS', ROOT/'backend/uploads')))
    create.add_argument('--media', type=Path, default=Path(os.environ.get('ECORAEE_MEDIA', ROOT/'backend/media')))
    create.add_argument('--confirm-stopped', action='store_true', required=True)
    restore = sub.add_parser('restore')
    restore.add_argument('--archive', type=Path, required=True)
    restore.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    if args.action == 'create': print('Archivos respaldados:', len(create_backup(args.output,args.database,args.uploads,args.media)))
    else: print('Archivos recuperados y verificados:', restore_backup(args.archive,args.destination))
