# Diccionario del esquema local

Generado desde PRAGMA table_info y foreign_key_list. No contiene datos de usuarios.

El DDL fuente está en `database/*.sql`; las ampliaciones versionadas están en `backend/app/migraciones.py` y `base_datos.py`.

## assemblies

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| product_id | INTEGER | True | False | — |
| user_id | INTEGER | True | False | — |
| notes | TEXT | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `user_id` referencia `users.id`; al eliminar: `NO ACTION`.
- `product_id` referencia `products.id`; al eliminar: `NO ACTION`.

## batches

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| code | TEXT | True | False | — |
| client_id | INTEGER | True | False | — |
| center_id | INTEGER | True | False | — |
| collection_id | INTEGER | False | False | — |
| created_by | INTEGER | True | False | — |
| created_at | TEXT | True | False | CURRENT_TIMESTAMP |

Relaciones:
- `created_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `collection_id` referencia `collections.id`; al eliminar: `NO ACTION`.
- `center_id` referencia `centers.id`; al eliminar: `NO ACTION`.
- `client_id` referencia `clients.id`; al eliminar: `NO ACTION`.

## business_events

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| user_id | INTEGER | True | False | — |
| action | TEXT | True | False | — |
| detail | TEXT | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `user_id` referencia `users.id`; al eliminar: `NO ACTION`.

## cash_receipts

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| order_id | INTEGER | True | True | — |
| reference | TEXT | True | False | — |
| amount_cents | INTEGER | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.

## centers

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| name | TEXT | True | False | — |
| kind | TEXT | True | False | — |
| capacity | INTEGER | True | False | — |
| active | INTEGER | True | False | 1 |

Relaciones:
- Sin claves foráneas.

## checkout_requests

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| user_id | INTEGER | True | True | — |
| request_key | TEXT | True | True | — |
| order_id | INTEGER | True | False | — |

Relaciones:
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.
- `user_id` referencia `users.id`; al eliminar: `NO ACTION`.

## clients

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| name | TEXT | True | False | — |
| document | TEXT | True | False | — |
| phone | TEXT | True | False | '' |
| address | TEXT | True | False | '' |

Relaciones:
- Sin claves foráneas.

## collections

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| client_id | INTEGER | True | False | — |
| description | TEXT | True | False | — |
| pickup_address | TEXT | True | False | — |
| status | TEXT | True | False | 'SOLICITADA' |
| created_by | INTEGER | True | False | — |
| created_at | TEXT | True | False | CURRENT_TIMESTAMP |

Relaciones:
- `created_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `client_id` referencia `clients.id`; al eliminar: `NO ACTION`.

## component_consumptions

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| component_id | INTEGER | True | True | — |
| assembly_id | INTEGER | True | False | — |

Relaciones:
- `assembly_id` referencia `assemblies.id`; al eliminar: `NO ACTION`.
- `component_id` referencia `components.id`; al eliminar: `NO ACTION`.

## components

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| device_id | INTEGER | True | False | — |
| name | TEXT | True | False | — |
| classification | TEXT | True | False | — |
| voltage | REAL | False | False | — |
| observations | TEXT | True | False | '' |
| destination | TEXT | False | False | — |
| closed_at | TEXT | False | False | — |
| destination_type | TEXT | False | False | — |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `RESTRICT`.

## devices

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| code | TEXT | True | False | — |
| model | TEXT | True | False | — |
| category | TEXT | True | False | — |
| client_id | INTEGER | True | False | — |
| status | TEXT | True | False | 'RECEPCIONADO' |
| location | TEXT | True | False | 'Showroom' |
| notes | TEXT | True | False | '' |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| photo_filename | TEXT | False | False | — |
| center_id | INTEGER | False | False | — |
| batch_id | INTEGER | False | False | — |
| active_transfer_id | INTEGER | False | False | — |

Relaciones:
- `active_transfer_id` referencia `transfers.id`; al eliminar: `NO ACTION`.
- `batch_id` referencia `batches.id`; al eliminar: `NO ACTION`.
- `center_id` referencia `centers.id`; al eliminar: `NO ACTION`.
- `client_id` referencia `clients.id`; al eliminar: `RESTRICT`.

## evaluations

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| device_id | INTEGER | True | False | — |
| technician | TEXT | True | False | — |
| notes | TEXT | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `RESTRICT`.

## events

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| device_id | INTEGER | True | False | — |
| action | TEXT | True | False | — |
| detail | TEXT | True | False | — |
| responsible | TEXT | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `CASCADE`.

## evidence

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| device_id | INTEGER | True | False | — |
| filename | TEXT | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `RESTRICT`.

## flow_runs

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| scenario | TEXT | True | False | — |
| source_id | INTEGER | True | False | — |
| sink_id | INTEGER | True | False | — |
| period | TEXT | True | False | — |
| input_json | TEXT | True | False | — |
| result_json | TEXT | True | False | — |
| user_id | INTEGER | True | False | — |
| created_at | TEXT | True | False | CURRENT_TIMESTAMP |

Relaciones:
- `user_id` referencia `users.id`; al eliminar: `NO ACTION`.
- `sink_id` referencia `centers.id`; al eliminar: `NO ACTION`.
- `source_id` referencia `centers.id`; al eliminar: `NO ACTION`.

