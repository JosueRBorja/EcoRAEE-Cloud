import { useState } from "react";
import Field from "../moleculas/CampoFormulario";
import Button from "../atomos/Boton";
import { api } from "../../servicios/api";
export { default as ProductForm } from "./FichaProducto";

export function StockForm({ product, onSaved, onCancel }) {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/products/${product.id}/stock`, {
        method: "POST",
        body: { quantity: Number(quantity), reason },
      });
      onSaved("Existencias actualizadas.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-description">
        {product.name} · Existencias actuales: {product.stock}. Usa una cantidad
        positiva para una entrada o negativa para una salida.
      </p>
      <Field
        label="Cantidad del movimiento"
        type="number"
        required
        min="-10000"
        max="10000"
        step="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Field
        label="Motivo"
        options={["Ingreso por compra a proveedor", "Salida de bodega autorizada", "Devolución de cliente", "Ajuste por conteo físico", "Retiro por daño o deterioro"]}
        required
        minLength={5}
        maxLength={250}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={busy}>
          {busy ? "Guardando…" : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
