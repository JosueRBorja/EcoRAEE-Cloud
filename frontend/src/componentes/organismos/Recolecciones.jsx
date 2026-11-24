import { useState } from "react";
import useResource from "../../hooks/usarRecurso";
import { api } from "../../servicios/api";
import Field from "../moleculas/CampoFormulario";
import Button from "../atomos/Boton";
import { can } from "../../utilidades/permisos";
import { guidedOptions } from "../../utilidades/opcionesFormulario";

function collectionProgress(request) {
  if (request.status === "CANCELADA") return "Cancelada";
  if (request.status === "SOLICITADA") {
    return request.approved_by_name
      ? "Aprobada · Lleva el equipo a la tienda AWStore"
      : "Enviada · Pendiente de aprobación por Ventas";
  }
  return "Recepción registrada";
}

const deviceProgress = {
  RECEPCIONADO: "Recibido · Pendiente de ingreso a taller",
  EN_EVALUACION: "En taller · Pendiente de diagnóstico técnico",
  CLASIFICADO: "Diagnosticado · Pendiente de confirmar el destino",
  CERRADO: "Finalizado · Destino confirmado",
};

export default function Collections({ user, clients = [] }) {
  const requests = useResource("/collections");
  const [client, setClient] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [otherEquipment, setOtherEquipment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isCustomer = user.role === "client";
  return <><h2>Entrega de equipos en tienda</h2><p>{isCustomer
    ? "Envía tu solicitud y espera la aprobación de Ventas. Cuando aparezca como aprobada, lleva el equipo personalmente a la tienda AWStore."
    : "Registra la solicitud a nombre del cliente. Después de aprobarla, el cliente debe llevar el equipo a la tienda AWStore."}</p>
    {can(user, "client", "sales") && <form onSubmit={async e => {
      e.preventDefault();
      const customType = otherEquipment.trim();
      const description = equipmentType === "other" ? `Otro equipo: ${customType}` : equipmentType;
      if (equipmentType === "other" && customType.length < 3) {
        setMessage("Escribe el tipo de equipo con al menos 3 caracteres.");
        return;
      }
      setBusy(true); setMessage("");
      try { await api("/collections", { method: "POST", body: { client_id: isCustomer ? null : Number(client), description } }); setEquipmentType(""); setOtherEquipment(""); setMessage("Solicitud enviada. Ventas debe aprobarla antes de la entrega en tienda."); requests.reload(); }
      catch (err) { setMessage(err.message); } finally { setBusy(false); }
    }}>
      {user.role !== "client" && <Field label="Remitente" as="select" required value={client} onChange={e => setClient(e.target.value)}><option value="">Selecciona un remitente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Field>}
      <Field label="Tipo de equipo" as="select" required value={equipmentType} onChange={e => setEquipmentType(e.target.value)}>
        <option value="">Selecciona un tipo</option>
        {guidedOptions["Equipos a entregar"].map(type => <option key={type}>{type}</option>)}
        <option value="other">Otro equipo</option>
      </Field>
      {equipmentType === "other" && <Field label="¿Qué equipo vas a entregar?" required minLength={3} maxLength={100} value={otherEquipment} onChange={e => setOtherEquipment(e.target.value)} showExceptionHint={false} />}
      <Button disabled={busy}>{busy ? "Enviando…" : "Solicitar entrega en tienda"}</Button>
    </form>}
    {(message || requests.error) && <p role="status">{message || requests.error}</p>}
    <h3>Seguimiento de equipos</h3>
    {requests.loading && <p role="status">Cargando seguimiento…</p>}
    {!requests.loading && !requests.error && !requests.data.length && <p>Aún no hay solicitudes.</p>}
    <div className="table-scroll">
      <table>
        <thead><tr><th>Solicitud</th><th>Equipo</th><th>Estado y siguiente paso</th></tr></thead>
        <tbody>{requests.data.flatMap(request => request.devices?.length
          ? request.devices.map(device => <tr key={device.code}>
              <td>#{request.id}</td>
              <td><strong>{device.model}</strong><br />{device.code}</td>
              <td>{deviceProgress[device.status]}</td>
            </tr>)
          : <tr key={request.id}>
              <td>#{request.id}</td><td>{request.description}</td><td>{collectionProgress(request)}</td>
            </tr>)}</tbody>
      </table>
    </div>
  </>;
}
