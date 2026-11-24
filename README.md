# AWStore · Tecnología circular

Aplicación local con React, FastAPI y SQLite para vender tecnología, gestionar inventario y crédito de demostración y conservar la trazabilidad de equipos recuperados. Marca y catálogo ficticios; no procesa cobros reales. AWS queda pendiente hasta que el propietario solicite el despliegue.

## Ejecutar en Visual Studio Code (Windows)

Requisitos: Python 3.11+ y Node.js 20.19+ o 22.12+. Abre esta carpeta en VS Code. Si tu terminal ya termina en `Sistema-Empresarial`, no vuelvas a ejecutar `cd Sistema-Empresarial`.

Detén los servidores anteriores con Ctrl+C. Desde la raíz del repositorio, instala o actualiza dependencias:

```powershell
.\preparar.bat
```

Espera el mensaje «Preparacion completa» y pulsa una tecla. En esa terminal:

```powershell
.\iniciar-backend.bat
```

En otra terminal abierta en la misma carpeta:

```powershell
.\iniciar-frontend.bat
```

Tienda: http://127.0.0.1:5173 · API: http://127.0.0.1:8000/docs.

Alternativa manual sin activar el entorno:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

## Inicio de sesión único

El mismo formulario admite todas las cuentas. Tras verificar correo y contraseña, el servidor obtiene el rol y la interfaz abre su área. No existe «Acceso avanzado», ni se elige el rol al iniciar sesión. El registro público solo crea clientes.

Se conservan los correos demo originales para que el cambio de marca no invalide cuentas ni relaciones. Contraseña local de las siguientes cuentas: `Demo12345!`.

| Rol | Correo |
|---|---|
| Administrador | admin@ecoraee.local |
| Cliente | cliente@ecoraee.local |
| Ventas | ventas@ecoraee.local |
| Técnico | tecnico@ecoraee.local |
| Inventario | inventario@ecoraee.local |
| Finanzas | finanzas@ecoraee.local |

## Qué probar

- Catálogo: computadoras, audio, monitores, periféricos, componentes, accesorios, redes y tablets. Búsqueda, filtros, carrito, pedidos y crédito conservan el flujo comercial.
- Productos y bodega: crear/editar productos y su foto, entradas/salidas justificadas, ensamble con piezas reutilizables y control de stock.
- Perfil: abrir el avatar, seleccionar una fotografía o volver a la imagen predeterminada.
- Recepción RAEE: registrar un equipo con foto opcional, enviarlo a diagnóstico, adjuntar evidencias y confirmar destinos compatibles.
- Red circular: crear centros y conexiones con administración; recibir lotes con ventas; reservar/confirmar transferencias con inventario. Cada equipo necesita evidencia para confirmar la recepción.
- Capacidad: seleccionar origen, sumidero y mes, calcular flujo máximo/corte mínimo y comparar escenarios guardados. La simulación no modifica la capacidad operativa.
- Cliente: solicitar recolección desde «Reciclar equipo» y consultar únicamente sus solicitudes y compras.

Fotos PNG/JPG/WebP de hasta 5 MB y 16 megapíxeles. El servidor normaliza el contenido a JPEG y elimina metadatos. Sin foto se muestra una ilustración tecnológica o avatar. Las evidencias RAEE se adjuntan por separado; una foto comercial no sustituye la evidencia de cierre.

## Datos existentes y migraciones

La marca comercial no determina los nombres de tablas. Se conservan PK, FK, cuentas, pedidos, stock y precios existentes. La primera migración de una base anterior crea `ecoraee.before-awstore.db` antes de modificar el esquema. Solo las muestras originales reconocibles cambian de nombre/categoría; los nuevos productos demo se agregan una vez. No se borran registros propios.

Persistencia: `backend/data/ecoraee.db`, `backend/uploads` y `backend/media`. No se suben a Git. Deben respaldarse juntos. Consulta `docs/datos-y-seguridad.md` y el script `scripts/respaldo.py`.

## Validación reproducible

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
.\.venv\Scripts\python.exe -m scripts.validar_modelo
.\.venv\Scripts\python.exe -m scripts.validar_sql
.\.venv\Scripts\python.exe -m scripts.validar_local
.\.venv\Scripts\python.exe -m scripts.documentar_datos
```

Dentro de `frontend`: `npm.cmd run build`. Los tests y scripts de medición usan almacenamiento sintético independiente. La medición ASGI no equivale a una prueba de red ni de AWS. Los resultados están en `evidence/`.

## Documentación

- `docs/cumplimiento.md`: estado y evidencia por requisito, con pendientes explícitos.
- `docs/arquitectura.md` y `docs/proceso.bpmn`: contexto, AS-IS/TO-BE, procesos, brechas y gobierno propuesto.
- `docs/datos-y-seguridad.md`, `docs/diccionario.md` y `database/relaciones.mmd`: datos, reglas y seguridad.
- `math/README.md`: formalización, tablas de verdad y validación del algoritmo.
- `innovation/analisis.md` y `innovation/pitch-en.md`: intervención responsable y guion en inglés.
- `infrastructure/README.md`: ruta de trabajo futura para AWS, sin despliegue ni recursos creados.

## Alcance actual

Es una versión local verificada con datos ficticios. No se declara terminada la entrega completa del integrador: faltan la implementación y validación cloud, revisión académica de modelos y pruebas participativas de usabilidad e impacto. No es una certificación de aptitud para producción pública. Las cuentas demo, pagos simulados y SQLite local requieren una transición explícita antes de exponer el sistema a usuarios reales.
