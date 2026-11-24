# Innovación responsable: AWStore

Este análisis corresponde al escenario ficticio del proyecto. Es una propuesta de intervención y de evaluación; no presenta encuestas, entrevistas ni impactos ambientales medidos como si se hubieran realizado.

## Actores e intereses

| Actor | Interés | Poder y barrera potencial | Respuesta de diseño |
|---|---|---|---|
| Cliente comprador | Equipo útil y precio claro | Dependencia del diagnóstico de la tienda | Condición visible y detalle del producto |
| Generador de equipos usados | Entrega y destino rastreable | Puede desconocer riesgos de datos en discos | Instrucciones previas de borrado seguro; no subir datos del dispositivo |
| Personal de recepción | Identificar origen y piezas | Puede recibir registros incompletos | Campos requeridos y códigos únicos |
| Técnico | Diagnóstico documentado | Concentra conocimiento técnico | Identidad obtenida de la sesión e historial |
| Inventario y logística | Evitar sobreventa y sobrecarga | Decide qué equipo y centro recibe recursos | Transacciones, reservas y análisis de capacidad |
| Reciclador y trabajador informal | Recuperar materiales con seguridad | Baja visibilidad y riesgo de exclusión | Incluirlos en evaluación futura; no asumir certificación por registrarlos |
| Beneficiario | Acceder a equipos funcionales | Puede recibir equipos inseguros o inservibles | Solo reutilizables; no recuperables nunca a beneficiarios |
| Administrador | Operación y control | Acceso amplio a datos y permisos | Revisión de accesos, auditoría y separación de funciones |

## Top-down y bottom-up

Top-down: administración define roles, capacidades y controles; aporta consistencia, pero puede ignorar necesidades de usuarios con baja conectividad. Bottom-up: remitentes, técnicos y beneficiarios proponen categorías, procedimientos de entrega y criterios de uso; aporta conocimiento práctico, pero necesita coordinación para conservar integridad.

La intervención combina controles centrales de seguridad con revisión participativa de formularios y barreras de acceso. El algoritmo recomienda capacidad de una red; no decide quién merece recibir un equipo ni sustituye criterios sociales explícitos.

## Matriz de riesgos

| Riesgo | Impacto previsto | Control aplicado/propuesto | Residual |
|---|---|---|---|
| Publicación de fotos personales | Exposición de identidad y metadatos | Perfil privado; reencodificación sin metadatos | Una foto todavía puede revelar información visual |
| Exclusión por no tener foto | Barrera innecesaria para comprar o trabajar | Foto opcional con ilustración predeterminada | Validar comprensión con participantes |
| Confusión entre portales | Dificultad para personal y clientes | Login único y rol asignado en servidor | Falta recuperación de contraseña |
| Entrega de residuos peligrosos a beneficiarios | Traslado de riesgos a grupos con menos poder | Clasificación y destino compatibles; bloqueo de no recuperables | Diagnóstico técnico humano puede fallar |
| Recolección excesiva de datos | Pérdida de privacidad | Datos sintéticos; no documentos reales en la demo | Definir retención y base de tratamiento antes de operar públicamente |
| Promesas ambientales sin medición | Greenwashing | Contar destinos reales registrados, sin convertirlos en CO₂ evitado | Peso e impacto ambiental todavía no medidos |
| Exclusión de trabajadores informales | Concentración del valor recuperado | Revisión participativa propuesta y seguimiento por actor | No existe aún evidencia de participación real |
| Dependencia tecnológica | Costos y dificultades de recuperación | Repositorio, respaldo y recuperación local | Futura nube requiere plan de salida y costos |

## Cambios concretos del producto derivados del análisis

1. Las fotos son opcionales y tienen alternativa visual; no se condiciona el acceso a una imagen personal.
2. Se unifica el acceso para reducir confusión; los permisos continúan controlados por la cuenta.
3. Las fotos de perfil son privadas; las imágenes comerciales son públicas solamente para productos activos.
4. La clasificación no recuperable no admite beneficiario y el expediente requiere evidencia antes del cierre.

Estos cambios son verificables en componentes de formularios, `fotos.py`, `seguridad.py` y `servicios.py`. Son decisiones del escenario; no se atribuyen a una investigación de campo inexistente.

## Intervención propuesta y evaluación

Piloto académico con cuentas sintéticas: un comprador, un remitente, recepción, técnico, inventario y beneficiario simulado recorren el proceso. Antes de iniciar, informar propósito, datos utilizados y que no hay cobros reales. Registrar tareas completadas, errores de comprensión, tiempo de tarea y propuestas. No grabar rostro ni documentos personales. Permitir retirarse y usar formularios asistidos.

Indicadores: expedientes completos/registrados; piezas con destinos por tipo; solicitudes recibidas/solicitadas; porcentaje de tareas completadas sin ayuda; barreras detectadas/resueltas; incidencias de permisos; participantes por rol. Los indicadores operativos disponibles en la aplicación no se presentan como resultados sociales ya observados.

## Escenario futuro crítico

Una red ampliada puede facilitar redistribución tecnológica y recuperación de componentes. También puede centralizar decisiones, desplazar prácticas comunitarias y promover consumo adicional bajo una etiqueta circular. Se propone revisar criterios de asignación, accesibilidad, capacidad real y costos con los actores, mantener exportabilidad y medir reparación/reutilización efectiva, no solo recepción de residuos.

Pendientes: validar con participantes, contrastar impactos con fuentes académicas de la asignatura, establecer retención de datos y definir un mecanismo de reclamos antes de operación real.
