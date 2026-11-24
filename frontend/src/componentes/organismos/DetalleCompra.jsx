import { useEffect, useState } from "react";
import Button from "../atomos/Boton";
import Badge from "../atomos/EtiquetaEstado";
import Skeleton from "../atomos/EsqueletoCarga";
import Field from "../moleculas/CampoFormulario";
import { api } from "../../servicios/api";
import { can } from "../../utilidades/permisos";
import { money } from "../../utilidades/dinero";
import { formatDate } from "../../utilidades/formato";

function PaymentForm({ installment, onSaved }) {
  const remaining = installment.amount_cents - installment.paid_cents;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/installments/${installment.id}/payments`, {
        method: "POST",
        body: { amount_cents: Math.round(Number(amount) * 100), reference },
      });
      onSaved("Pago registrado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="payment-form">
      <div className="form-grid">
        <Field
          label={`Pago de cuota ${installment.number} (USD)`}
          type="number"
          required
          min="0.01"
          max={remaining / 100}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Field
          label={`Referencia de cuota ${installment.number}`}
          required
          minLength={3}
          maxLength={80}
          placeholder="Ej. RECIBO-001"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
      <Button variant="secondary" disabled={busy}>
        {busy ? "Registrando…" : "Registrar pago local"}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default function OrderDetail({
  orderId,
  user,
  onChanged,
  notify,
  onTrace,
}) {
  const [order, setOrder] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [approvedInstallments, setApprovedInstallments] = useState("3");
  useEffect(() => {
    let active = true;
    setLoading(true);
    api(`/orders/${orderId}`)
      .then((data) => {
        if (active) {
          setOrder(data);
          setApprovedInstallments(
            String(data.installments === 1 ? 3 : data.installments),
          );
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, revision]);
  function saved(message) {
    notify(message);
    setAction("");
    setRevision((v) => v + 1);
    onChanged();
  }
  async function execute(path, body) {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/orders/${orderId}/${path}`, {
        method: "POST",
        body,
      });
      saved(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Skeleton />;
  if (!order)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  const mayDecide = can(
    user,
    order.payment_type === "CREDITO" ? "finance" : "sales",
  );
  return (
    <div className="order-detail">
      <div className="order-summary">
        <Badge value={order.status} />
        <strong>{money(order.total_cents)}</strong>
        <span>
          {order.payment_type === "CREDITO"
            ? `Crédito · ${order.installments} cuotas sin interés`
            : "Contado"}
        </span>
      </div>
      <section className="delivery-summary">
        <h3>{order.delivered_at ? "Compra entregada" : "Forma de entrega"}</h3>
        <p>
          {order.delivery_mode === "ENTREGA"
            ? `Entrega a domicilio · ${order.delivery_address}`
            : "Retiro en tienda AWStore"}
          {order.contact_phone && ` · Contacto: ${order.contact_phone}`}
        </p>
        {order.delivered_at && (
          <small>Registrada el {formatDate(order.delivered_at)}</small>
        )}
        {order.cash_receipt && (
          <p className="confirmed">
            Pago de prueba confirmado · {order.cash_receipt.reference} ·{" "}
            {money(order.cash_receipt.amount_cents)}
          </p>
        )}
        {order.status === "CONFIRMADO" &&
          !order.delivered_at &&
          can(user, "sales") && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setAction("deliver")}
            >
              Registrar entrega al cliente
            </Button>
          )}
      </section>
      <p className="section-hint">
        Pedido creado el {formatDate(order.created_at)}
      </p>
      <div className="order-items">
        {order.items.map((item) => (
          <div key={item.id}>
            <span>
              {item.quantity} × {item.name}
              <small>{money(item.price_cents)} por unidad</small>
            </span>
            <strong>{money(item.quantity * item.price_cents)}</strong>
          </div>
        ))}
      </div>
      {order.tradein_model && (
        <p className="tradein-note">
          Plan canje <strong>{order.tradein_model}</strong>.{" "}
          {order.tradein_reward_cents > 0
            ? `Generó ${money(order.tradein_reward_cents)} de saldo de canje.`
            : order.tradein_reward_cents === 0
              ? "El diagnóstico determinó que el equipo no es recuperable."
              : order.tradein_device_id
                ? "Equipo recibido. El diagnóstico determinará el valor del canje."
                : "Pendiente de entrega del equipo a Ventas."}
        </p>
      )}
      {order.tradein_discount_cents > 0 && (
        <p className="tradein-note">Descuento aplicado con saldo de canje <strong>{money(order.tradein_discount_cents)}</strong>.</p>
      )}
      {order.rejection_reason && (
        <p className="error">Motivo de rechazo: {order.rejection_reason}</p>
      )}
      {order.status === "PENDIENTE" && (
        <div className="order-decisions">
          {mayDecide && (
            <>
              <p className="section-hint">
                {order.payment_type === "CREDITO"
                  ? "La aprobación genera cuotas mensuales y descuenta el inventario. Revisa la solicitud antes de confirmar."
                  : "Confirma únicamente cuando se haya verificado el pago de contado. Esta aplicación no procesa cobros."}
              </p>
              <div className="heading-actions">
                <Button onClick={() => setAction("approve")}>
                  {order.payment_type === "CREDITO"
                    ? "Aprobar crédito"
                    : "Confirmar venta de contado"}
                </Button>
                <Button variant="secondary" onClick={() => setAction("reject")}>
                  Rechazar solicitud
                </Button>
              </div>
            </>
          )}
          {can(user, "client", "sales") && (
            <Button variant="ghost" onClick={() => setAction("cancel")}>
              Cancelar pedido pendiente
            </Button>
          )}
        </div>
      )}
      {action && (
        <div className="action-confirm">
          <h3>
            {action === "deliver"
              ? "¿Confirmar que el cliente recibió su compra?"
              : action === "approve"
                ? "¿Confirmar aprobación?"
                : action === "reject"
                  ? "Motivo de rechazo"
                  : "¿Cancelar este pedido?"}
          </h3>
          {action === "approve" && order.payment_type === "CREDITO" && (
            <div className="credit-plan-editor">
              <Field
                label="Cuotas aprobadas por finanzas"
                as="select"
                value={approvedInstallments}
                onChange={(e) => setApprovedInstallments(e.target.value)}
              >
                <option value="3">3 cuotas mensuales</option>
                <option value="6">6 cuotas mensuales</option>
                <option value="12">12 cuotas mensuales</option>
              </Field>
              <p>
                Financiar <strong>{money(order.total_cents)}</strong> en{" "}
                <strong>{approvedInstallments} cuotas</strong> de
                aproximadamente{" "}
                <strong>
                  {money(
                    Math.ceil(order.total_cents / Number(approvedInstallments)),
                  )}
                </strong>
                .
              </p>
              <small>
                Sin interés. El ajuste de centavos se distribuye al generar el
                plan. Primer vencimiento: un mes después de aprobar.
              </small>
            </div>
          )}
          {action === "reject" && (
            <Field
              label="Motivo"
              options={["Documentación incompleta", "Capacidad de pago insuficiente", "Datos de contacto no verificables", "Solicitud cancelada por el cliente", "Incumplimiento de las condiciones de crédito"]}
              as="textarea"
              minLength={5}
              maxLength={250}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <div className="heading-actions">
            <Button
              disabled={
                busy || (action === "reject" && reason.trim().length < 5)
              }
              onClick={() =>
                execute(
                  action === "deliver"
                    ? "deliver"
                    : action === "cancel"
                      ? "cancel"
                      : "decision",
                  action === "cancel" || action === "deliver"
                    ? undefined
                    : {
                        approve: action === "approve",
                        reason,
                        ...(action === "approve" &&
                        order.payment_type === "CREDITO"
                          ? { installments: Number(approvedInstallments) }
                          : {}),
                      },
                )
              }
            >
              {busy ? "Guardando…" : "Confirmar"}
            </Button>
            <Button variant="secondary" onClick={() => setAction("")}>
              Volver
            </Button>
          </div>
        </div>
      )}
      {order.status === "CONFIRMADO" &&
        order.tradein_model &&
        !order.tradein_device_id &&
        can(user, "sales") && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => execute("receive-tradein")}
          >
            Recibir equipo de canje
          </Button>
        )}
      {order.tradein_device_id && can(user, "sales") && (
        <Button
          variant="secondary"
          onClick={() => onTrace(order.tradein_device_id)}
        >
          Ver expediente del canje
        </Button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!!order.installments_detail.length && (
        <section className="installments-section">
          <h3>Plan de cuotas</h3>
          <div className="finance-totals">
            <span>Total: {money(order.total_cents)}</span>
            <strong>
              Saldo:{" "}
              {money(
                order.installments_detail.reduce(
                  (sum, i) => sum + i.amount_cents - i.paid_cents,
                  0,
                ),
              )}
            </strong>
          </div>
          {order.installments_detail.map((installment) => (
            <article className="installment-card" key={installment.id}>
              <div>
                <strong>Cuota {installment.number}</strong>
                <span>Vence: {installment.due_date}</span>
                <Badge
                  value={
                    installment.paid_cents === installment.amount_cents
                      ? "PAGADO"
                      : "PENDIENTE"
                  }
                />
              </div>
              <p>
                {money(installment.amount_cents)} · Pagado:{" "}
                {money(installment.paid_cents)} · Pendiente:{" "}
                {money(installment.amount_cents - installment.paid_cents)}
              </p>
              {can(user, "finance") &&
                installment.paid_cents < installment.amount_cents && (
                  <PaymentForm
                    key={`${installment.id}-${installment.paid_cents}`}
                    installment={installment}
                    onSaved={saved}
                  />
                )}
            </article>
          ))}
        </section>
      )}
      {!!order.payments.length && (
        <section className="payment-history">
          <h3>Pagos registrados</h3>
          {order.payments.map((p) => (
            <div key={p.id}>
              <span>
                Cuota {p.number} · {p.reference}
                <small>{formatDate(p.created_at)}</small>
              </span>
              <strong>{money(p.amount_cents)}</strong>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
