import { useCallback, useEffect, useState } from "react";
import {
  Leaf,
  ChevronRight,
  CheckCircle2,
  X,
  AlertCircle,
  LogOut,
} from "lucide-react";
import Sidebar from "./componentes/organismos/MenuLateral";
import Modal from "./componentes/organismos/Modal";
import {
  ClientForm,
  DeviceForm,
} from "./componentes/organismos/FormulariosRegistro";
import Button from "./componentes/atomos/Boton";
import Skeleton from "./componentes/atomos/EsqueletoCarga";
import Dashboard from "./paginas/PanelAdministracion";
import Devices from "./paginas/RecepcionEquipos";
import Clients from "./paginas/Clientes";
import Inventory from "./paginas/InventarioPiezas";
import Traceability from "./paginas/Trazabilidad";
import { api } from "./servicios/api";
import Access from "./paginas/Acceso";
import CustomerStorefront from "./componentes/plantillas/PlantillaTienda";
import { clearCart } from "./utilidades/carrito";
import Catalog from "./paginas/Tienda";
import Products from "./paginas/ProductosInventario";
import Orders from "./paginas/VentasFinanzas";
import Users from "./paginas/UsuariosPersonal";
import { can, pagesByRole, roleLabels } from "./utilidades/permisos";
import Profile from "./componentes/organismos/Perfil";
import { ResourcePhoto } from "./componentes/moleculas/IlustracionProducto";
import Network from "./paginas/RedCircular";
import { FormRole } from "./utilidades/opcionesFormulario";

const titles = {
  dashboard: "Vista general",
  devices: "Recepción RAEE",
  clients: "Clientes y remitentes",
  workshop: "Taller y diagnóstico",
  inventory: "Inventario circular",
  trace: "Trazabilidad",
  catalog: "Catálogo",
  products: "Productos e inventario",
  orders: "Pedidos y créditos",
  users: "Usuarios y permisos",
  network: "Centros y traslados",
};

