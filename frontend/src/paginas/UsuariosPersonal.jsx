import { useState } from "react";
import {
  Pencil,
  Power,
  Search,
  Users,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import useResource from "../hooks/usarRecurso";
import Button from "../componentes/atomos/Boton";
import Badge from "../componentes/atomos/EtiquetaEstado";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import Field from "../componentes/moleculas/CampoFormulario";
import StatCard from "../componentes/moleculas/TarjetaIndicador";
import Modal from "../componentes/organismos/Modal";
import { api } from "../servicios/api";
import { roleLabels } from "../utilidades/permisos";
import { formatDate } from "../utilidades/formato";

function AccountForm({ initial, clients, onSaved }) {
  const [values, setValues] = useState(
    initial
      ? {
          name: initial.name,
          email: initial.email,
          role: initial.role,
          client_id: initial.client_id || "",
        }
      : { name: "", email: "", password: "", role: "sales", client_id: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = (key) => ({
    value: values[key],
    onChange: (e) => setValues({ ...values, [key]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/users${initial ? `/${initial.id}` : ""}`, {
        method: initial ? "PUT" : "POST",
        body: {
          ...values,
          client_id: values.role === "client" ? Number(values.client_id) : null,
        },
      });
      onSaved(
        initial
          ? "Cuenta actualizada. El usuario deberá iniciar sesión de nuevo."
          : "Cuenta creada. Entrega las credenciales al integrante.",
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
        El personal inicia sesión con el correo y el rol que le asignes. Los
        clientes pueden registrarse solos desde la tienda.
      </p>
      <Field
        label="Nombre"
        required
        minLength={3}
        maxLength={100}
        {...field("name")}
      />
      <Field
        label="Correo"
        type="email"
        required
        maxLength={120}
        {...field("email")}
      />
      {!initial && (
        <Field
          label="Contraseña inicial"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          {...field("password")}
        />
      )}
      <Field label="Departamento / perfil" as="select" {...field("role")}>
        {Object.entries(roleLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Field>
      {values.role === "client" && (
        <Field
          label="Ficha de cliente asociada"
          as="select"
          required
          {...field("client_id")}
        >
          <option value="">Selecciona una ficha</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={busy}>
          {busy ? "Guardando…" : initial ? "Guardar cambios" : "Crear cuenta"}
        </Button>
      </div>
    </form>
  );
}

export default function Team({ clients, notify, user }) {
  const users = useResource("/users");
  const events = useResource("/business-events");
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = users.data.filter(
    (u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()) &&
      (!filter || u.role === filter),
  );
  function saved(message) {
    setModal(null);
    users.reload();
    events.reload();
    notify(message);
  }
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      await api(`/users/${modal.record.id}/toggle`, { method: "POST" });
      saved("Estado de acceso actualizado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRACIÓN DEL EQUIPO</div>
          <h1>
            Usuarios y accesos<span>.</span>
          </h1>
          <p>
            Crea cuentas del personal, asigna su departamento y controla quién
            puede entrar.
          </p>
        </div>
        <Button onClick={() => setModal({ type: "account" })}>
          Nueva cuenta
        </Button>
      </section>
      <section className="stats-grid">
        <StatCard
          label="Usuarios activos"
          value={users.data.filter((u) => u.active).length}
          description="Cuentas con acceso habilitado"
          icon={UserRoundCheck}
        />
        <StatCard
          label="Personal"
          value={users.data.filter((u) => u.role !== "client").length}
          description="Cuentas creadas por administración"
          icon={ShieldCheck}
        />
        <StatCard
          label="Clientes registrados"
          value={users.data.filter((u) => u.role === "client").length}
          description="Cuentas para comprar en la tienda"
          icon={Users}
        />
      </section>
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Buscar usuarios"
              placeholder="Nombre o correo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar usuarios por departamento"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todos los perfiles</option>
            {Object.entries(roleLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {users.loading ? (
          <Skeleton />
        ) : users.error ? (
          <p className="error">{users.error}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo de acceso</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      {u.id === user.id && (
                        <span className="code">Tu cuenta</span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>{roleLabels[u.role]}</td>
                    <td>
                      <Badge value={u.active ? "ACTIVO" : "INACTIVO"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          disabled={u.id === user.id}
                          aria-label={`Editar cuenta de ${u.name}`}
                          onClick={() =>
                            setModal({ type: "account", record: u })
                          }
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={u.id === user.id}
                          aria-label={`${u.active ? "Desactivar" : "Activar"} cuenta de ${u.name}`}
                          onClick={() => {
                            setError("");
                            setModal({ type: "toggle", record: u });
                          }}
                        >
                          <Power size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel business-section">
        <div className="panel-heading">
          <div>
            <h2>Actividad reciente</h2>
            <p>Últimas 100 operaciones comerciales y cambios de acceso.</p>
          </div>
          <Button variant="secondary" onClick={events.reload}>
            Actualizar
          </Button>
        </div>
        {events.loading ? (
          <Skeleton />
        ) : events.error ? (
          <p className="error">{events.error}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {events.data.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.created_at)}</td>
                    <td>{e.action}</td>
                    <td>{e.detail}</td>
                    <td>{e.responsible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {modal && (
        <Modal
          title={
            modal.type === "toggle"
              ? `${modal.record.active ? "Desactivar" : "Activar"} acceso`
              : modal.record
                ? "Editar cuenta"
                : "Nueva cuenta de acceso"
          }
          onClose={() => !busy && setModal(null)}
        >
          {modal.type === "account" ? (
            <AccountForm
              initial={modal.record}
              clients={clients}
              onSaved={saved}
            />
          ) : (
            <>
              <p>
                ¿{modal.record.active ? "Desactivar" : "Activar"} la cuenta de{" "}
                <strong>{modal.record.name}</strong>?
              </p>
              <p className="muted">
                Al cambiar el estado se cerrarán sus sesiones anteriores. La
                información y el historial se conservan.
              </p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={toggle}>
                  {busy ? "Guardando…" : "Confirmar cambio"}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
