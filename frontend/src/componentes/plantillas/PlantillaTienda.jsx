import { useState } from "react";
import { Recycle, LogOut, X, CheckCircle2, ArrowRight, ShoppingBag } from "lucide-react";
import Catalog from "../../paginas/Tienda";
import Button from "../atomos/Boton";
import Modal from "../organismos/Modal";
import PurchaseHistory from "../organismos/HistorialCompras";
import Profile from "../organismos/Perfil";
import { ResourcePhoto } from "../moleculas/IlustracionProducto";
import Collections from "../organismos/Recolecciones";

// La tienda tiene su propia composición. El menú de departamentos queda para el personal.
export default function CustomerStorefront({ user, onAccess, onLogout, onUserUpdated }) {
  const [profile, setProfile] = useState(false);
  const [collection, setCollection] = useState(false);
  const [history, setHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [carritoAbierto, abrirCarrito] = useState(false);
  const [cantidadCarrito, actualizarCantidad] = useState(0);
  return (
    <div className="storefront">
      <a className="store-skip" href="#productos">Ir a los productos</a>
      <header className="store-header">
        <nav className="store-nav-left" aria-label="Información de tienda">
          <a href="#tienda">Tienda</a>
          <a href="#programa-circular">Programa circular</a>
        </nav>
        <a className="store-brand" href="#tienda">
          <span>
            <Recycle size={25} />
          </span>
          <strong>
            AW<span className="marca-color">Store</span>
            <small>Tecnología circular</small>
          </strong>
        </a>
        <nav className="store-nav-right" aria-label="Navegación de tienda">
          {user ? (
            <>
              <button onClick={() => setHistory(true)}>Mis compras</button>
              <button onClick={() => setCollection(true)}>Reciclar equipo</button>
              <button className="profile-trigger" aria-label="Abrir mi perfil" onClick={() => setProfile(true)}><ResourcePhoto record={user} kind="users" className="avatar" /></button>
              <Button
                variant="ghost"
                aria-label="Cerrar sesión"
                onClick={async () => {
                  try {
                    await onLogout();
                  } catch (err) {
                    setMessage(err.message);
                  }
                }}
              >
                <LogOut size={17} />
              </Button>
            </>
          ) : (
            <>
              <button onClick={() => onAccess("login")}>Iniciar sesión</button>
              <button onClick={() => onAccess("register")}>Regístrate</button>
            </>
          )}
          <button
            className="cart-nav-link"
            onClick={() => abrirCarrito(true)}
            aria-label={`Abrir carrito con ${cantidadCarrito} productos`}
          >
            <ShoppingBag size={17} aria-hidden="true" /> Carrito <span className="store-cart-count">{cantidadCarrito}</span>
          </button>
        </nav>
      </header>
      <main className="store-main" id="tienda">
        {user && <nav className="customer-shortcuts" aria-label="Acciones de mi cuenta">
          <strong>Mi cuenta</strong>
          <Button type="button" variant="secondary" onClick={() => setHistory(true)}>Mis compras</Button>
          <Button type="button" variant="secondary" onClick={() => setCollection(true)}>Solicitar entrega en tienda</Button>
          <Button type="button" variant="ghost" onClick={() => setProfile(true)}>Editar perfil</Button>
        </nav>}
        <Catalog
          user={user}
          clients={[]}
          notify={setMessage}
          onOrders={() => setHistory(true)}
          onLoginRequired={() => onAccess("register")}
          cartOpen={carritoAbierto}
          onCloseCart={() => abrirCarrito(false)}
          onCartCount={actualizarCantidad}
        />
      </main>
      <section className="circular-story" id="programa-circular" aria-labelledby="circular-title">
        <div className="circular-intro">
          <span className="eyebrow">PROGRAMA CIRCULAR</span>
          <h2 id="circular-title">Dale una segunda vida a tu equipo</h2>
          <p>
            Entrega la tecnología que ya no usas. Evaluamos sus piezas para
            reutilizar las que aún sirven y separar los materiales reciclables.
          </p>
          <Button type="button" className="circular-action" onClick={() => user ? setCollection(true) : onAccess("register")}>
            {user ? "Solicitar entrega en tienda" : "Crear cuenta para participar"} <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </div>
        <ol className="circular-steps" aria-label="Cómo funciona el programa">
          <li><span>01</span><div><strong>Solicita la entrega en tienda</strong><p>Indica qué equipo vas a llevar y espera la aprobación de Ventas.</p></div></li>
          <li><span>02</span><div><strong>Evaluamos el equipo</strong><p>Un técnico revisa y clasifica sus piezas.</p></div></li>
          <li><span>03</span><div><strong>Registramos su destino</strong><p>El historial muestra qué pasó con el equipo.</p></div></li>
        </ol>
      </section>
      <footer className="store-footer">
        <strong>AWStore</strong>
        <nav aria-label="Enlaces del pie de página">
          <a href="#productos">Explorar productos</a>
          <a href="#programa-circular">Reciclar un equipo</a>
        </nav>
      </footer>
      {profile && user && <Modal title="Mi perfil" onClose={() => setProfile(false)}><Profile user={user} onUpdated={onUserUpdated} /></Modal>}
      {collection && user && <Modal title="Reciclar mi equipo" onClose={() => setCollection(false)}><Collections user={user} /></Modal>}
      {history && user && (
        <Modal title="Mis compras y cuotas" onClose={() => setHistory(false)}>
          <PurchaseHistory user={user} notify={setMessage} />
        </Modal>
      )}
      {message && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {message}
          <button
            aria-label="Cerrar notificación"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
