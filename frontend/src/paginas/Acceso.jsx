import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Recycle } from "lucide-react";
import Field from "../componentes/moleculas/CampoFormulario";
import Button from "../componentes/atomos/Boton";
import { api } from "../servicios/api";

export default function Access({ initialMode = "login", onLogin, onBack }) {
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      onLogin(await api(`/auth/${mode}`, {
        method: "POST", body: mode === "register" ? { name, email, password } : { email, password },
      }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="account-access">
    <div className="access-shell">
      <header className="access-header">
        <span className="access-brand"><Recycle size={21} aria-hidden="true" /> AWStore</span>
        <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Volver a la tienda</Button>
      </header>
      <section className="access-form-card" aria-labelledby="access-title">
      <h1 id="access-title">{mode === "register" ? "Crea tu cuenta" : "Inicia sesión"}</h1>
      <p className="access-intro">{mode === "register" ? "Regístrate para comprar y consultar tus pedidos." : "Usa tu correo y contraseña para acceder a AWStore."}</p>
      <div className="access-modes" role="group" aria-label="Tipo de acceso">{[["login", "Iniciar sesión"], ["register", "Registrarme"]].map(([key, label]) =>
        <button type="button" key={key} aria-pressed={mode === key} disabled={busy} onClick={() => {
          if (mode === key) return;
          setMode(key); setError(""); setPassword(""); setShowPassword(false);
        }}>{label}</button>)}</div>
      <form onSubmit={submit}>
        {mode === "register" && <Field label="Nombre" autoComplete="name" required minLength={3} maxLength={100} value={name} onChange={e => setName(e.target.value)} />}
        <Field label="Correo electrónico" type="email" autoComplete="username" required maxLength={120} value={email} onChange={e => setEmail(e.target.value)} />
        <Field label="Contraseña" showExceptionHint={false} type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : 1} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
        <button className="access-password-toggle" type="button" onClick={() => setShowPassword(value => !value)}>
          {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        </button>
        {mode === "register" && <p className="access-password-hint">Usa al menos 8 caracteres.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <Button className="access-submit" disabled={busy}>{busy ? "Un momento…" : mode === "register" ? "Crear cuenta" : "Entrar"}</Button>
      </form>
      </section>
    </div>
  </main>;
}
