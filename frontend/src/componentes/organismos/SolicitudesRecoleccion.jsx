import { useState } from "react";
import useResource from "../../hooks/usarRecurso";
import { api } from "../../servicios/api";
import Button from "../atomos/Boton";
import Field from "../moleculas/CampoFormulario";
import Modal from "./Modal";

export default function SolicitudesRecoleccion({ onApproved, onReceived }) {
  const requests = useResource("/collections");
  const network = useResource("/network");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = requests.data.filter(item => item.status === "SOLICITADA");
  const workshops = (network.data.nodes || []).filter(center => center.kind === "TALLER" && center.active);

  async function perform(action, success) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await requests.reload();
      setMessage(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function receive(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const models = fields.get("models").split("\n").map(model => model.trim()).filter(Boolean);
    if (!models.length || models.length > 100 || models.some(model => model.length < 3 || model.length > 100)) {
      setError("Escribe de 1 a 100 modelos, uno por equipo. Cada línea debe tener entre 3 y 100 caracteres.");
      return;
    }
    perform(async () => {
      await api("/batches", { method: "POST", body: {
        client_id: selected.client_id,
        center_id: Number(fields.get("center")),
        collection_id: selected.id,
        send_to_workshop: true,
        devices: models.map(model => ({ client_id: selected.client_id, model, category: fields.get("category") })),
      } });
      setSelected(null);
      onReceived();
    }, "Recepción registrada. Los equipos ya están en Taller y diagnóstico.");
  }

  return (
    <section className="panel network-card">
      <h2>Solicitudes de entrega en tienda</h2>
      <p>Ventas aprueba la solicitud. El cliente lleva el equipo a AWStore y Ventas registra la recepción física para enviarlo al taller.</p>
      {message && <p role="status">{message}</p>}
      {(requests.error || (!selected && error)) && <p role="alert">{requests.error || error}</p>}
      {requests.loading && <p role="status">Cargando solicitudes…</p>}
      {!requests.loading && !requests.error && !pending.length && <p>No hay solicitudes pendientes.</p>}
      {!!pending.length && <div className="table-scroll"><table>
        <thead><tr><th>Solicitud</th><th>Cliente</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{pending.map(item => <tr key={item.id}>
          <td>#{item.id} · {item.description}</td>
          <td>{item.client_name}</td>
          <td>{item.approved_by_name ? <>Pendiente de entrega en tienda<br /><small>Aprobada por {item.approved_by_name}</small></> : "Pendiente de aprobación por Ventas"}</td>
          <td>{item.approved_by_name
            ? <Button disabled={busy} onClick={() => { setError(""); setSelected(item); }}>Registrar recepción en tienda</Button>
            : <Button disabled={busy} onClick={() => perform(
                async () => {
                  await api(`/collections/${item.id}/approve`, { method: "POST" });
                  onApproved?.();
                },
                "Entrega en tienda aprobada. Registra la recepción cuando el cliente traiga el equipo.",
              )}>Aprobar entrega en tienda</Button>}</td>
        </tr>)}</tbody>
      </table></div>}
      {selected && <Modal title={`Registrar recepción en tienda · #${selected.id}`} onClose={() => { if (!busy) setSelected(null); }}>
        <p>Completa este formulario cuando {selected.client_name} haya entregado los equipos en tienda. Al guardar, pasarán a Taller y diagnóstico.</p>
        <form onSubmit={receive}>
          <Field label="Taller receptor" as="select" name="center" required defaultValue="">
            <option value="">Selecciona un taller</option>
            {workshops.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
          </Field>
          <Field label="Modelos recibidos (uno por equipo y por línea)" as="textarea" name="models" required rows={4} defaultValue={selected.description.length <= 100 ? selected.description : ""} />
          <Field label="Categoría del lote" name="category" required minLength={3} maxLength={60} defaultValue="Equipo tecnológico" showExceptionHint={false} />
          {(error || network.error) && <p role="alert">{error || network.error}</p>}
          {!network.loading && !network.error && !workshops.length && <p>Agrega un taller activo en Centros y traslados.</p>}
          <Button disabled={busy || !workshops.length}>{busy ? "Registrando…" : "Registrar recepción y enviar al taller"}</Button>
        </form>
      </Modal>}
    </section>
  );
}
