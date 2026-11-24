export const roleLabels = {
  admin: "Administrador",
  client: "Cliente",
  sales: "Ventas",
  technician: "Técnico",
  inventory: "Inventario y fabricación",
  finance: "Finanzas",
};
export const pagesByRole = {
  admin: [
    "dashboard",
    "catalog",
    "orders",
    "products",
    "devices",
    "workshop",
    "inventory",
    "trace",
    "clients",
    "users",
    "network",
  ],
  client: ["catalog"],
  sales: ["orders", "catalog", "devices", "trace", "clients", "network"],
  technician: ["workshop", "trace", "inventory", "network"],
  inventory: ["products", "inventory", "trace", "network"],
  finance: ["orders"],
};
export const can = (user, ...roles) =>
  user.role === "admin" || roles.includes(user.role);
