# Formularios guiados por rol

El administrador conserva la edición de catálogos y los campos descriptivos. Los demás roles seleccionan decisiones y descripciones habituales. Los valores ya guardados se conservan al editar para evitar sustituir registros históricos.

| Área | Selección |
| --- | --- |
| Cliente | Tipo de equipo para recolección, entrega, producto, cuotas, canje; foto mediante archivo |
| Ventas | Modelo del catálogo, categoría, condición de recepción, cliente/remitente, solicitud existente, equipos del lote |
| Técnico | Conclusión, componente, clasificación y observación de prueba; responsable de sesión automático |
| Inventario | Nombre de producto del catálogo, categoría, descripción, condición, motivos de stock, piezas de ensamble, trabajo realizado, centro de destino y escenario |
| Finanzas | Pedido, aprobación, cuotas y motivo de rechazo |

El SKU de productos lo genera la aplicación y se conserva al editar. En productos, administrador e inventario buscan categorías existentes y pueden registrar una nueva si falta. Se reutilizan nombres equivalentes ignorando mayúsculas, acentos y espacios repetidos. El modelo se selecciona o se ingresa puntualmente cuando es nuevo o necesita corrección.

La ficha técnica utiliza selectores de RAM, almacenamiento, tipo de unidad, procesador, pantalla, resolución, conectividad, interfaz, potencia y batería según la categoría. Se dejan sin dato las características desconocidas: no se inventan especificaciones de productos anteriores. Una categoría nueva utiliza el perfil general. La descripción se genera en la interfaz y se vuelve a generar en el servidor al guardar. Inventario puede activar una corrección excepcional y debe registrar un motivo; tanto la descripción corregida como el motivo se conservan al volver a abrir la ficha. Cambiar características o condición regresa al modo automático. Las especificaciones se guardan en un campo JSON con validación de valores y claves en el servidor.

Excepciones de escritura: identidad de una persona nueva, documento, correo, contraseña, teléfono, dirección exacta, referencia real de pago, importe, cantidad física y medición de voltaje. Las búsquedas permiten escribir porque filtran y no guardan datos. Fechas y meses utilizan los controles del navegador.

Los selectores guían la interfaz; la API sigue validando tipos, tamaños, permisos, claves y transacciones. Seleccionar una opción no sustituye las restricciones de la base de datos. No se migró la aplicación a la base académica SQL Server.
