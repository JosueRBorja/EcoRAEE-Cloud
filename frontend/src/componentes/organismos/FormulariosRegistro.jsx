import { useRef, useState } from "react";
import PhotoField from "../moleculas/FotoCampo";
import Button from "../atomos/Boton";
import Field from "../moleculas/CampoFormulario";
import { api } from "../../servicios/api";
import useResource from "../../hooks/usarRecurso";

function FormActions({ busy, onCancel }) {
  return (
    <div className="form-actions">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancelar
      </Button>
      <Button disabled={busy}>
        {busy ? "Guardando…" : "Guardar registro"}
      </Button>
    </div>
  );
}

export function ClientForm({ initial, onSaved, onCancel }) {
  const [values, setValues] = useState(
    initial || { name: "", document: "", phone: "", address: "" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key) => (e) =>
    setValues({ ...values, [key]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { name, document, phone, address } = values;
      await api(`/clients${initial ? `/${initial.id}` : ""}`, {
        method: initial ? "PUT" : "POST",
        body: { name, document, phone, address },
      });
      onSaved("Contacto guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-description">
        Registra a la persona que compra o entrega un equipo usado.
      </p>
      <Field
        label="Nombre del cliente o remitente"
        required
        minLength={3}
        maxLength={100}
        value={values.name}
        onChange={change("name")}
      />
      <div className="form-grid">
        <Field
          label="Identificador del contacto"
          placeholder="CON-003"
          required
          minLength={3}
          maxLength={30}
          value={values.document}
          onChange={change("document")}
        />
        <Field
          label="Teléfono"
          maxLength={25}
          value={values.phone}
          onChange={change("phone")}
        />
      </div>
      <Field
        label="Dirección o sector"
        maxLength={200}
        value={values.address}
        onChange={change("address")}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

export function DeviceForm({ initial, clients, onSaved, onCancel }) {
  const products = useResource("/products");
  const savedId = useRef(initial?.id);
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [values, setValues] = useState(
    initial || {
      model: "",
      category: "Computadoras",
      client_id: "",
      notes: "",
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key) => (e) =>
    setValues({ ...values, [key]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { model, category, client_id, notes } = values;
      const result = await api(`/devices${savedId.current ? `/${savedId.current}` : ""}`, {
        method: savedId.current ? "PUT" : "POST",
        body: { model, category, client_id: Number(client_id), notes },
      });
      savedId.current ||= result.id;
      if (photo || removePhoto) await api(`/photos/devices/${savedId.current}`, { method: photo ? "POST" : "DELETE", body: photo || undefined });
      onSaved(
        initial
          ? "Recepción actualizada."
          : "Equipo recibido. Su código de trazabilidad se generó automáticamente.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-description">
        Cada equipo inicia un expediente con identificación única e historial de
        movimientos.
      </p>
      <Field
        label="Nombre o modelo del equipo"
        options={[...new Set(products.data.map(product => product.name)), "Equipo sin modelo identificado"]}
        placeholder="Ej. Laptop de 14 pulgadas"
        required
        minLength={3}
        maxLength={100}
        value={values.model}
        onChange={change("model")}
      />
      <div className="form-grid">
        <Field
          as="select"
          label="Categoría"
          value={values.category}
          onChange={change("category")}
        >
          {initial?.category && !["Computadoras", "Monitores", "Periféricos", "Audio", "Tablets", "Redes", "Componentes", "Batería", "Otro equipo eléctrico"].includes(initial.category) && <option>{initial.category}</option>}
          <option>Computadoras</option>
          <option>Monitores</option>
          <option>Periféricos</option>
          <option>Audio</option>
          <option>Tablets</option>
          <option>Redes</option>
          <option>Componentes</option>
          <option>Batería</option>
          <option>Otro equipo eléctrico</option>
        </Field>
        <Field
          as="select"
          label="Cliente / remitente"
          required
          value={values.client_id}
          onChange={change("client_id")}
        >
          <option value="">Selecciona un contacto</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
      </div>
      {!clients.length && (
        <p className="error">
          Primero registra una ficha en Clientes y remitentes.
        </p>
      )}
      <Field
        as="textarea"
        label="Observaciones de recepción"
        rows={3}
        maxLength={1000}
        placeholder="Condición visible, accesorios recibidos…"
        value={values.notes}
        onChange={change("notes")}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <PhotoField record={initial} kind="devices" file={photo} onChange={setPhoto} remove={removePhoto} onRemove={setRemovePhoto} />
      <FormActions busy={busy || !clients.length} onCancel={onCancel} />
    </form>
  );
}
