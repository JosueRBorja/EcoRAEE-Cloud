import {
  LayoutDashboard,
  PackagePlus,
  Wrench,
  Boxes,
  Route,
  Users,
  Recycle,
  ShoppingBag,
  Package,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { pagesByRole, roleLabels } from "../../utilidades/permisos";

const links = [
  ["dashboard", "Vista general", LayoutDashboard],
  ["catalog", "Catálogo de productos", ShoppingBag],
  ["orders", "Pedidos y créditos", Wallet],
  ["products", "Productos y bodega", Package],
  ["devices", "Recepción RAEE", PackagePlus],
  ["workshop", "Taller y diagnóstico", Wrench],
  ["inventory", "Inventario circular", Boxes],
  ["trace", "Trazabilidad", Route],
  ["clients", "Clientes y remitentes", Users],
  ["users", "Usuarios y permisos", ShieldCheck],
  ["network", "Centros y traslados", Route],
];

export default function Sidebar({ page, onNavigate, user }) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        aria-label="AWStore · Inicio"
        href="#dashboard"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(pagesByRole[user.role][0]);
        }}
      >
        <span className="brand-icon">
          <Recycle size={27} />
        </span>
        <span>
          AWStore<span className="brand-caption">TECNOLOGÍA CIRCULAR</span>
        </span>
      </a>
      <div className="workspace-label">{roleLabels[user.role]}</div>
      <nav aria-label="Navegación principal">
        {links
          .filter(([id]) => pagesByRole[user.role].includes(id))
          .map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              className={`nav-link ${page === id ? "active" : ""}`}
              aria-current={page === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-footer">
          <span className="online-dot" /> Entorno local <span>v0.3</span>
        </div>
      </div>
    </aside>
  );
}