const workspaceShortcuts = {
  admin: [["orders", "Revisar pedidos"], ["users", "Gestionar cuentas"], ["network", "Consultar la red"]],
  sales: [["catalog", "Abrir catálogo"], ["devices", "Recibir un equipo"], ["clients", "Consultar clientes"]],
  technician: [["trace", "Abrir expedientes"], ["inventory", "Consultar componentes"]],
  inventory: [["inventory", "Ver piezas recuperadas"], ["trace", "Revisar destinos"], ["network", "Gestionar traslados"]],
  finance: [],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [accessMode, setAccessMode] = useState(null);
  async function check() {
    setChecking(true);
    setError("");
    try {
      setUser(await api("/auth/me"));
    } catch (err) {
      if (err.status !== 401) setError(err.message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    clearCart();
    setUser(null);
  }
  if (checking)
    return (
      <main className="session-loading">
        <Skeleton rows={3} />
      </main>
    );
  if (error)
    return (
      <main className="connection-error">
        <h1>No se pudo conectar con AWStore</h1>
        <p>{error}</p>
        <Button onClick={check}>Reintentar</Button>
      </main>
    );
  if (user && user.role !== "client")
    return <FormRole.Provider value={user.role}><Workspace key={user.id} user={user} onLogout={logout} onUserUpdated={setUser} /></FormRole.Provider>;
  if (!user && accessMode)
    return (
      <Access
        key={accessMode}
        initialMode={accessMode}
        onBack={() => setAccessMode(null)}
        onLogin={(account) => {
          setUser(account);
          setAccessMode(null);
        }}
      />
    );
  return (
    <CustomerStorefront
      key={user?.id || "visitor"}
      user={user}
      onAccess={setAccessMode}
      onLogout={logout}
      onUserUpdated={setUser}
    />
  );
}

function Workspace({ user, onLogout, onUserUpdated }) {
  const [page, setPage] = useState(pagesByRole[user.role][0]);
  const [devices, setDevices] = useState([]);
  const [clients, setClients] = useState([]);
  const [components, setComponents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [newDevices, newClients, newComponents] = await Promise.all([
        can(user, "sales", "technician", "inventory")
          ? api("/devices")
          : Promise.resolve([]),
        can(user, "sales", "finance") ? api("/clients") : Promise.resolve([]),
        can(user, "sales", "technician", "inventory")
          ? api("/components")
          : Promise.resolve([]),
      ]);
      setDevices(newDevices);
      setClients(newClients);
      setComponents(newComponents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(id) {
    if (!pagesByRole[user.role].includes(id)) return;
    setPage(id);
    setSelectedId(null);
  }
  function select(id) {
    setPage("trace");
    setSelectedId(id);
  }
  function saved(message) {
    setModal(null);
    setToast(message);
    load();
  }
  function askDelete(type, record) {
    setDeleteError("");
    setModal({ type: "delete", resource: type, record });
  }
  async function remove() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api(`/${modal.resource}/${modal.record.id}`, { method: "DELETE" });
      saved("Registro eliminado.");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }
  const newDevice = () => setModal({ type: "device" });
  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigate} user={user} />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {roleLabels[user.role]} <ChevronRight size={14} aria-hidden="true" />
            <strong>{titles[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span className="online-dot" /> Operación local
            </span>
            <span className="topbar-divider" />
            <button className="profile-trigger workspace-profile" aria-label="Abrir mi perfil" onClick={() => setModal({ type: "profile" })}>
              <ResourcePhoto record={user} kind="users" className="avatar" />
            <span className="workspace-name">
              {user.name}
              <small>Mi perfil</small>
            </span>
            </button>
            <Button
              variant="ghost"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={async () => {
                try {
                  await onLogout();
                } catch (err) {
                  setToast(err.message);
                }
              }}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {loading ? (
            <>
              <div className="eyebrow">PREPARANDO TU ESPACIO</div>
              <Skeleton rows={6} />
            </>
          ) : error ? (
            <div className="connection-error">
              <AlertCircle size={32} />
              <h1>No pudimos cargar los datos</h1>
              <p>{error}</p>
              <Button
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                Reintentar conexión
              </Button>
            </div>
          ) : (
            <>
              {page === pagesByRole[user.role][0] && workspaceShortcuts[user.role]?.length > 0 && (
                <nav className="workspace-shortcuts" aria-label="Accesos rápidos">
                  {workspaceShortcuts[user.role].filter(([target]) => pagesByRole[user.role].includes(target)).map(([target, label]) => (
                    <Button key={target} type="button" variant="secondary" onClick={() => navigate(target)}>
                      {label} <ChevronRight size={15} aria-hidden="true" />
                    </Button>
                  ))}
                </nav>
              )}
              {page === "network" && <Network user={user} devices={devices} clients={clients} onChanged={load} notify={setToast} />}
              {page === "catalog" && (
                <Catalog
                  user={user}
                  clients={clients}
                  notify={setToast}
                  onOrders={() => navigate("orders")}
                />
              )}
              {page === "products" && (
                <Products notify={setToast} onChanged={load} />
              )}
              {page === "orders" && (
                <Orders
                  user={user}
                  notify={setToast}
                  onChanged={load}
                  onCatalog={() => navigate("catalog")}
                  onTrace={select}
                />
              )}
              {page === "users" && (
                <Users clients={clients} notify={setToast} user={user} />
              )}
              {page === "dashboard" && (
                <Dashboard
                  devices={devices}
                  components={components}
                  onNavigate={navigate}
                  onSelect={select}
                  onCreate={newDevice}
                />
              )}
              {(page === "devices" || page === "workshop") && (
                <Devices
                  key={page}
                  devices={devices}
                  workshop={page === "workshop"}
                  manageCollections={page === "devices" && ["sales", "admin"].includes(user.role)}
                  onReceived={load}
                  onSelect={select}
                  onCreate={newDevice}
                  onEdit={(record) => setModal({ type: "device", record })}
                  onDelete={(record) => askDelete("devices", record)}
                />
              )}
              {page === "clients" && (
                <Clients
                  clients={clients}
                  onCreate={() => setModal({ type: "client" })}
                  onEdit={(record) => setModal({ type: "client", record })}
                  onDelete={(record) => askDelete("clients", record)}
                />
              )}
              {page === "inventory" && (
                <Inventory components={components} onSelect={select} />
              )}
              {page === "trace" && (
                <Traceability
                  devices={devices}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onChanged={load}
                  notify={setToast}
                  user={user}
                />
              )}
            </>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal.type === "profile" ? "Mi perfil" : modal.type === "delete"
              ? "Eliminar registro"
              : modal.type === "client"
                ? `${modal.record ? "Editar" : "Nuevo"} cliente o remitente`
                : modal.record
                  ? "Editar recepción"
                  : "Nueva recepción RAEE"
          }
          onClose={() => !deleting && setModal(null)}
        >
          {modal.type === "profile" && <Profile user={user} onUpdated={onUserUpdated} />}
          {modal.type === "client" && (
            <ClientForm
              initial={modal.record}
              onSaved={saved}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === "device" && (
            <DeviceForm
              initial={modal.record}
              clients={clients}
              onSaved={saved}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === "delete" && (
            <>
              <p>
                Vas a eliminar{" "}
                <strong>{modal.record.name || modal.record.model}</strong>. Esta
                acción no se puede deshacer.
              </p>
              <p className="muted">
                Los registros que ya tienen relaciones o tratamiento se
                conservan para proteger su historial.
              </p>
              {deleteError && (
                <p className="error" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={() => setModal(null)}
                  disabled={deleting}
                >
                  Cancelar
                </Button>
                <Button variant="danger" onClick={remove} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar registro"}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button aria-label="Cerrar notificación" onClick={() => setToast("")}>
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
