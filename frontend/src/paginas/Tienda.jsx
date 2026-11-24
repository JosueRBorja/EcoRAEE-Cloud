import { useEffect, useRef, useState } from "react";
import { Plus, Search, Leaf, CheckCircle2, ShoppingBag } from "lucide-react";
import useResource from "../hooks/usarRecurso";
import { api } from "../servicios/api";
import { money } from "../utilidades/dinero";
import { readCart, saveCart, clearCart } from "../utilidades/carrito";
import Button from "../componentes/atomos/Boton";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import EmptyState from "../componentes/moleculas/EstadoVacio";
import CartPanel from "../componentes/organismos/CarritoCompra";
import Modal from "../componentes/organismos/Modal";
import IlustracionProducto from "../componentes/moleculas/IlustracionProducto";

export default function Shop({
  user,
  clients,
  notify,
  onOrders,
  onLoginRequired,
  cartOpen,
  onCloseCart,
  onCartCount,
}) {
  const shopper = !user || user.role === "client";
  const {
    data: products,
    loading,
    error,
    reload,
  } = useResource(shopper ? "/catalog" : "/products");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("default");
  const [cart, setCart] = useState(() => (shopper ? readCart() : {}));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [detail, setDetail] = useState(null);
  const attempt = useRef({ signature: "", key: "" });
  const [carritoInterno, abrirCarritoInterno] = useState(false);
  const [versionFormulario, reiniciarFormulario] = useState(0);
  const compraConfirmada = useRef(null);
  const cerrarCarrito = () => {
    abrirCarritoInterno(false);
    onCloseCart?.();
  };
  useEffect(() => {
    if (shopper) saveCart(cart);
  }, [cart, shopper]);
  const lines = products.filter((p) => cart[p.id] && p.active);
  const total = lines.reduce((sum, p) => sum + p.price_cents * cart[p.id], 0);
  const cantidad = lines.reduce((sum, p) => sum + cart[p.id], 0);
  useEffect(() => {
    onCartCount?.(cantidad);
  }, [cantidad, onCartCount]);
  useEffect(() => {
    if (receipt)
      compraConfirmada.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [receipt]);
  function quantity(product, delta) {
    setCart((previous) => ({
      ...previous,
      [product.id]: Math.max(
        0,
        Math.min(product.stock, 100, (previous[product.id] || 0) + delta),
      ),
    }));
  }
  async function checkout(values) {
    setBusy(true);
    setFormError("");
    try {
      const body = {
        ...values,
        items: lines.map((p) => ({ product_id: p.id, quantity: cart[p.id] })),
      };
      if (shopper) {
        const signature = JSON.stringify(body);
        if (attempt.current.signature !== signature)
          attempt.current = { signature, key: crypto.randomUUID() };
        body.request_key = attempt.current.key;
      } else delete body.demo_payment_confirmed;
      const result = await api(shopper ? "/checkout" : "/orders", {
        method: "POST",
        body,
      });
      setCart({});
      clearCart();
      attempt.current = { signature: "", key: "" };
      setReceipt({
        ...result,
        total: result.total_cents ?? total,
        credit: values.payment_type === "CREDITO",
      });
      cerrarCarrito();
      reiniciarFormulario((version) => version + 1);
      reload();
      if (!shopper) {
        notify(result.message);
        onOrders();
      }
    } catch (err) {
      setFormError(err.message);
      reload();
    } finally {
      setBusy(false);
    }
  }
  let list = products.filter(
    (p) =>
      p.active &&
      (!filter || p.condition === filter) &&
      (!category || p.category === category) &&
      `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (sort !== "default")
    list = [...list].sort((a, b) =>
      sort === "low"
        ? a.price_cents - b.price_cents
        : b.price_cents - a.price_cents,
    );
  return (
    <>
      <section className="shop-banner">
        <div>
          <h1>
            Tecnología nueva y <span className="crayon-title">reacondicionada</span>
          </h1>
          <p>
            Encuentra computadoras, monitores, audio, componentes y accesorios para tu próximo equipo.
          </p>
          <a className="button button--primary shop-explore" href="#productos">Explorar productos</a>
          <div className="shop-promises">
            <span>
              <Leaf size={16} /> Opciones reacondicionadas
            </span>
            <span>
              <ShoppingBag size={16} /> Retiro en tienda o entrega
            </span>
          </div>
        </div>
      </section>
      {receipt && (
        <section
          className="purchase-success"
          role="status"
          ref={compraConfirmada}
        >
          <CheckCircle2 size={28} />
          <div>
            <h2>
              {receipt.credit
                ? "Tu solicitud está en revisión"
                : "¡Tu compra está confirmada!"}
            </h2>
            <p>
              Compra #{receipt.id} · {money(receipt.total)}. {receipt.message}
            </p>
            <Button variant="ghost" onClick={onOrders}>
              Consultar mi compra
            </Button>
          </div>
          <button
            aria-label="Cerrar confirmación de compra"
            onClick={() => setReceipt(null)}
          >
            ×
          </button>
        </section>
      )}
      <div className="shop-layout" id="productos" tabIndex={-1}>
        <section>
          <h2 className="shop-catalog-title">Catálogo de productos</h2>
          <div className="filter-tabs shop-categories" role="group" aria-label="Categorías">
            <button
              className={!category ? "selected" : ""}
              aria-pressed={!category}
              onClick={() => setCategory("")}
            >
              Todos
            </button>
            {[
              ...new Set(
                products.filter((p) => p.active).map((p) => p.category),
              ),
            ].map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="shop-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Buscar productos"
                placeholder="Busca un equipo, componente o accesorio"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Condición de productos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Nuevos y reacondicionados</option>
              <option value="NUEVO">Solo nuevos</option>
              <option value="REACONDICIONADO">Solo reacondicionados</option>
            </select>
            <select
              aria-label="Ordenar productos"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="default">Destacados</option>
              <option value="low">Menor precio</option>
              <option value="high">Mayor precio</option>
            </select>
          </div>
          <div className="gallery-caption">
            <span role="status">{loading ? "Cargando productos…" : error ? "" : `${list.length} ${list.length === 1 ? "producto encontrado" : "productos encontrados"}`}</span>
            {(search || filter || category || sort !== "default") && (
              <button className="text-link" onClick={() => { setSearch(""); setFilter(""); setCategory(""); setSort("default"); }}>Limpiar filtros</button>
            )}
            {!shopper && (
              <button
                className="text-link"
                onClick={() => abrirCarritoInterno(true)}
              >
                Abrir carrito ({cantidad})
              </button>
            )}
          </div>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div className="error" role="alert">
              {error}
              <Button onClick={reload}>Reintentar</Button>
            </div>
          ) : (
            <div className="product-grid">
              {list.map((p, i) => {
                return (
                  <article className="product-card" key={p.id}>
                    <button
                      className={`product-art product-art--${i % 4}`}
                      aria-label={`Ver detalles de ${p.name}`}
                      onClick={() => setDetail(p)}
                    >
                      <IlustracionProducto producto={p} />
                    </button>
                    <div className="product-info">
                      <span className="eyebrow">
                        {p.condition === "NUEVO"
                          ? "PRODUCTO NUEVO"
                          : "REACONDICIONADO"}
                      </span>
                      <h2>{p.name}</h2>
                      <p>{p.description}</p>
                      <div className="product-price">
                        <strong>{money(p.price_cents)}</strong>
                        <span>
                          {p.stock
                            ? `${p.stock} ${p.stock === 1 ? "disponible" : "disponibles"}`
                            : "Agotado"}
                        </span>
                      </div>
                      <Button
                        variant={cart[p.id] ? "primary" : "secondary"}
                        disabled={
                          busy || !p.stock || (cart[p.id] || 0) >= p.stock
                        }
                        onClick={() => quantity(p, 1)}
                      >
                        <Plus size={16} />
                        {cart[p.id]
                          ? `Añadir otro · ${cart[p.id]} en carrito`
                          : "Añadir al carrito"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!loading && !error && !list.length && (
            <EmptyState
              title="No encontramos productos"
              description="Prueba con otra categoría o cambia tu búsqueda."
            />
          )}
        </section>
      </div>
      <Modal
        title="Tu carrito"
        onClose={cerrarCarrito}
        open={cartOpen ?? carritoInterno}
      >
        <CartPanel
          key={versionFormulario}
          user={user}
          clients={clients}
          lines={lines}
          cart={cart}
          quantity={quantity}
          remove={(id) => setCart({ ...cart, [id]: 0 })}
          total={total}
          busy={busy}
          error={formError}
          onCheckout={checkout}
          onLoginRequired={onLoginRequired}
        />
      </Modal>
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="product-detail">
            <IlustracionProducto producto={detail} />
            <span className="badge">
              {detail.condition === "NUEVO" ? "Nuevo" : "Reacondicionado"}
            </span>
            <p>{detail.description}</p>
            <dl>
              <div>
                <dt>Categoría</dt>
                <dd>{detail.category}</dd>
              </div>
              <div>
                <dt>Disponibilidad</dt>
                <dd>{detail.stock} unidades</dd>
              </div>
              <div>
                <dt>Precio final</dt>
                <dd>{money(detail.price_cents)}</dd>
              </div>
            </dl>
            <p className="section-hint">
              Puedes retirar tu compra en tienda o coordinar su entrega. Si
              eliges crédito, finanzas revisará tu solicitud antes de confirmar.
            </p>
            <Button
              disabled={!detail.stock || (cart[detail.id] || 0) >= detail.stock}
              onClick={() => {
                quantity(detail, 1);
                setDetail(null);
              }}
            >
              Añadir al carrito
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
