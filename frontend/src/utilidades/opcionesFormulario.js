import { createContext } from "react";

export const FormRole = createContext("client");
export const componentNames = ["Equipo completo", "Placa base", "Procesador", "Memoria RAM", "Unidad SSD", "Disco duro", "Fuente de alimentación", "Batería", "Pantalla", "Teclado", "Ventilador", "Tarjeta de red", "Tarjeta gráfica", "Cable de alimentación", "Carcasa"];
export const guidedOptions = {
  "Trabajo realizado": ["Ensamble y pruebas funcionales satisfactorias", "Sustitución de componentes y limpieza técnica", "Reacondicionamiento y verificación de funcionamiento", "Recuperación de piezas y ensamble de equipo"],
  "Categoría": ["Computadoras", "Monitores", "Periféricos", "Audio", "Tablets", "Redes", "Componentes", "Batería", "Otro equipo eléctrico"],
  "Descripción": ["Equipo nuevo con garantía", "Equipo reacondicionado con pruebas funcionales", "Accesorio tecnológico nuevo", "Componente recuperado y probado"],
  "Conclusión de la evaluación": ["Equipo apto para reutilización tras las pruebas funcionales.", "Equipo reparable: requiere sustitución de componentes.", "Equipo destinado a recuperación de materiales.", "Equipo no recuperable: requiere disposición autorizada.", "Equipo con componentes de distintas clasificaciones; consultar el detalle."],
  "Observaciones": ["Sin anomalías en las pruebas", "No enciende", "Funcionamiento intermitente", "Daño físico visible", "Sobrecalentamiento", "Desgaste de batería", "Conector dañado", "Corrosión visible", "Prueba funcional satisfactoria"],
  "Observaciones de recepción": ["Equipo completo y sin daños visibles", "Equipo con daños físicos visibles", "Equipo sin accesorios", "Equipo con cargador", "Equipo que no enciende", "Equipo con pantalla dañada"],
  "Motivo": ["Ingreso por compra a proveedor", "Salida por entrega de pedido", "Devolución de cliente", "Ajuste por conteo físico", "Retiro por daño o deterioro", "Solicitud de crédito rechazada por documentación incompleta", "Solicitud de crédito rechazada por capacidad de pago"],
  "Equipos a entregar": ["Computadora portátil", "Computadora de escritorio", "Monitor", "Tablet", "Teléfono", "Router", "Periféricos", "Componentes electrónicos"],
  "Nombre del escenario": ["Operación mensual", "Ampliación de capacidad", "Redistribución entre centros", "Recuperación y reciclaje"],
};
