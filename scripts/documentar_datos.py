"""Genera diccionario y relaciones desde el esquema real, usando una base temporal."""
import os
import tempfile
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as folder:
        os.environ['ECORAEE_DB'] = str(Path(folder)/'schema.db')
        from backend.app.base_datos import initialize, connection
        initialize()
        lines = ['# Diccionario del esquema local', '', 'Generado desde PRAGMA table_info y foreign_key_list. No contiene datos de usuarios.', '', 'El DDL fuente está en `database/*.sql`; las ampliaciones versionadas están en `backend/app/migraciones.py` y `base_datos.py`.', '']
        graph = ['erDiagram']
        with connection() as db:
            tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
            for table in tables:
                lines += [f'## {table}', '', '| Columna | Tipo | Requerida | PK | Predeterminado |', '|---|---|---|---|---|']
                for r in db.execute(f'PRAGMA table_info({table})'):
                    lines.append(f'| {r[1]} | {r[2]} | {bool(r[3]) or bool(r[5])} | {bool(r[5])} | {r[4] or "—"} |')
                lines += ['', 'Relaciones:']
                foreign = db.execute(f'PRAGMA foreign_key_list({table})').fetchall()
                for r in foreign:
                    lines.append(f'- `{r[3]}` referencia `{r[2]}.{r[4]}`; al eliminar: `{r[6]}`.')
                    graph.append(f'    {r[2]} ||--o{{ {table} : "{r[3]}"')
                if not foreign: lines.append('- Sin claves foráneas.')
                lines.append('')
        (root/'docs').mkdir(exist_ok=True)
        (root/'docs/diccionario.md').write_text('\n'.join(lines),encoding='utf-8')
        (root/'database/relaciones.mmd').write_text('\n'.join(graph)+'\n',encoding='utf-8')
        print('Diccionario y relaciones generados.')


if __name__ == '__main__': main()
