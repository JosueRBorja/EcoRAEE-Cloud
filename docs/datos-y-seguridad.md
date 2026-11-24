# Datos, integridad y seguridad local

## Modelos y relaciones

El modelo conceptual separa personas/cuentas, productos/ventas, equipos/componentes y centros/transferencias. Un cliente puede originar varias compras y equipos. Cada equipo tiene como máximo una evaluación, varias piezas y evidencias; cada pieza pertenece a un equipo. Un lote agrupa equipos del mismo remitente. Una conexión une centros distintos. Una transferencia contiene varios equipos y un equipo puede recorrer varias transferencias en momentos diferentes. La reserva activa del equipo impide moverlo simultáneamente.

El DDL físico está en `database/esquema.sql`, `negocio.sql` y `logistica.sql`; el modelo relacional editable, en `database/relaciones.mmd`. `docs/diccionario.md` enumera todas las columnas y relaciones del esquema real. El EER conceptual requiere revisión académica de cardinalidades opcionales y especializaciones antes de considerarse entrega definitiva.

## Dependencias y normalización

- `users.id → name,email,password_hash,role,client_id,active,photo_filename`; email es clave candidata sin distinción de mayúsculas.
- `products.id → sku,name,description,category,condition,price_cents,stock,active,photo_filename`; SKU es clave candidata, normalizada en mayúsculas y protegida por índice sin distinción de caso.
- `devices.id → code,model,category,client_id,status,location,center_id,batch_id,...`; code es clave candidata.
- `components.id → device_id,name,classification,voltage,observations,destination,destination_type,closed_at`.
- `(source_id,target_id) → network_edges.id,capacity`.
- `(transfer_id,device_id)` identifica pertenencia a la transferencia; el periodo y estado pertenecen a la cabecera.
- `(order_id,number) → installment.id,amount_cents,due_date,paid_cents`.

Las cabeceras y detalles evitan grupos repetidos y dependencias parciales. Las referencias a clientes, usuarios, productos, centros y equipos separan atributos dependientes de otras entidades. La revisión de 3FN se apoya en estas dependencias; no se afirma BCNF universal sin analizar todas las dependencias del negocio.

Desnormalizaciones justificadas: `products.stock` es un saldo materializado, `orders.total_cents` un importe histórico, `order_items.price_cents` el precio de la compra y `devices.location` una etiqueta operativa. Se mantienen en transacciones con su historial. Los JSON de `flow_runs` son instantáneas inmutables de entrada/salida, no la fuente para editar centros y conexiones. Una futura separación entre capacidad de almacenamiento y capacidad de procesamiento mensual permitiría modelar centros más reales; el modelo académico utiliza un mismo límite numérico conservador.

## Reglas aplicadas

- FK activadas en cada conexión. Eliminaciones relacionadas se restringen; no se borran equipos con tratamiento.
- Cantidades positivas, stock no negativo, importes enteros en centavos y cuotas con saldo válido.
- `BEGIN IMMEDIATE` serializa operaciones comerciales y logísticas de varias escrituras. Una excepción revierte todas sus escrituras.
- Transiciones RAEE admitidas: recepción → evaluación → clasificación → cierre. Hay validación de aplicación y trigger SQL.
- No se cierra el expediente sin componentes completos y evidencia. Las piezas cerradas no se reescriben.
- No recuperable solo admite disposición; reciclable admite reciclaje/disposición; reparable admite reparación/reciclaje/disposición; reutilizable admite también beneficiario y fabricación.
- Transferencias: misma procedencia, reserva única, capacidad por conexión y centro/mes, recepción con evidencias y actualización atómica. Cancelar libera la reserva y la capacidad.
- Clasificación conservadora del equipo: todas reutilizables → reutilizable; todas reutilizables/reparables → reparable; todas no recuperables → no recuperable; otras mezclas → reciclable, porque exigen separar materiales. La pieza mantiene su clasificación individual.

## Seguridad

| Perfil | Operaciones principales |
|---|---|
| Cliente | Tienda, compras/cuotas propias, recolecciones propias y su foto |
| Ventas | Pedidos, contactos, recepciones, lotes y recolecciones |
| Técnico | Diagnóstico, evidencias y consulta de red/trazabilidad |
| Inventario | Productos, stock, ensamble, destinos, análisis y transferencias |
| Finanzas | Crédito, cuotas y pagos |
| Administrador | Gestión general, centros, conexiones y cuentas |

Autenticación: contraseña PBKDF2 con salt; cookie HttpOnly, SameSite estricto y sesión almacenada como hash. El rol se lee de SQL después de verificar correo y contraseña. Registro público crea únicamente clientes. No existe elección de rol en el login. Se conservan correos demo `@ecoraee.local` para no invalidar cuentas ya creadas al cambiar de marca.

La cookie puede marcarse Secure mediante `ECORAEE_SECURE_COOKIES=1` cuando exista HTTPS. Las mutaciones con Origin ajeno o `Sec-Fetch-Site: cross-site` se rechazan. Diez intentos de login por correo/IP en quince minutos activan un límite. Cabeceras nosniff, antiiframe y sin caché para autenticación complementan el control del servidor.

Fotos: PNG/JPG/WebP, máximo 5 MB y 16 megapíxeles; el servidor decodifica y vuelve a codificar a JPEG, elimina metadatos y usa UUID. Fotos activas de productos son públicas; las de equipos requieren personal autorizado; las de perfil son privadas para el propietario y administración. No se aceptan URL externas ni SVG subidos. Un error de imagen conserva la ilustración local. La foto de presentación de un equipo no sustituye la evidencia del expediente.

## Respaldo y recuperación

Antes de migrar una base antigua se crea una copia consistente `.before-awstore.db`. La migración conserva identificadores, precios, stock, pedidos y relaciones. Solo actualiza las muestras originales reconocibles de la marca anterior y agrega productos demo.

Para un respaldo completo, detén el backend y ejecuta:

```powershell
.\.venv\Scripts\python.exe -m scripts.respaldo create --output backups/awstore.zip --confirm-stopped
.\.venv\Scripts\python.exe -m scripts.respaldo restore --archive backups/awstore.zip --destination backups/recuperado
```

La recuperación exige una carpeta nueva, verifica hashes y comprobaciones SQLite, y no sobrescribe la instalación. Para probar la copia, configura `ECORAEE_DB`, `ECORAEE_UPLOADS` y `ECORAEE_MEDIA` hacia los tres recursos recuperados. No copies solo la base si existen archivos asociados.

## Límites antes de exposición pública

Las cuentas demo y la contraseña compartida son exclusivamente locales. No se procesan cobros reales, no hay recuperación/verificación de correo ni cumplimiento tributario. SQLite es un entorno de desarrollo y demostración de un solo nodo. RDS, S3, HTTPS, identidad operativa, retención de datos, pruebas de carga real y revisión independiente quedan pendientes antes de producción pública. Este repositorio no se declara certificado ni libre de defectos.
