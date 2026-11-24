import { useState } from "react";
import { ArrowLeft, Camera, ChevronRight, LockKeyhole, MapPin, UserRound } from "lucide-react";
import PhotoField from "../moleculas/FotoCampo";
import Field from "../moleculas/CampoFormulario";
import { ResourcePhoto } from "../moleculas/IlustracionProducto";
import Button from "../atomos/Boton";
import { api } from "../../servicios/api";
import useResource from "../../hooks/usarRecurso";
import { roleLabels } from "../../utilidades/permisos";

const emptyAddress = { city: "", street: "", street_number: "", reference: "" };
const namePattern = String.raw`\p{L}[\p{L}\p{M} '’\-]*`;

function localPhone(value = "") {
  const compact = value.replace(/[ ().-]/g, "");
  if (compact.startsWith("+593")) return compact.slice(4);
  return compact.replace(/^0(?=[0-9]{8,9}$)/, "");
}

export default function Profile({ user, onUpdated }) {
  const profile = useResource("/auth/profile");
  const [section, setSection] = useState(null);
  const [names, setNames] = useState("");
  const [surnames, setSurnames] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(emptyAddress);
  const [file, setFile] = useState(null);
  const [remove, setRemove] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sections = [
    ["personal", "Datos personales", "Edita tu nombre y consulta los datos de tu cuenta.", UserRound],
    ["photo", "Foto de perfil", "Cambia tu foto o recupera el avatar predeterminado.", Camera],
    ["security", "Seguridad", "Actualiza tu contraseña.", LockKeyhole],
  ];
  if (user.role === "client" && user.client_id) {
    sections.push(["contact", "Contacto y dirección", "Actualiza tu teléfono y dirección de contacto.", MapPin]);
  }

  function open(key) {
    setSection(key);
    setError("");
    setMessage("");
    setNames(profile.data?.identity?.given_names || "");
    setSurnames(profile.data?.identity?.surnames || "");
    setPhone(localPhone(profile.data?.contact?.phone || ""));
    setAddress(profile.data?.contact?.address_parts || emptyAddress);
    setFile(null);
    setRemove(false);
    setCurrent("");
    setPassword("");
    setConfirmation("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (section === "security") {
        if (password !== confirmation) throw new Error("Las contraseñas nuevas no coinciden.");
        const result = await api("/auth/profile/password", {
          method: "POST", body: { current_password: current, new_password: password },
        });
        open(null);
        setMessage(result.message);
      } else {
        if (section === "photo") {
          await api(`/photos/users/${user.id}`, { method: file ? "POST" : "DELETE", body: file || undefined });
          onUpdated(await api("/auth/me"));
        } else {
          const hasAddress = Object.values(address).some(value => value.trim());
          const body = section === "contact"
            ? { contact: { phone: phone ? `+593${phone}` : "", address: hasAddress ? address : null } }
            : { identity: { given_names: names, surnames } };
          onUpdated(await api("/auth/profile", { method: "PUT", body }));
          await profile.reload();
        }
        open(null);
        setMessage("Cambios guardados.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="account-profile">
    <div className="account-summary">
      <ResourcePhoto record={user} kind="users" className="avatar" />
      <div><h3>{user.name}</h3><p>{user.email}</p><span>{roleLabels[user.role]}</span></div>
    </div>
    {message && <p role="status">{message}</p>}
    {!section ? <div className="account-sections">
      {sections.map(([key, title, description, Icon]) => <button key={key} type="button" onClick={() => open(key)} disabled={["personal", "contact"].includes(key) && (profile.loading || Boolean(profile.error))}>
        <Icon size={21} /><strong>{title}</strong><ChevronRight size={17} /><small>{description}</small>
      </button>)}
    </div> : <form onSubmit={save}>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => open(null)}><ArrowLeft size={16} /> Volver al perfil</Button>
      <h3>{sections.find(([key]) => key === section)?.[1]}</h3>
      {section === "personal" && <>
        {!profile.data?.identity && <p>Nombre registrado anteriormente: {user.name}. Confirma cómo se divide en los campos de abajo.</p>}
        <div className="form-grid">
          <Field label="Nombres" required maxLength={50} pattern={namePattern} title="Letras, espacios, guiones y apóstrofos" autoComplete="given-name" value={names} onChange={e => setNames(e.target.value)} />
          <Field label="Apellidos" required maxLength={49} pattern={namePattern} title="Letras, espacios, guiones y apóstrofos" autoComplete="family-name" value={surnames} onChange={e => setSurnames(e.target.value)} />
        </div>
        <Field label="Correo de acceso" type="email" readOnly value={user.email} />
      </>}
      {section === "contact" && <>
        <Field label="Teléfono (+593)" type="tel" inputMode="numeric" maxLength={9} pattern="[0-9]{9}" title="Escribe exactamente 9 dígitos después de +593" autoComplete="tel-national" placeholder="Ej. 991234567" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))} />
        {!profile.data?.contact?.address_parts && profile.data?.contact?.address && <p>Dirección anterior: {profile.data.contact.address}</p>}
        <div className="form-grid">
          {[
            ["city", "Ciudad o localidad", 45, String.raw`\p{L}[\p{L}\p{M} .’'\-]*`],
            ["street", "Calle o avenida", 75, String.raw`[\p{L}\p{N}][\p{L}\p{M}\p{N} .’'\/\-]*`],
            ["street_number", "Número de casa o edificio", 15, String.raw`(?:[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*|[sS]\/[nN])`],
            ["reference", "Referencia (opcional)", 55, undefined],
          ].map(([key, label, maxLength, pattern]) => <Field key={key} label={label} maxLength={maxLength} pattern={pattern}
            required={key !== "reference" && Object.values(address).some(value => value.trim())}
            placeholder={key === "street_number" ? "Ej. N34-120 o S/N" : undefined}
            value={address[key]} onChange={e => setAddress(previous => ({ ...previous, [key]: e.target.value }))} />)}
        </div>
      </>}
      {section === "photo" && <PhotoField record={user} kind="users" file={file} onChange={setFile} remove={remove} onRemove={setRemove} />}
      {section === "security" && <>
        <Field label="Contraseña actual" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} />
        <Field label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
        <Field label="Confirma la nueva contraseña" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <p>Al cambiarla se cerrarán tus demás sesiones.</p>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <Button disabled={busy || (section === "photo" && !file && !remove)}>{busy ? "Guardando…" : "Guardar cambios"}</Button>
    </form>}
    {profile.error && <p role="alert">
      {profile.error === "Not Found" ? "La versión del backend que está en ejecución no tiene la ruta de perfil. Reinicia iniciar-backend.bat y vuelve a intentar." : profile.error}
      {" "}<Button type="button" onClick={profile.reload}>Reintentar</Button>
    </p>}
  </section>;
}
