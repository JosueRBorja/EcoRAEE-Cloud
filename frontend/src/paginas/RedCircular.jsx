import { useState } from "react";
import useResource from "../hooks/usarRecurso";
import { api } from "../servicios/api";
import Button from "../componentes/atomos/Boton";
import Field from "../componentes/moleculas/CampoFormulario";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import { can } from "../utilidades/permisos";
import Collections from "../componentes/organismos/Recolecciones";
import SolicitudesRecoleccion from "../componentes/organismos/SolicitudesRecoleccion";

const centerLabels = {
  RECOLECCION: "Recolección",
  TALLER: "Taller",
  RECICLAJE: "Reciclaje",
  DISPOSICION: "Disposición final",
  BENEFICIARIO: "Beneficiario",
};

export default function Network({ user, devices, clients, onChanged, notify }) {
  const network = useResource("/network"), transfers = useResource("/transfers");
  const metrics = useResource("/circular-metrics");
  const products = useResource("/products");
  const collections = useResource("/collections");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const [values, setValues] = useState({ source_id: "", sink_id: "", period: new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit" }).format(new Date()), scenario: "Capacidad actual", capacity_factor: "1", center_name: "", kind: "RECOLECCION", center_capacity: "100", edge_source: "", edge_target: "", edge_capacity: "20", client_id: "", center_id: "", collection_id: "", models: "", edge_id: "" });
  const [selected, setSelected] = useState([]);
  const [unitsPerModel, setUnitsPerModel] = useState("1");
  const nodes = network.data?.nodes || [], edges = network.data?.edges || [], runs = network.data?.runs || [];
  const chosenEdge = edges.find(e => e.id === Number(values.edge_id));
  const field = key => ({ value: values[key], onChange: e => setValues(v => ({ ...v, [key]: e.target.value })) });
  const nodeSelect = (label, key) => <Field label={label} as="select" required {...field(key)}><option value="">Selecciona un centro</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</Field>;
  async function perform(action, message) {
    setBusy(true); setError("");
    try { await action(); network.reload(); transfers.reload(); metrics.reload(); collections.reload(); onChanged(); if (message) notify(message); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const submit = action => e => { e.preventDefault(); perform(action, "Operación guardada."); };
  return <>
    <section className="page-heading"><div><div className="eyebrow">LOGÍSTICA Y OPTIMIZACIÓN</div><h1>Centros y traslados</h1><p>Consulta dónde están los equipos, qué rutas existen y cuántas unidades pueden moverse al mes.</p></div></section>
    {can(user, "sales") && <SolicitudesRecoleccion onApproved={collections.reload} onReceived={() => {
      collections.reload();
      network.reload();
      metrics.reload();
      onChanged();
    }} />}
    {(error || network.error || transfers.error || metrics.error) && <p className="error" role="alert">{error || network.error || transfers.error || metrics.error}</p>}
    <section className="network-grid"><article className="panel network-card"><span className="eyebrow">TRAZABILIDAD COMPLETA</span><h2>{metrics.data.traceability_percent || 0}%</h2><p>{metrics.data.closed || 0} {metrics.data.closed === 1 ? "expediente cerrado" : "expedientes cerrados"} de {metrics.data.devices || 0} en total.</p></article><article className="panel network-card"><span className="eyebrow">CLASIFICACIÓN DE EQUIPOS</span>{(metrics.data.classification || []).map(c => <p key={c.classification}>{c.classification}: {c.quantity}</p>)}</article><article className="panel network-card"><span className="eyebrow">DESTINOS CONFIRMADOS</span>{(metrics.data.destinations || []).map(d => <p key={d.destination_type}>{d.destination_type}: {d.quantity} {d.quantity === 1 ? "pieza" : "piezas"}</p>)}</article></section>
    {network.loading ? <Skeleton /> : <>
      <section className="network-grid">{nodes.map(n => <article className="panel network-card" key={n.id}><span className="eyebrow">{centerLabels[n.kind] || n.kind}</span><h2>{n.name}</h2><p>{n.inventory} equipos en inventario · capacidad {n.capacity}</p></article>)}</section>
      <section className="panel padded business-section"><h2>Conexiones de la red</h2><div className="table-scroll"><table><thead><tr><th>Origen</th><th>Destino</th><th>Capacidad mensual</th></tr></thead><tbody>{edges.map(e => <tr key={e.id}><td>{e.source_name}</td><td>{e.target_name}</td><td>{e.capacity} equipos</td></tr>)}</tbody></table></div></section>
      <section className="network-grid business-section">
        {can(user, "inventory") && <form className="panel network-card" onSubmit={submit(async () => setResult(await api("/network/analyze", { method: "POST", body: { source_id: Number(values.source_id), sink_id: Number(values.sink_id), scenario: values.scenario, period: values.period, capacity_factor: Number(values.capacity_factor) } })))}><h2>Análisis de capacidad</h2>
          {nodeSelect("Origen", "source_id")}{nodeSelect("Centro de destino", "sink_id")}
          <Field label="Mes del escenario" type="month" required {...field("period")} />
          <Field label="Nombre del escenario" required minLength={3} maxLength={100} {...field("scenario")} />
          <Field label="Escala de capacidad (simulación)" as="select" {...field("capacity_factor")}><option value="1">1× · capacidad disponible actual</option><option value="2">2× · ampliar capacidad</option><option value="3">3× · ampliar capacidad</option></Field>
          <p className="section-hint">Edmonds-Karp con límites por centro y conexión. La simulación conserva las capacidades operativas.</p><Button disabled={busy}>Calcular flujo y corte mínimo</Button>
        </form>}
        {can(user) && <form className="panel network-card" onSubmit={submit(() => api("/centers", { method: "POST", body: { name: values.center_name, kind: values.kind, capacity: Number(values.center_capacity) } }))}><h2>Nuevo centro</h2>
          <Field label="Nombre" required minLength={3} maxLength={100} {...field("center_name")} />
          <Field label="Tipo" as="select" {...field("kind")}>{["RECOLECCION", "TALLER", "RECICLAJE", "DISPOSICION", "BENEFICIARIO"].map(k => <option key={k} value={k}>{centerLabels[k]}</option>)}</Field>
          <Field label="Capacidad (equipos)" type="number" required min={1} max={1000000} step={1} {...field("center_capacity")} /><Button disabled={busy}>Guardar centro</Button>
        </form>}
        {can(user) && <form className="panel network-card" onSubmit={submit(() => api("/network/edges", { method: "POST", body: { source_id: Number(values.edge_source), target_id: Number(values.edge_target), capacity: Number(values.edge_capacity) } }))}><h2>Nueva conexión</h2>
          {nodeSelect("Centro de origen", "edge_source")}{nodeSelect("Centro de destino", "edge_target")}
          <Field label="Capacidad por mes" type="number" required min={1} max={1000000} step={1} {...field("edge_capacity")} /><Button disabled={busy}>Guardar conexión</Button>
        </form>}
      </section>
      {result && <section className="panel padded business-section" aria-live="polite"><h2>Flujo máximo: {result.max_flow} equipos por mes</h2><p>Capacidad del corte mínimo: {result.cut_capacity}. Conexiones críticas: {result.min_cut_edges.join(", ") || "ninguna"}. Centros limitantes: {result.bottleneck_centers.map(id => nodes.find(n => n.id === id)?.name).join(", ") || "ninguno"}.</p><div className="table-scroll"><table><thead><tr><th>Conexión</th><th>Flujo</th><th>Capacidad</th><th>Utilización</th></tr></thead><tbody>{result.edges.map(e => <tr key={e.id}><td>{nodes.find(n => n.id === e.source_id)?.name} → {nodes.find(n => n.id === e.target_id)?.name}</td><td>{e.flow}</td><td>{e.capacity}</td><td>{e.capacity ? Math.round(e.flow / e.capacity * 100) : 0}% {e.saturated ? "· saturada" : ""}</td></tr>)}</tbody></table></div></section>}
      <section className="panel padded business-section"><h2>Comparación de escenarios</h2><div className="table-scroll"><table><thead><tr><th>Escenario</th><th>Mes</th><th>Flujo máximo</th><th>Corte mínimo</th></tr></thead><tbody>{runs.map(r => { const data = JSON.parse(r.result_json); return <tr key={r.id}><td>{r.scenario}</td><td>{r.period}</td><td>{data.max_flow}</td><td>{data.cut_capacity}</td></tr>; })}</tbody></table></div></section>
      <section className="network-grid business-section">
        {can(user, "sales") && <form className="panel network-card" onSubmit={submit(async () => {
          const models = values.models.split("\n").map(m => m.trim()).filter(Boolean);
          const count = user.role === "admin" ? 1 : Number(unitsPerModel);
          if (!models.length || models.length * count > 100) throw new Error("Selecciona entre 1 y 100 equipos por lote.");
          await api("/batches", { method: "POST", body: { client_id: Number(values.client_id), center_id: Number(values.center_id), collection_id: values.collection_id ? Number(values.collection_id) : null, devices: models.flatMap(model => Array.from({ length: count }, () => ({ model, category: "Equipo tecnológico", client_id: Number(values.client_id), notes: "Recepción por lote" }))) } }); setValues(v => ({ ...v, models: "" })); setUnitsPerModel("1");
        })}><h2>Recibir un lote</h2>
          <Field label="Remitente" as="select" required value={values.client_id} onChange={event => setValues(v => ({ ...v, client_id: event.target.value, collection_id: "" }))}><option value="">Selecciona un remitente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Field>
          {nodeSelect("Centro receptor", "center_id")}<Field label="Solicitud aprobada (opcional)" as="select" {...field("collection_id")}><option value="">Sin solicitud previa</option>{collections.data.filter(item => item.status === "SOLICITADA" && item.approved_by_name && item.client_id === Number(values.client_id)).map(item => <option key={item.id} value={item.id}>Solicitud {item.id} · {item.description}</option>)}</Field>
          {user.role === "admin" ? <Field label="Modelos de equipos, uno por línea" as="textarea" required rows={5} {...field("models")} /> : <Field label="Equipos del lote (selección múltiple)" as="select" multiple required size={6} value={values.models ? values.models.split("\n") : []} onChange={event => setValues(v => ({ ...v, models: Array.from(event.target.selectedOptions, option => option.value).join("\n") }))}>{[...new Set(products.data.map(product => product.name)), "Equipo sin modelo identificado"].map(name => <option key={name}>{name}</option>)}</Field>}
          {user.role !== "admin" && <Field label="Unidades de cada modelo seleccionado" as="select" value={unitsPerModel} onChange={event => setUnitsPerModel(event.target.value)}>{Array.from({ length: 100 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</Field>}
          <p className="section-hint">Hasta 100 equipos por lote. Cada unidad genera un código RAEE único. Para cantidades distintas por modelo, registra lotes separados.</p><Button disabled={busy}>Recibir lote</Button>
        </form>}
        {can(user, "inventory") && <form className="panel network-card" onSubmit={submit(async () => { await api("/transfers", { method: "POST", body: { edge_id: Number(values.edge_id), period: values.period, device_ids: selected } }); setSelected([]); })}><h2>Transferir equipos</h2>
          <Field label="Conexión" as="select" required value={values.edge_id} onChange={e => { setValues(v => ({ ...v, edge_id: e.target.value })); setSelected([]); }}><option value="">Selecciona una conexión</option>{edges.map(e => <option key={e.id} value={e.id}>{e.source_name} → {e.target_name}</option>)}</Field>
          <Field label="Mes de transferencia" type="month" required {...field("period")} />
          <fieldset className="assembly-options"><legend>Equipos disponibles en origen</legend>{devices.filter(d => d.center_id === chosenEdge?.source_id && !d.active_transfer_id && d.status !== "CERRADO").map(d => <label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={e => setSelected(e.target.checked ? [...selected, d.id] : selected.filter(id => id !== d.id))} /><span>{d.code} · {d.model}</span></label>)}</fieldset>
          <Button disabled={busy || !selected.length}>Reservar transferencia</Button>
        </form>}
      </section>
      <section className="panel padded business-section"><h2>Transferencias y recepciones</h2><div className="table-scroll"><table><thead><tr><th>N.º</th><th>Trayecto</th><th>Mes</th><th>Equipos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{transfers.data.map(t => <tr key={t.id}><td>{t.id}</td><td>{t.source_name} → {t.target_name}</td><td>{t.period}</td><td>{t.quantity}</td><td>{t.status}</td><td>{t.status === "PENDIENTE" && can(user, "inventory") && <div className="row-actions"><Button disabled={busy} onClick={() => perform(() => api(`/transfers/${t.id}/confirm`, { method: "POST" }), "Recepción confirmada.")}>Confirmar recepción</Button><Button variant="secondary" disabled={busy} onClick={() => perform(() => api(`/transfers/${t.id}/cancel`, { method: "POST" }), "Transferencia cancelada.")}>Cancelar</Button></div>}</td></tr>)}</tbody></table></div></section>
      {can(user, "sales", "inventory") && <section className="panel padded business-section"><Collections user={user} clients={clients} /></section>}
    </>}
  </>;
}