## installments

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| order_id | INTEGER | True | False | — |
| number | INTEGER | True | False | — |
| amount_cents | INTEGER | True | False | — |
| due_date | TEXT | True | False | — |
| paid_cents | INTEGER | True | False | 0 |

Relaciones:
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.

## login_attempts

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| key_hash | TEXT | True | True | — |
| attempts | INTEGER | True | False | — |
| window_start | INTEGER | True | False | — |

Relaciones:
- Sin claves foráneas.

## network_edges

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| source_id | INTEGER | True | False | — |
| target_id | INTEGER | True | False | — |
| capacity | INTEGER | True | False | — |

Relaciones:
- `target_id` referencia `centers.id`; al eliminar: `RESTRICT`.
- `source_id` referencia `centers.id`; al eliminar: `RESTRICT`.

## order_items

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| order_id | INTEGER | True | False | — |
| product_id | INTEGER | True | False | — |
| quantity | INTEGER | True | False | — |
| price_cents | INTEGER | True | False | — |

Relaciones:
- `product_id` referencia `products.id`; al eliminar: `NO ACTION`.
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.

## order_tradeins

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| order_id | INTEGER | True | True | — |
| device_id | INTEGER | True | False | — |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `NO ACTION`.
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.

## orders

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| client_id | INTEGER | True | False | — |
| created_by | INTEGER | True | False | — |
| payment_type | TEXT | True | False | — |
| installments | INTEGER | True | False | — |
| status | TEXT | True | False | 'PENDIENTE' |
| total_cents | INTEGER | True | False | — |
| tradein_model | TEXT | True | False | '' |
| rejection_reason | TEXT | True | False | '' |
| confirmed_by | INTEGER | False | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| delivery_mode | TEXT | True | False | 'RETIRO' |
| delivery_address | TEXT | True | False | '' |
| contact_phone | TEXT | True | False | '' |
| delivered_at | TEXT | False | False | — |
| delivered_by | INTEGER | False | False | — |

Relaciones:
- `delivered_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `confirmed_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `created_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `client_id` referencia `clients.id`; al eliminar: `NO ACTION`.

## payments

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| installment_id | INTEGER | True | False | — |
| amount_cents | INTEGER | True | False | — |
| reference | TEXT | True | False | — |
| recorded_by | INTEGER | True | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `recorded_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `installment_id` referencia `installments.id`; al eliminar: `NO ACTION`.

## products

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| sku | TEXT | True | False | — |
| name | TEXT | True | False | — |
| description | TEXT | True | False | '' |
| category | TEXT | True | False | — |
| condition | TEXT | True | False | — |
| price_cents | INTEGER | True | False | — |
| stock | INTEGER | True | False | 0 |
| active | INTEGER | True | False | 1 |
| photo_filename | TEXT | False | False | — |

Relaciones:
- Sin claves foráneas.

## schema_migrations

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| version | INTEGER | True | True | — |
| applied_at | TEXT | True | False | CURRENT_TIMESTAMP |

Relaciones:
- Sin claves foráneas.

## sessions

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| token_hash | TEXT | True | True | — |
| user_id | INTEGER | True | False | — |
| expires_at | INTEGER | True | False | — |

Relaciones:
- `user_id` referencia `users.id`; al eliminar: `CASCADE`.

## settings

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| key | TEXT | True | True | — |
| value | TEXT | True | False | — |

Relaciones:
- Sin claves foráneas.

## stock_movements

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| product_id | INTEGER | True | False | — |
| quantity | INTEGER | True | False | — |
| reason | TEXT | True | False | — |
| user_id | INTEGER | True | False | — |
| order_id | INTEGER | False | False | — |
| created_at | TEXT | True | False | strftime('%Y-%m-%dT%H:%M:%fZ','now') |

Relaciones:
- `order_id` referencia `orders.id`; al eliminar: `NO ACTION`.
- `user_id` referencia `users.id`; al eliminar: `NO ACTION`.
- `product_id` referencia `products.id`; al eliminar: `NO ACTION`.

## transfer_items

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| transfer_id | INTEGER | True | True | — |
| device_id | INTEGER | True | True | — |

Relaciones:
- `device_id` referencia `devices.id`; al eliminar: `NO ACTION`.
- `transfer_id` referencia `transfers.id`; al eliminar: `NO ACTION`.

## transfers

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| edge_id | INTEGER | True | False | — |
| period | TEXT | True | False | — |
| status | TEXT | True | False | 'PENDIENTE' |
| created_by | INTEGER | True | False | — |
| confirmed_by | INTEGER | False | False | — |
| created_at | TEXT | True | False | CURRENT_TIMESTAMP |
| confirmed_at | TEXT | False | False | — |

Relaciones:
- `confirmed_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `created_by` referencia `users.id`; al eliminar: `NO ACTION`.
- `edge_id` referencia `network_edges.id`; al eliminar: `NO ACTION`.

## users

| Columna | Tipo | Requerida | PK | Predeterminado |
|---|---|---|---|---|
| id | INTEGER | True | True | — |
| name | TEXT | True | False | — |
| email | TEXT | True | False | — |
| password_hash | TEXT | True | False | — |
| role | TEXT | True | False | — |
| client_id | INTEGER | False | False | — |
| active | INTEGER | True | False | 1 |
| photo_filename | TEXT | False | False | — |

Relaciones:
- `client_id` referencia `clients.id`; al eliminar: `RESTRICT`.
