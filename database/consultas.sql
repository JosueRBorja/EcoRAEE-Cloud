-- Consultas ejecutables en SQLite local. No modifican datos.
-- Inventario, agregación y valor comercial por categoría.
SELECT * FROM vw_inventory_value ORDER BY value_cents DESC;

-- Clasificación derivada por dispositivo (criterio conservador documentado).
SELECT d.code,d.model,v.classification,c.name AS center
FROM devices d JOIN vw_device_classification v ON v.device_id=d.id
LEFT JOIN centers c ON c.id=d.center_id ORDER BY d.id;

-- Historial con función de ventana: secuencia de eventos por expediente.
SELECT device_id,action,created_at,
       row_number() OVER (PARTITION BY device_id ORDER BY id) AS sequence
FROM events ORDER BY device_id,sequence;

-- Subconsulta y CTE: tasa de expedientes completos.
WITH totals AS (
 SELECT count(*) AS total,sum(CASE WHEN status='CERRADO' THEN 1 ELSE 0 END) AS closed FROM devices
)
SELECT total,coalesce(closed,0) AS closed,round(100.0*closed/nullif(total,0),2) AS closed_percent FROM totals;

-- Uso de conexiones y capacidad restante por periodo.
SELECT e.id,s.name AS source,t.name AS target,u.period,
       e.capacity,coalesce(u.used,0) AS used,e.capacity-coalesce(u.used,0) AS available
FROM network_edges e JOIN centers s ON s.id=e.source_id JOIN centers t ON t.id=e.target_id
LEFT JOIN vw_transfer_usage u ON u.edge_id=e.id ORDER BY e.id,u.period;

-- Uso del índice del historial. Sustituir 1 por un equipo de la demo.
EXPLAIN QUERY PLAN SELECT * FROM events WHERE device_id=1 ORDER BY id;
