export const statusLabels = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
  PAGADO: "Pagado",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  RECEPCIONADO: "Recibido",
  EN_EVALUACION: "En diagnóstico",
  CLASIFICADO: "Clasificado",
  CERRADO: "Cerrado",
  REUTILIZABLE: "Se reutiliza",
  REPARABLE: "Se repara",
  RECICLABLE: "Se recicla",
  NO_RECUPERABLE: "Disposición segura",
};
export const classifications = [
  "REUTILIZABLE",
  "REPARABLE",
  "RECICLABLE",
  "NO_RECUPERABLE",
];
export function formatDate(value) {
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
