import { useEffect, useState } from "react";
import { ResourcePhoto } from "./IlustracionProducto";

export default function PhotoField({ record, kind, file, onChange, remove, onRemove }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <fieldset className="photo-field"><legend>Fotografía opcional</legend>
    {preview ? <img className="photo-preview" src={preview} alt="Vista previa de la fotografía seleccionada" /> : <ResourcePhoto record={remove ? { ...record, photo_filename: null } : record || {}} kind={kind} />}
    <label className="photo-label">Seleccionar fotografía
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
        const selected = e.target.files[0]; setError("");
        if (selected && selected.size > 5 * 1024 * 1024) { setError("La fotografía no puede superar 5 MB."); e.target.value = ""; return; }
        if (selected && !["image/png", "image/jpeg", "image/webp"].includes(selected.type)) { setError("Selecciona un PNG, JPG o WebP."); e.target.value = ""; return; }
        onChange(selected || null); if (selected) onRemove?.(false);
      }} />
    </label><small>PNG, JPG o WebP · hasta 5 MB y 16 megapíxeles. Sin foto se muestra una ilustración.</small>
    {(file || record?.photo_filename) && <button type="button" className="text-link" onClick={() => { onChange(null); onRemove?.(true); }}>Usar imagen predeterminada</button>}
    {error && <p className="error" role="alert">{error}</p>}
  </fieldset>;
}
