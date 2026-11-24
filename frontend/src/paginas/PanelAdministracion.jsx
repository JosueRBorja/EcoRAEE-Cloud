import {
  ShoppingBag,
  Wallet,
  ShieldCheck,
  Boxes,
  Wrench,
  ArrowUpRight,
  Users,
  Recycle,
  Truck,
} from "lucide-react";
import useResource from "../hooks/usarRecurso";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import StatCard from "../componentes/moleculas/TarjetaIndicador";
import Button from "../componentes/atomos/Boton";
import { money } from "../utilidades/dinero";

export default function AdminDashboard({ onNavigate }) {
  const { data, loading, error, reload } = useResource("/admin-summary");
  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="error">
        {error}
        <Button onClick={reload}>Reintentar</Button>
      </div>
    );
  const departments = [
    [
      "orders",
      "Ventas y finanzas",
      `${data.pending_credits} créditos por revisar · ${data.pending_deliveries} compras por entregar`,
      ShoppingBag,
    ],
    [
      "products",
      "Bodega y fabricación",
      `${data.stock_units} unidades · ${data.low_stock} productos con existencias bajas`,
      Boxes,
    ],
    [
      "workshop",
      "Taller y reciclaje",
      `${data.workshop_pending} equipos pendientes de evaluación`,
      Wrench,
    ],
    [
      "inventory",
      "Piezas recuperadas",
      `${data.reusable} piezas reutilizables sin destino`,
      Recycle,
    ],
    [
      "users",
      "Usuarios y accesos",
      `${data.active_users} cuentas habilitadas para entrar`,
      Users,
    ],
    [
      "trace",
      "Historial de equipos",
      "Consulta el recorrido desde recepción hasta su destino",
      Truck,
    ],
  ];
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">AWSTORE · ADMINISTRACIÓN</div>
          <h1>
            Todo conectado, en un vistazo<span>.</span>
          </h1>
          <p>
            Ventas, créditos, inventario y recuperación en un mismo espacio.
          </p>
        </div>
        <Button variant="secondary" onClick={reload}>
          Actualizar resumen
        </Button>
      </section>
      <section className="stats-grid">
        <StatCard
          label="Ventas confirmadas"
          value={money(data.confirmed_cents)}
          description="Importe vendido; incluye crédito"
          icon={ShoppingBag}
        />
        <StatCard
          label="Saldo de créditos"
          value={money(data.balance_cents)}
          description="Total de cuotas por cobrar"
          icon={Wallet}
        />
        <StatCard
          label="Créditos pendientes"
          value={data.pending_credits}
          description="Solicitudes por revisar"
          icon={ShieldCheck}
        />
        <StatCard
          label="Unidades disponibles"
          value={data.stock_units}
          description="Existencias de productos activos"
          icon={Boxes}
          accent
        />
      </section>
      <section className="department-grid">
        {departments.map(([page, title, description, Icon]) => (
          <button key={page} onClick={() => onNavigate(page)}>
            <span className="department-icon">
              <Icon size={24} />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </section>
    </>
  );
}
