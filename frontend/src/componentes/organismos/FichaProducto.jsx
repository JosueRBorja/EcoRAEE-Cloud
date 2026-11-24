import { useRef, useState } from "react";
import useResource from "../../hooks/usarRecurso";
import config from "../../utilidades/caracteristicasProducto.json";
import Field from "../moleculas/CampoFormulario";
import PhotoField from "../moleculas/FotoCampo";
import Button from "../atomos/Boton";
import { api } from "../../servicios/api";

export function describeProduct(name, condition, specs, category) {
  const keys = config.profiles[category] || config.profiles.General;
  return `${name}. ${keys.filter(key => specs[key]).map(key => `${config.fields[key].label}: ${specs[key]}`).join(" · ")}. Condición: ${condition === "NUEVO" ? "Nuevo" : "Reacondicionado"}.`;
}

function readSpecs(value) {
  try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch { return {}; }
}

export default function ProductForm({ initial, onSaved, onCancel }) {
  const categories = useResource("/product-categories");
  const products = useResource("/products");
  const [values, setValues] = useState(() => ({ sku: initial?.sku || `AW-${crypto.randomUUID().toUpperCase()}`, name: initial?.name || "", category: initial?.category || "", condition: initial?.condition || "NUEVO", price: initial ? (initial.price_cents / 100).toFixed(2) : "" }));
  const [specs, setSpecs] = useState(() => readSpecs(initial?.specifications));
  const [changed, setChanged] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [newCategory, setNewCategory] = useState(false);
  const [newModel, setNewModel] = useState(false);
  const [manual, setManual] = useState(Boolean(initial?.description_edit_reason));
  const [correction, setCorrection] = useState(initial?.description || "");
  const [reason, setReason] = useState(initial?.description_edit_reason || "");
  const [photo, setPhoto] = useState(null), [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const savedId = useRef(initial?.id);
  const [persisted, setPersisted] = useState(false);
  const fields = config.profiles[values.category] || config.profiles.General;
  const models = [...new Set(categories.data.find(category => category.name === values.category)?.models.map(model => model.name) || [])];
  const technical = changed || Object.keys(specs).length > 0 || !initial;
  const generated = technical ? describeProduct(values.name, values.condition, specs, values.category) : initial.description;
  function change(key, value) {
    setValues(previous => ({ ...previous, [key]: value }));
    if (["category", "name", "condition"].includes(key)) { setChanged(true); setManual(false); setReason(""); }
    if (key === "category") { setSpecs({}); setValues(previous => ({ ...previous, name: "" })); setNewModel(false); }
  }
  async function registerCategory() {
    setBusy(true); setError("");
    try {
      const saved = await api("/product-categories/register", { method: "POST", body: { name: categorySearch } });
      await categories.reload(); change("category", saved.name); setCategorySearch(""); setNewCategory(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (technical && !Object.keys(specs).length) throw new Error("Selecciona al menos una característica técnica real.");
      if (manual && reason.trim().length < 5) throw new Error("Explica brevemente la corrección de la descripción.");
      const result = await api(`/products${savedId.current ? `/${savedId.current}` : ""}`, { method: savedId.current ? "PUT" : "POST", body: {
        sku: values.sku, name: values.name.trim(), category: values.category, condition: values.condition,
        description: manual ? correction : generated,
        price_cents: Math.round(Number(values.price) * 100),
        ...(technical ? { specifications: specs, description_edit_reason: manual ? reason : "" } : {}),
      } });
      savedId.current ||= result.id; setPersisted(true);
      if (photo || removePhoto) await api(`/photos/products/${savedId.current}`, { method: photo ? "POST" : "DELETE", body: photo || undefined });
      onSaved("Producto guardado con su ficha técnica. Las existencias se registran mediante movimientos.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <Field label="SKU" readOnly value={values.sku} />
    <fieldset className="component-form"><legend>1. Categoría</legend>
      <Field label="Buscar categoría existente" type="search" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} />
      <Field label="Categoría" as="select" required value={values.category} onChange={event => change("category", event.target.value)}>
        <option value="">Selecciona una categoría</option>
        {values.category && <option value={values.category}>{values.category}</option>}
        {categories.data.filter(category => category.name !== values.category && category.name.toLocaleLowerCase().includes(categorySearch.toLocaleLowerCase())).map(category => <option key={category.name}>{category.name}</option>)}
      </Field>
      <Button type="button" variant="secondary" onClick={() => setNewCategory(!newCategory)}>No existe: registrar categoría</Button>
      {newCategory && <div><p>Busca primero. Si no existe, escribe su nombre en el buscador y confírmalo aquí.</p><Button type="button" disabled={busy || categorySearch.trim().length < 3} onClick={registerCategory}>Registrar «{categorySearch.trim()}»</Button></div>}
      {categories.error && <p role="alert">{categories.error} <Button type="button" onClick={categories.reload}>Reintentar</Button></p>}
    </fieldset>
    <fieldset className="component-form"><legend>2. Modelo y condición</legend>
      <Field label="Modelo registrado" as="select" disabled={!values.category} value={newModel ? "__new__" : values.name} onChange={event => { if (event.target.value === "__new__") { setNewModel(true); change("name", ""); setSpecs({}); } else { setNewModel(false); change("name", event.target.value); const match = products.data.find(product => product.name === event.target.value && product.category === values.category); setSpecs(readSpecs(match?.specifications)); } }}>
        <option value="">Selecciona un modelo</option>{values.name && !models.includes(values.name) && !newModel && <option>{values.name}</option>}{models.map(name => <option key={name}>{name}</option>)}<option value="__new__">Modelo nuevo / corregir nombre</option>
      </Field>
      {newModel && <Field label="Modelo exacto del fabricante" required minLength={3} maxLength={100} value={values.name} onChange={event => change("name", event.target.value)} />}
      <Field label="Condición" as="select" value={values.condition} onChange={event => change("condition", event.target.value)}><option value="NUEVO">Nuevo</option><option value="REACONDICIONADO">Reacondicionado</option></Field>
    </fieldset>
    <fieldset className="component-form"><legend>3. Características técnicas</legend><p>Selecciona únicamente las características verificadas. Deja sin dato lo que no aplique.</p>
      <div className="form-grid">{fields.map(key => <Field key={key} label={config.fields[key].label} as="select" disabled={!values.category} value={specs[key] || ""} onChange={event => { setSpecs(previous => { const next = { ...previous }; if (event.target.value) next[key] = event.target.value; else delete next[key]; return next; }); setChanged(true); setManual(false); setReason(""); }}><option value="">Sin dato / no aplica</option>{config.fields[key].options.map(value => <option key={value}>{value}</option>)}</Field>)}</div>
    </fieldset>
    <fieldset className="component-form"><legend>4. Descripción automática</legend>
      <Field label="Descripción del producto" as="textarea" rows={4} maxLength={600} required readOnly={!manual} value={manual ? correction : generated || ""} onChange={event => setCorrection(event.target.value)} />
      {!technical && <p>Se conserva la descripción anterior. Selecciona las características para generar una nueva sin inventar especificaciones.</p>}
      <label><input type="checkbox" checked={manual} disabled={!technical} onChange={event => { setManual(event.target.checked); setCorrection(generated || ""); }} /> Corregir descripción excepcionalmente</label>
      {manual && <Field label="Motivo de la corrección" required minLength={5} maxLength={250} value={reason} onChange={event => setReason(event.target.value)} />}
    </fieldset>
    <Field label="Precio final (USD)" type="number" required min="0.01" max="1000000" step="0.01" value={values.price} onChange={event => change("price", event.target.value)} />
    <PhotoField record={initial} kind="products" file={photo} onChange={setPhoto} remove={removePhoto} onRemove={setRemovePhoto} />
    {error && <p className="error" role="alert">{error}{persisted && " Los datos del producto ya se guardaron; revisa la fotografía y vuelve a intentar."}</p>}
    <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button disabled={busy || !values.name.trim() || !values.category}>{busy ? "Guardando…" : "Guardar producto"}</Button></div>
  </form>;
}
