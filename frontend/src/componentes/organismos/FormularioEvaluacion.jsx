import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Field from "../moleculas/CampoFormulario";
import Button from "../atomos/Boton";
import { classifications, statusLabels } from "../../utilidades/formato";
import { api } from "../../servicios/api";
import ClassificationGuide from "../moleculas/GuiaClasificacion";
import { classificationGuide } from "../../utilidades/clasificacion";
import { componentNames } from "../../utilidades/opcionesFormulario";

const emptyComponent = () => ({
  name: "",
  classification: "",
  voltage: "",
  observations: "",
});

export default function EvaluationForm({ deviceId, onSaved, user }) {
  const [technician, setTechnician] = useState(user.name);
  const [notes, setNotes] = useState("");
  const [components, setComponents] = useState([emptyComponent()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function update(index, key, value) {
    setComponents(
      components.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/devices/${deviceId}/evaluation`, {
        method: "POST",
        body: {
          technician,
          notes,
          components: components.map((c) => ({
            ...c,
            voltage: c.voltage === "" ? null : Number(c.voltage),
          })),
        },
      });
      onSaved("Diagnóstico guardado. Los componentes están en inventario.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="evaluation-form">
      <h3>Evalúa el equipo y decide qué hacer con cada pieza</h3>
      <p className="form-description">
        Clasifica las piezas por separado. El diagnóstico se confirma una sola
        vez.
      </p>
      <ClassificationGuide />
      <Field
        label="Técnico responsable"
        required
        minLength={3}
        maxLength={100}
        value={technician}
        readOnly
        onChange={(e) => setTechnician(e.target.value)}
      />
      <Field
        label="Conclusión de la evaluación"
        as="textarea"
        required
        minLength={5}
        maxLength={1000}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {components.map((c, i) => (
        <fieldset className="component-form" key={i}>
          <legend>Componente {i + 1}</legend>
          <div className="form-grid">
            <Field
              label="Nombre"
              options={componentNames}
              required
              minLength={2}
              maxLength={80}
              placeholder="Ej. Motor 12V"
              value={c.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <Field
              label="Clasificación"
              as="select"
              required
              value={c.classification}
              onChange={(e) => update(i, "classification", e.target.value)}
            >
              <option value="">Selecciona una decisión</option>
              {classifications.map((v) => (
                <option value={v} key={v}>
                  {statusLabels[v]}
                </option>
              ))}
            </Field>
          </div>
          {classificationGuide[c.classification] && (
            <p className="classification-result">
              {classificationGuide[c.classification].description} Próximo paso:{" "}
              {classificationGuide[c.classification].destination}.
            </p>
          )}
          <div className="form-grid">
            <Field
              label="Voltaje medido (opcional)"
              type="number"
              min="0"
              max="1000"
              step="0.01"
              value={c.voltage}
              onChange={(e) => update(i, "voltage", e.target.value)}
            />
            <Field
              label="Observaciones"
              maxLength={500}
              value={c.observations}
              onChange={(e) => update(i, "observations", e.target.value)}
            />
          </div>
          {components.length > 1 && (
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                setComponents(components.filter((_, index) => index !== i))
              }
            >
              <Trash2 size={15} /> Quitar componente
            </Button>
          )}
        </fieldset>
      ))}
      <Button
        variant="secondary"
        type="button"
        disabled={components.length >= 30}
        onClick={() => setComponents([...components, emptyComponent()])}
      >
        <Plus size={16} /> Agregar componente
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={busy}>
          {busy ? "Guardando…" : "Confirmar diagnóstico"}
        </Button>
      </div>
    </form>
  );
}
