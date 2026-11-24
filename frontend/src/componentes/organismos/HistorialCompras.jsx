import { useState } from "react";
import { ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import useResource from "../../hooks/usarRecurso";
import Button from "../atomos/Boton";
import Badge from "../atomos/EtiquetaEstado";
import Skeleton from "../atomos/EsqueletoCarga";
import EmptyState from "../moleculas/EstadoVacio";
import OrderDetail from "./DetalleCompra";
import { money } from "../../utilidades/dinero";
import { formatDate } from "../../utilidades/formato";

export default function PurchaseHistory({ user, notify }) {
  const { data, loading, error, reload } = useResource("/orders");
  const [selected, setSelected] = useState(null);
  if (selected)
    return (
      <>
        <Button variant="ghost" onClick={() => setSelected(null)}>
          <ArrowLeft size={16} /> Volver a mis compras
        </Button>
        <OrderDetail
          orderId={selected}
          user={user}
          notify={notify}
          onChanged={reload}
        />
      </>
    );
  if (loading) return <Skeleton />;
  if (error)
    return (
      <p className="error" role="alert">
        {error}
        <Button onClick={reload}>Reintentar</Button>
      </p>
    );
  return (
    <div className="purchase-list">
      {data.length ? (
        data.map((order) => (
          <button key={order.id} onClick={() => setSelected(order.id)}>
            <ShoppingBag size={23} />
            <span>
              <strong>Compra #{order.id}</strong>
              <small>{formatDate(order.created_at)}</small>
              <Badge value={order.status} />
              <small>
                {order.payment_type === "CREDITO"
                  ? `Crédito · saldo ${money(order.balance_cents)}`
                  : "Contado"}
                {order.delivered_at ? " · Entregada" : ""}
              </small>
            </span>
            <strong>{money(order.total_cents)}</strong>
            <ArrowRight size={17} />
          </button>
        ))
      ) : (
        <EmptyState
          title="Tu primera compra está por comenzar"
          description="Cuando finalices una compra o solicites crédito, podrás consultar aquí su estado y sus cuotas."
        />
      )}
    </div>
  );
}
