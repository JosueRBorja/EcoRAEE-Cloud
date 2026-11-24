import { useState } from "react";
import {
  ArrowUpRight,
  ShoppingBag,
  Wallet,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import useResource from "../hooks/usarRecurso";
import Button from "../componentes/atomos/Boton";
import Badge from "../componentes/atomos/EtiquetaEstado";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import EmptyState from "../componentes/moleculas/EstadoVacio";
import StatCard from "../componentes/moleculas/TarjetaIndicador";
import Modal from "../componentes/organismos/Modal";
import OrderDetail from "../componentes/organismos/DetalleCompra";
import { money } from "../utilidades/dinero";
import { can } from "../utilidades/permisos";
import { formatDate } from "../utilidades/formato";

export default function Orders({
  user,
  notify,
  onChanged,
  onCatalog,
  onTrace,
}) {
  const { data, loading, error, reload } = useResource("/orders");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const finance = user.role === "finance";
  const orders = data.filter(
    (o) =>
      (!finance || o.payment_type === "CREDITO") &&
      (!filter || o.status === filter) &&
      `${o.id} ${o.client_name}`.toLowerCase().includes(query.toLowerCase()) &&
      (!deliveryFilter ||
        (deliveryFilter === "pending"
          ? o.status === "CONFIRMADO" && !o.delivered_at
          : !!o.delivered_at)),
  );
  const credits = data.filter((o) => o.payment_type === "CREDITO");
  function changed() {
    reload();
    onChanged();
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            {finance
              ? "DEPARTAMENTO DE FINANZAS"
              : user.role === "client"
                ? "TU ESPACIO PERSONAL"
                : "DEPARTAMENTO COMERCIAL"}
          </div>
          <h1>
            {finance
              ? "Créditos y pagos"
              : user.role === "client"
                ? "Mis pedidos y cuotas"
                : "Pedidos y ventas"}
          </h1>
          <p>
            {finance
              ? "Revisa solicitudes, genera planes y registra pagos con su referencia."
              : user.role === "client"
                ? "Consulta tus compras, solicitudes y el saldo de tus cuotas."
                : "Atiende compras de la tienda, registra entregas y recibe equipos usados de plan canje."}
          </p>
        </div>
        {finance ? (
          <Button type="button" variant={filter === "PENDIENTE" ? "secondary" : "primary"} onClick={() => {
            setQuery("");
            setFilter(filter === "PENDIENTE" ? "" : "PENDIENTE");
          }}>
            <Clock3 size={17} aria-hidden="true" /> {filter === "PENDIENTE" ? "Ver todas las solicitudes" : "Revisar solicitudes pendientes"}
          </Button>
        ) : can(user, "client", "sales") && (
          <Button onClick={onCatalog}>
            <ShoppingBag size={17} /> Ir al catálogo
          </Button>
        )}
      </section>
      <section className="stats-grid">
        <StatCard
          label={finance ? "Solicitudes de crédito" : "Pedidos registrados"}
          value={finance ? credits.length : data.length}
          description="Solicitudes en tu espacio"
          icon={ShoppingBag}
        />
        <StatCard
          label="Pendientes"
          value={
            (finance ? credits : data).filter((o) => o.status === "PENDIENTE")
              .length
          }
          description="Por revisar o confirmar"
          icon={Clock3}
        />
        <StatCard
          label={finance ? "Créditos confirmados" : "Ventas confirmadas"}
          value={
            (finance ? credits : data).filter((o) => o.status === "CONFIRMADO")
              .length
          }
          description={finance ? "Con plan de cuotas" : "Con descuento de existencias"}
          icon={CheckCircle2}
        />
        <StatCard
          label="Saldo de créditos"
          value={money(credits.reduce((sum, o) => sum + o.balance_cents, 0))}
          description="Cuotas pendientes de pago"
          icon={Wallet}
          accent
        />
      </section>
      <div className="department-help">
        {finance
          ? "Abre una solicitud pendiente para aprobar o rechazar. Antes de aprobar, define 3, 6 o 12 cuotas. En los créditos confirmados puedes registrar abonos y consultar saldos."
          : "Las compras con pago de prueba ya aparecen confirmadas. Abre una compra para registrar su entrega o recibir el equipo usado del canje. Los créditos los aprueba finanzas."}
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <input
            aria-label="Buscar compras por cliente"
            placeholder="Buscar por cliente o número de compra…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!finance && (
            <select
              aria-label="Filtrar entregas"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            >
              <option value="">Todas las entregas</option>
              <option value="pending">Pendientes de entrega</option>
              <option value="delivered">Ya entregadas</option>
            </select>
          )}
        </div>
        <div className="list-toolbar">
          <h2>{finance ? "Solicitudes de crédito" : "Historial de pedidos"}</h2>
          <select
            aria-label="Filtrar pedidos por estado"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {["PENDIENTE", "CONFIRMADO", "RECHAZADO", "CANCELADO"].map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <Skeleton />
        ) : error ? (
          <p className="error" role="alert">
            {error}
            <Button onClick={reload}>Reintentar</Button>
          </p>
        ) : orders.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Forma de compra</th>
                  <th>Total / saldo</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>Pedido #{o.id}</strong>
                      <span className="code">{formatDate(o.created_at)}</span>
                    </td>
                    <td>
                      {o.client_name}
                      {o.tradein_model && (
                        <span className="code">
                          Canje {o.device_id ? "recibido" : "solicitado"}
                        </span>
                      )}
                    </td>
                    <td>
                      {o.payment_type === "CREDITO"
                        ? `Crédito · ${o.installments} cuotas`
                        : "Contado"}
                    </td>
                    <td>
                      <strong>{money(o.total_cents)}</strong>
                      {o.payment_type === "CREDITO" &&
                        o.status === "CONFIRMADO" && (
                          <span className="code">
                            Saldo {money(o.balance_cents)}
                          </span>
                        )}
                    </td>
                    <td>
                      <Badge value={o.status} />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`Abrir pedido ${o.id}`}
                        onClick={() => setSelected(o.id)}
                      >
                        <ArrowUpRight size={19} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay pedidos"
            description="Los pedidos y solicitudes aparecerán aquí cuando se envíen desde el catálogo."
          />
        )}
      </section>
      {selected && (
        <Modal title={`Pedido #${selected}`} onClose={() => setSelected(null)}>
          <OrderDetail
            orderId={selected}
            user={user}
            onChanged={changed}
            notify={notify}
            onTrace={onTrace}
          />
        </Modal>
      )}
    </>
  );
}
