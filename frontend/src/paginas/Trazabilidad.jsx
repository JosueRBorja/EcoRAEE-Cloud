import { useEffect, useState } from "react";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import Button from "../componentes/atomos/Boton";
import Badge from "../componentes/atomos/EtiquetaEstado";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import Field from "../componentes/moleculas/CampoFormulario";
import EmptyState from "../componentes/moleculas/EstadoVacio";
import EvaluationForm from "../componentes/organismos/FormularioEvaluacion";
import { api } from "../servicios/api";
import { formatDate } from "../utilidades/formato";
import { can } from "../utilidades/permisos";
import { ResourcePhoto } from "../componentes/moleculas/IlustracionProducto";
import { downloadTechnicalReport } from "../utilidades/informeTecnico";
import useResource from "../hooks/usarRecurso";

function DestinationForm({ component, onSaved, user }) {
  const network = useResource("/network");
  const [destination, setDestination] = useState("");
  const types = { REUTILIZABLE: ["REUTILIZACION", "REPARACION", "RECICLAJE", "DISPOSICION", "BENEFICIARIO"], REPARABLE: ["REPARACION", "RECICLAJE", "DISPOSICION"], RECICLABLE: ["RECICLAJE", "DISPOSICION"], NO_RECUPERABLE: ["DISPOSICION"] };
  const [destinationType, setDestinationType] = useState(types[component.classification][0]);
  const [responsible, setResponsible] = useState(user.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/components/${component.id}/close`, {
        method: "POST",
        body: { destination, responsible, destination_type: destinationType },
      });
      onSaved("Destino confirmado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (component.closed_at)
    return (
      <p className="confirmed">
        <CheckCircle2 size={16} /> {component.destination}
        <span>{formatDate(component.closed_at)}</span>
      </p>
    );
  if (!can(user, "inventory"))
    return (
      <p className="section-hint">
        Destino pendiente de confirmar por inventario.
      </p>
    );
  return (
    <form onSubmit={submit} className="destination-form">
      <Field label="Tipo de destino" as="select" value={destinationType} onChange={e => setDestinationType(e.target.value)}>{types[component.classification].map(type => <option key={type}>{type}</option>)}</Field>
      <div className="form-grid">
        <Field
          label="Destino confirmado"
          options={(network.data?.nodes || []).map(node => node.name)}
          required
          minLength={3}
          maxLength={150}
          placeholder={
            ["REUTILIZABLE", "REPARABLE"].includes(component.classification)
              ? "Ej. Nave de fabricación"
              : "Ej. Gestor ambiental de prueba"
          }
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <Field
          label="Responsable de entrega"
          required
          minLength={3}
          maxLength={100}
          value={responsible}
          readOnly
          onChange={(e) => setResponsible(e.target.value)}
        />
      </div>
      <Button variant="secondary" disabled={busy}>
        {busy ? "Confirmando…" : "Confirmar destino"}
        <ArrowRight size={15} />
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default function Traceability({
  devices,
  selectedId,
  onSelect,
  onChanged,
  notify,
  user,
}) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoading(true);
    setError("");
    setDetail(null);
    api(`/devices/${selectedId}`)
      .then((data) => {
        if (active) setDetail(data);
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
  }, [selectedId, revision]);
  function saved(message) {
    setRevision((v) => v + 1);
    onChanged();
    notify(message);
  }
  async function workshop() {
    setBusy(true);
    setError("");
    try {
      await api(`/devices/${selectedId}/workshop`, { method: "POST" });
      saved("Equipo enviado al taller.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no puede superar 5 MB.");
      input.value = "";
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/devices/${selectedId}/evidence`, {
        method: "POST",
        body: file,
      });
      saved("Evidencia guardada localmente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  const results = devices.filter((d) =>
    `${d.code} ${d.model}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">UNA HISTORIA QUE SE PUEDE SEGUIR</div>
          <h1>
            Trazabilidad<span>.</span>
          </h1>
          <p>Desde la recepción hasta el destino de cada componente.</p>
        </div>
        {selectedId && (
          <Button variant="secondary" onClick={() => onSelect(null)}>
            <ArrowLeft size={17} /> Todos los equipos
          </Button>
        )}
      </section>
      {!selectedId ? (
        <section className="panel">
          <div className="list-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Buscar expediente"
                placeholder="Buscar por código o modelo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="trace-results">
            {results.length ? (
              results.map((d) => (
                <button key={d.id} onClick={() => onSelect(d.id)}>
                  <span className="trace-result-icon">
                    <FileText size={21} />
                  </span>
                  <span>
                    <strong>{d.model}</strong>
                    <small>
                      {d.code} · {d.client_name}
                    </small>
                  </span>
                  <Badge value={d.status} />
                  <ArrowRight size={18} />
                </button>
              ))
            ) : (
              <EmptyState title="No encontramos ese expediente" />
            )}
          </div>
        </section>
      ) : (
        <>
          {loading && <Skeleton rows={5} />}
          {error && (
            <div className="error" role="alert">
              {error}
              <Button variant="ghost" onClick={() => setRevision((v) => v + 1)}>
                Reintentar
              </Button>
            </div>
          )}
          {detail && !loading && (
            <>
              <section className="panel dossier-heading">
                <ResourcePhoto record={detail} kind="devices" />
                <div>
                  <span className="eyebrow">{detail.code}</span>
                  <h2>{detail.model}</h2>
                  <p>
                    {detail.category} · {detail.location}
                  </p>
                  {detail.notes && <p>{detail.notes}</p>}
                </div>
                <div className="dossier-actions">
                  <Badge value={detail.status} />
                  {detail.classification !== "PENDIENTE" && <Badge value={detail.classification} />}
                  {detail.status === "RECEPCIONADO" && can(user, "sales") && (
                    <Button disabled={busy} onClick={workshop}>
                      Enviar al taller <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </section>
              <div className="dossier-grid">
                <div className="dossier-main">
                  {detail.status === "EN_EVALUACION" &&
                    can(user, "technician") && (
                      <section className="panel padded">
                        <EvaluationForm
                          deviceId={detail.id}
                          onSaved={saved}
                          user={user}
                        />
                      </section>
                    )}
                  {detail.evaluation && (
                    <section className="panel padded">
                      <div className="eyebrow">RESULTADO TÉCNICO</div>
                      <h2>Diagnóstico registrado</h2>
                      {can(user, "technician") && <Button type="button" variant="secondary" onClick={() => downloadTechnicalReport(detail)}><FileText size={16} /> Emitir informe técnico</Button>}
                      <p>{detail.evaluation.notes}</p>
                      <p className="muted">
                        Responsable: {detail.evaluation.technician}
                      </p>
                    </section>
                  )}
                  <section className="panel padded">
                    <div className="panel-heading compact">
                      <h2>Componentes y destinos</h2>
                      <span className="count-pill">
                        {detail.components.length}
                      </span>
                    </div>
                    {detail.components.length ? (
                      detail.components.map((c) => (
                        <article className="component-card" key={c.id}>
                          <div className="component-heading">
                            <h3>{c.name}</h3>
                            <Badge value={c.classification} />
                          </div>
                          <p className="muted">
                            {c.voltage == null
                              ? "Sin medición de voltaje"
                              : `${c.voltage} V medidos`}
                            {c.observations && ` · ${c.observations}`}
                          </p>
                          <DestinationForm
                            component={c}
                            onSaved={saved}
                            user={user}
                          />
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        title="Pendiente de diagnóstico"
                        description="El técnico registrará aquí las piezas y su clasificación."
                      />
                    )}
                  </section>
                  <section className="panel padded">
                    <div className="panel-heading compact">
                      <div>
                        <h2>Evidencias del expediente</h2>
                        <p>Fotografías y actas guardadas en este equipo.</p>
                      </div>
                      <Upload size={20} />
                    </div>
                    <div className="evidence-list">
                      {detail.evidence.map((file, i) => (
                        <a
                          key={file.id}
                          href={`/uploads/${file.filename}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {/\.(png|jpg|jpeg)$/i.test(file.filename) ? <img src={`/uploads/${file.filename}`} alt={`Fotografía del expediente ${i + 1}`} /> : <FileText size={20} />}
                          <span>
                            Evidencia {i + 1}
                            <small>{formatDate(file.created_at)}</small>
                          </span>
                          <ArrowRight size={16} />
                        </a>
                      ))}
                    </div>
                    {detail.status !== "CERRADO" && can(user, "sales", "technician", "inventory") && (
                      <label
                        className={`upload-zone ${busy ? "disabled" : ""}`}
                      >
                        <Upload size={23} />
                        <strong>
                          {busy ? "Procesando…" : "Adjuntar fotografía o acta"}
                        </strong>
                        <span>PNG, JPG o PDF · máximo 5 MB</span>
                        <input
                          aria-label="Adjuntar evidencia"
                          type="file"
                          accept="image/png,image/jpeg,application/pdf"
                          disabled={busy}
                          onChange={upload}
                        />
                      </label>
                    )}
                    <p className="section-hint">
                      El cierre de un componente requiere al menos una evidencia
                      en el expediente.
                    </p>
                  </section>
                </div>
                <aside className="panel timeline-panel">
                  <h2>
                    <Clock3 size={19} /> Historial del equipo
                  </h2>
                  <ol className="timeline">
                    {detail.events.map((event) => (
                      <li key={event.id}>
                        <span className="timeline-marker" />
                        <time>{formatDate(event.created_at)}</time>
                        <h3>{event.action}</h3>
                        <p>{event.detail}</p>
                        <small>{event.responsible}</small>
                      </li>
                    ))}
                  </ol>
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
