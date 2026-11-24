# Estado frente al proyecto integrador

Revisión local de AWStore. Fecha: 19 de noviembre de 2026. Los estados distinguen código probado, análisis documental y trabajo futuro. Ningún recurso AWS se ha creado o desplegado. La presencia de un documento no demuestra por sí sola validación con usuarios ni aprobación docente.

| Requisitos | Estado | Componente y evidencia | Pendiente |
|---|---|---|---|
| RF-MD-01/02 | Formalización incluida | `math/README.md`: proposiciones, tablas, conjuntos, relaciones y funciones | Revisión docente de supuestos |
| RF-MD-03/04/05 | Implementado y probado localmente | `flujo.py`, `logistica.py`, dataset manual, `math-scenarios.json`, FlowTests | Evidencia de la defensa e interpretación del equipo |
| RF-CL-01 a 07 | Pendiente, por decisión del usuario | `infrastructure/README.md`: plan explícito | AWS, IaC ejecutable, IAM/VPC, S3/RDS, logs, costos y resiliencia |
| RF-BD-01 | Parcial | DDL, diccionario real, relaciones Mermaid y modelo conceptual descrito | EER completo revisado académicamente |
| RF-BD-02 | Implementado localmente | PK/FK/CHECK, validadores, índices y triggers | Repetir en motor RDS cuando se implemente |
| RF-BD-03 | Análisis inicial | Dependencias y excepciones en `datos-y-seguridad.md` | Validación formal completa de normalización |
| RF-BD-04/05 | Implementado en SQLite | Consultas, CTE, función de ventana, vistas y triggers | Portabilidad PostgreSQL futura |
| RF-BD-06 | Medido sobre datos sintéticos | `sql-optimization.json`: plan y tiempos antes/después | Medición con carga representativa final |
| RF-BD-07 | Pruebas locales | Rollback, venta concurrente de última unidad y recuperación conjunta | Prueba de fallo del host y recuperación cloud |
| RF-IN-01 a 05 | Análisis/propuesta incluidos | `innovation/analisis.md`, guion inglés y decisiones de fotos/acceso | Fuentes académicas, participación real, presentación y resultados sociales |
| RF-AE-01 a 06 | Modelos y propuesta incluidos | Contexto ficticio, capacidades, AS-IS/TO-BE, BPMN, marco, brechas y roadmap | Validación con el equipo, acta real de ARB y revisión docente |
| RF-INT-01 | Probado localmente | Login único por cada rol, accesos permitidos/denegados | Identidades operativas antes de producción |
| RF-INT-02/03 | Implementado localmente | Equipos, lotes, evidencias, diagnósticos, destinos y transferencias | Demostración con escenario final acordado |
| RF-INT-04 | Implementado localmente | API lee nodos/aristas/capacidades SQL y guarda entrada/salida en `flow_runs` | Repetir con RDS |
| RF-INT-05 | Implementado con alcance limitado | Métricas de expedientes, clasificación, destinos y capacidad/flujo | Peso, impacto ambiental y disponibilidad real no medidos |
| RF-INT-06 | Reproducción local documentada | Lock de dependencias, scripts, tests, respaldo y guía | Video, memoria académica consolidada y evidencia cloud |

## Casos de prueba del documento

| Caso | Evidencia local | Estado |
|---|---|---|
| CP-01 | Login de seis roles y denegación por permisos | Verificado |
| CP-02 | Recepción individual y lote con códigos independientes | Verificado |
| CP-03 | Rechazo de transición inválida y diagnóstico duplicado | Verificado |
| CP-04 | FK, eliminación restringida y foreign_key_check | Verificado |
| CP-05 | Transferencia sin evidencia revierte todos los equipos | Verificado |
| CP-06 | SCAN frente a SEARCH con índice en 50 000 eventos sintéticos | Verificado con alcance de benchmark local |
| CP-07/08 | Red manual: flujo y corte 5; capacidades ampliadas: 10 y 15 | Verificado |
| CP-09 | Datos SQL locales al algoritmo | Parcial: falta RDS |
| CP-10/11/12/13 | Servicios/red/IAM/IaC/CloudWatch | Pendiente AWS |
| CP-14 | Ciclo recepción → evaluación → evidencia → destinos → cierre | Verificado en pruebas locales |
| CP-15 | Recorrido de navegador por tienda, login, perfil y análisis | Revisión técnica; faltan participantes y escenarios de inclusión |

## Evidencias y reproducción

- Suite: `python -m unittest discover -s backend/tests -v` desde el entorno virtual. Última ronda: 20 pruebas correctas. La prueba de respaldo detectó un bloqueo de archivos en Windows; se corrigió cerrando explícitamente las conexiones SQLite y se repitió la suite completa.
- Frontend: `npm.cmd run build` correcto.
- `evidence/math-scenarios.json`: resultados del caso manual y dos ampliaciones uniformes.
- `evidence/sql-optimization.json`: condiciones, plan y tiempos del índice.
- `evidence/local-performance.json`: 100 consultas secuenciales por endpoint en TestClient, calentamiento previo y almacenamiento temporal. No mide red, concurrencia de usuarios ni AWS.
- `evidence/README.md`: índice y límites de estas evidencias.

## Criterio de entrega

El MVP local queda ampliado y verificado. No se declara cumplimiento del 100% del documento ni aptitud para producción pública. La entrega final requiere cerrar las filas pendientes, consolidar memoria técnica según el formato académico, aportar video/defensa y realizar la etapa AWS cuando el usuario la solicite.
