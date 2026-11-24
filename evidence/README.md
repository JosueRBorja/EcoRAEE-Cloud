# Índice de evidencias locales

| Archivo o comprobación | Propósito | Condiciones |
|---|---|---|
| `math-scenarios.json` | Flujo máximo, corte y flujo por arista | Dataset sintético conocido; factores 1, 2 y 3 |
| `sql-optimization.json` | Comparar plan y tiempo con/sin índice | SQLite en memoria; 50 000 filas; 40 consultas por escenario |
| `local-performance.json` | Mediana, p95 y tasa de error | TestClient ASGI; 100 consultas secuenciales por endpoint; datos temporales |
| `backend/tests` | Integridad, aislamiento, roles, fotos, concurrencia y recuperación | 20 pruebas automáticas; base y archivos temporales |
| Build frontend | Verificar compilación de la interfaz | `npm.cmd run build` |

La revisión de navegador comprobó tienda con diez productos, acceso único del administrador, perfil con imagen predeterminada y análisis guardado con flujo máximo de 20 equipos/mes para el origen/sumidero de la red demo. No se presentan capturas locales como evidencia AWS ni como investigación con participantes.

Los JSON se regeneran con los scripts del README. Los resultados dependen de la máquina y no se convierten en promesas de rendimiento en producción. Los scripts no cambian los datos de la instalación local del usuario.
