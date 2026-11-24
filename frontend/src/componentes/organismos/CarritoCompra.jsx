import { useEffect, useState } from "react";
import { api } from "../../servicios/api";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import Button from "../atomos/Boton";
import Field from "../moleculas/CampoFormulario";
import EmptyState from "../moleculas/EstadoVacio";
import { money } from "../../utilidades/dinero";

export default function CartPanel({
  user,
  clients,
  lines,
  cart,
  quantity,
  remove,
  total,
  busy,
  error,
  onCheckout,
  onLoginRequired,
}) {
  const [payment, setPayment] = useState("CONTADO");
  const [installments, setInstallments] = useState("3");
  const [clientId, setClientId] = useState("");
  const [tradein, setTradein] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("RETIRO");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [tradeinBalance, setTradeinBalance] = useState(0);
  const [tradeinBalanceError, setTradeinBalanceError] = useState("");
  const [useTradeinBalance, setUseTradeinBalance] = useState(false);
  const shopper = !user || user.role === "client";
  const customerId = user?.role === "client" ? user.id : null;
  const installmentCount = payment === "CREDITO" ? Number(installments) : 1;
  const availableDiscount = customerId ? Math.max(0, Math.min(tradeinBalance, total - installmentCount)) : 0;
  const discount = useTradeinBalance ? availableDiscount : 0;
  const payable = total - discount;

  useEffect(() => {
    if (!customerId || busy) return;
    let current = true;
    api("/tradein-balance").then(({ balance_cents }) => {
      if (!current) return;
      setTradeinBalance(balance_cents);
      setTradeinBalanceError("");
    }).catch(() => {
      if (!current) return;
      setTradeinBalance(0);
      setTradeinBalanceError("No pudimos consultar tu saldo de canje.");
    });
    return () => { current = false; };
  }, [customerId, busy]);

  function submit(e) {
    e.preventDefault();
    onCheckout({
      client_id: shopper ? null : Number(clientId),
      payment_type: payment,
      installments: installmentCount,
      tradein_model: tradein,
      tradein_discount_cents: discount,
      delivery_mode: deliveryMode,
      delivery_address: deliveryMode === "ENTREGA" ? address : "",
      contact_phone: phone,
      demo_payment_confirmed: confirmed,
    });
  }
  return (
    <aside className="panel cart-panel" id="carrito">
      <h2>
        <ShoppingBag size={21} /> Tu carrito{" "}
        <span className="count-pill">
          {lines.reduce((sum, p) => sum + cart[p.id], 0)}
        </span>
      </h2>
      <p className="muted">Revisa tus productos antes de continuar.</p>
      {!lines.length ? (
        <EmptyState
          title="Tu próximo equipo te espera"
          description="Añade productos y completa tu compra aquí, a tu ritmo."
        />
      ) : (
        <>
          <div className="cart-lines">
            {lines.map((p) => (
              <article key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <span>{money(p.price_cents)} por unidad</span>
                </div>
                <div className="quantity-control">
                  <button
                    disabled={busy}
                    aria-label={`Quitar una unidad de ${p.name}`}
                    onClick={() => quantity(p, -1)}
                  >
                    <Minus size={13} />
                  </button>
                  <span>{cart[p.id]}</span>
                  <button
                    disabled={busy || cart[p.id] >= p.stock}
                    aria-label={`Añadir una unidad de ${p.name}`}
                    onClick={() => quantity(p, 1)}
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    disabled={busy}
                    aria-label={`Retirar ${p.name}`}
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-total">
            <span>Total de productos</span>
            <strong>{money(total)}</strong>
          </div>
          {!user ? (
            <div className="guest-checkout">
              <p>
                Visítanos sin cuenta. Para finalizar, regístrate o inicia
                sesión; tu carrito se conserva.
              </p>
              <Button onClick={onLoginRequired}>
                Registrarme y continuar <ArrowRight size={16} />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              {!shopper && (
                <Field
                  label="Cliente"
                  as="select"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Field>
              )}
              {shopper && (
                <div className="checkout-section">
                  <h3>1. ¿Cómo quieres recibirlo?</h3>
                  <Field
                    label="Forma de entrega"
                    as="select"
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value)}
                  >
                    <option value="RETIRO">Retiro en tienda</option>
                    <option value="ENTREGA">Entrega a domicilio</option>
                  </Field>
                  {deliveryMode === "ENTREGA" && (
                    <Field
                      label="Dirección de entrega"
                      as="textarea"
                      required
                      minLength={8}
                      maxLength={250}
                      placeholder="Sector, calle y referencia"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  )}
                  <Field
                    label="Teléfono de contacto"
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={7}
                    maxLength={25}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="section-hint">
                    {deliveryMode === "RETIRO"
                      ? "Te esperamos en AWStore. Ventas confirmará la entrega de tu compra."
                      : "Ventas coordinará la entrega contigo. Esta demostración no calcula costo de transporte."}
                  </p>
                </div>
              )}
              <div className="checkout-section">
                <h3>{shopper ? "2. Elige cómo comprar" : "Forma de compra"}</h3>
                <Field
                  label="Forma de compra"
                  as="select"
                  value={payment}
                  onChange={(e) => {
                    setPayment(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="CONTADO">
                    {shopper
                      ? "Pagar ahora · demostración local"
                      : "Contado · confirmar desde ventas"}
                  </option>
                  <option value="CREDITO">Solicitar crédito</option>
                </Field>
                {payment === "CREDITO" ? (
                  <>
                    <Field
                      label="Cuotas que prefieres"
                      as="select"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                    >
                      <option value="3">3 cuotas mensuales</option>
                      <option value="6">6 cuotas mensuales</option>
                      <option value="12">12 cuotas mensuales</option>
                    </Field>
                    <div className="credit-estimate">
                      <CreditCard size={19} />
                      <span>
                        Desde {money(Math.ceil(payable / installmentCount))}{" "}
                        al mes
                        <small>
                          Sin interés. Finanzas revisará tu solicitud y definirá
                          el plan aprobado.
                        </small>
                      </span>
                    </div>
                  </>
                ) : (
                  shopper && (
                    <label className="checkout-consent">
                      <input
                        type="checkbox"
                        required
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span>
                        Confirmo el pago de demostración.
                        <small>
                          No se realizará ningún cobro real ni se solicitan
                          datos bancarios.
                        </small>
                      </span>
                    </label>
                  )
                )}
              </div>
              <details className="tradein-details">
                <summary>¿Tienes un equipo usado para plan canje?</summary>
                <Field
                  label="Equipo para canje (opcional)"
                  maxLength={150}
                  placeholder="Ej. Laptop o monitor usado"
                  value={tradein}
                  onChange={(e) => setTradein(e.target.value)}
                />
                <p className="section-hint">
                  Cuando Taller termine el diagnóstico, el equipo puede generar saldo para tu próxima compra.
                  Recibes {money(2000)} si es reutilizable, {money(1000)} si es reparable o {money(500)} si es reciclable.
                </p>
              </details>
              {tradeinBalanceError && <p className="section-hint" role="status">{tradeinBalanceError}</p>}
              {availableDiscount > 0 && (
                <label className="checkout-consent">
                  <input type="checkbox" checked={useTradeinBalance} onChange={(e) => setUseTradeinBalance(e.target.checked)} />
                  <span>Aplicar {money(availableDiscount)} de mi saldo de canje
                    <small>Saldo disponible {money(tradeinBalance)}</small>
                  </span>
                </label>
              )}
              {discount > 0 && <div className="cart-total"><span>Total con descuento</span><strong>{money(payable)}</strong></div>}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <Button disabled={busy}>
                {busy
                  ? "Procesando…"
                  : payment === "CREDITO"
                    ? "Enviar solicitud de crédito"
                    : shopper
                      ? `Confirmar pago de prueba · ${money(payable)}`
                      : "Registrar pedido de contado"}
                <ArrowRight size={16} />
              </Button>
            </form>
          )}
        </>
      )}
      {error && !user && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
