import { useState } from "react";
import {
  Plus,
  Pencil,
  PackagePlus,
  Power,
  Hammer,
  Package,
  Search,
  Boxes,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import useResource from "../hooks/usarRecurso";
import Button from "../componentes/atomos/Boton";
import Skeleton from "../componentes/atomos/EsqueletoCarga";
import Field from "../componentes/moleculas/CampoFormulario";
import EmptyState from "../componentes/moleculas/EstadoVacio";
import Modal from "../componentes/organismos/Modal";
import {
  ProductForm,
  StockForm,
} from "../componentes/organismos/FormulariosNegocio";
import { api } from "../servicios/api";
import { money } from "../utilidades/dinero";
import { formatDate } from "../utilidades/formato";
import StatCard from "../componentes/moleculas/TarjetaIndicador";
import { ResourcePhoto } from "../componentes/moleculas/IlustracionProducto";

function AssemblyForm({ products, components, onSaved, onCancel }) {
  const [productId, setProductId] = useState("");
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const available = components.filter(
    (c) => c.classification === "REUTILIZABLE" && !c.closed_at,
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/assemblies", {
        method: "POST",
        body: { product_id: Number(productId), component_ids: selected, notes },
      });
      onSaved("Ensamble registrado. Se añadió una unidad al producto.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="form-description">
        Selecciona las piezas recuperadas que utilizarás en una unidad
        reacondicionada. Cada equipo de origen debe tener evidencia adjunta. El
        consumo y la entrada al inventario se guardan juntos.
      </p>
      <Field
        label="Producto reacondicionado de destino"
        as="select"
        required
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
      >
        <option value="">Selecciona un producto</option>
        {products
          .filter((p) => p.condition === "REACONDICIONADO" && p.active)
          .map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
      </Field>
      <fieldset className="assembly-options">
        <legend>Piezas disponibles</legend>
        {available.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((id) => id !== c.id),
                )
              }
            />
            <span>
              {c.name}
              <small>
                {c.code} · {c.model}
              </small>
            </span>
          </label>
        ))}
        {!available.length && (
          <p className="muted">
            No hay piezas reutilizables pendientes de destino. Registra primero
            un diagnóstico.
          </p>
        )}
      </fieldset>
      <Field
        label="Trabajo realizado"
        as="textarea"
        required
        minLength={5}
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={busy || !selected.length}>
          {busy ? "Registrando…" : "Completar una unidad"}
        </Button>
      </div>
    </form>
  );
}

export default function Products({ notify, onChanged }) {
  const products = useResource("/products");
  const movements = useResource("/stock-movements");
  const components = useResource("/components");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function saved(message) {
    setModal(null);
    notify(message);
    products.reload();
    movements.reload();
    components.reload();
    onChanged();
  }
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const list = products.data.filter(
    (p) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
      (!stockFilter ||
        (stockFilter === "low"
          ? p.active && p.stock <= 2
          : stockFilter === "active"
            ? p.active
            : !p.active)),
  );
  async function toggle(product) {
    setBusy(true);
    setError("");
    try {
      await api(`/products/${product.id}/toggle`, { method: "POST" });
      saved("Visibilidad del producto actualizada.");
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
          <div className="eyebrow">BODEGA Y FABRICACIÓN</div>
          <h1>
            Productos e inventario<span>.</span>
          </h1>
          <p>
            Controla existencias, movimientos y el valor que vuelve a circular.
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="secondary"
            onClick={() => setModal({ type: "assembly" })}
          >
            <Hammer size={16} /> Registrar ensamble
          </Button>
          <Button onClick={() => setModal({ type: "product" })}>
            <Plus size={16} /> Nuevo producto
          </Button>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard
          label="Unidades en bodega"
          value={products.data
            .filter((p) => p.active)
            .reduce((sum, p) => sum + p.stock, 0)}
          description="Productos activos disponibles"
          icon={Boxes}
        />
        <StatCard
          label="Existencias bajas"
          value={products.data.filter((p) => p.active && p.stock <= 2).length}
          description="Productos con 2 unidades o menos"
          icon={AlertTriangle}
        />
        <StatCard
          label="Valor a precio de venta"
          value={money(
            products.data
              .filter((p) => p.active)
              .reduce((sum, p) => sum + p.stock * p.price_cents, 0),
          )}
          description="Existencias por precio final"
          icon={Wallet}
        />
        <StatCard
          label="Piezas para ensamble"
          value={
            components.data.filter(
              (c) => c.classification === "REUTILIZABLE" && !c.closed_at,
            ).length
          }
          description="Reutilizables pendientes de destino"
          icon={Hammer}
          accent
        />
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {products.error && (
        <p className="error" role="alert">
          {products.error}
          <Button onClick={products.reload}>Reintentar</Button>
        </p>
      )}
      {products.loading ? (
        <Skeleton />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Package size={19} /> Existencias de productos
            </h2>
            <span className="small-label">
              {products.data.reduce((sum, p) => sum + p.stock, 0)} UNIDADES
            </span>
          </div>
          <div className="list-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Buscar inventario de productos"
                placeholder="Buscar por producto o SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Filtrar existencias"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="">Todos los productos</option>
              <option value="active">Activos</option>
              <option value="low">Existencias bajas</option>
              <option value="inactive">Desactivados</option>
            </select>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Condición</th>
                  <th>Precio</th>
                  <th>Existencias</th>
                  <th>Catálogo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <ResourcePhoto record={p} />
                      <strong>{p.name}</strong>
                      <span className="code">{p.sku}</span>
                    </td>
                    <td>
                      {p.condition === "NUEVO" ? "Nuevo" : "Reacondicionado"}
                    </td>
                    <td>{money(p.price_cents)}</td>
                    <td>
                      <strong className={!p.stock ? "stock-empty" : ""}>
                        {p.stock} unidades
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${p.active ? "badge--confirmado" : ""}`}
                      >
                        {p.active ? "Visible" : "Desactivado"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Editar ${p.name}`}
                          onClick={() =>
                            setModal({ type: "product", record: p })
                          }
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Mover existencias de ${p.name}`}
                          onClick={() => setModal({ type: "stock", record: p })}
                        >
                          <PackagePlus size={17} />
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-label={`${p.active ? "Desactivar" : "Activar"} ${p.name}`}
                          onClick={() => toggle(p)}
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
        </section>
      )}
      <section className="panel business-section">
        <div className="panel-heading">
          <div>
            <h2>Historial de movimientos</h2>
            <p>
              Entradas y salidas con motivo y responsable. Últimos 200
              registros.
            </p>
          </div>
        </div>
        {movements.error && <p className="error">{movements.error}</p>}
        {movements.loading ? (
          <Skeleton />
        ) : movements.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th>Motivo</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.created_at)}</td>
                    <td>{m.product_name}</td>
                    <td>
                      <span
                        className={`movement-number ${m.quantity > 0 ? "positive" : "negative"}`}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity}
                      </span>
                    </td>
                    <td>{m.reason}</td>
                    <td>{m.responsible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Todavía no hay movimientos" />
        )}
      </section>
      {modal && (
        <Modal
          title={
            modal.type === "assembly"
              ? "Registrar ensamble circular"
              : modal.type === "stock"
                ? "Movimiento de existencias"
                : modal.record
                  ? "Editar producto"
                  : "Nuevo producto"
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "product" && (
            <ProductForm
              initial={modal.record}
              onSaved={saved}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === "stock" && (
            <StockForm
              product={modal.record}
              onSaved={saved}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === "assembly" &&
            (components.loading ? (
              <Skeleton />
            ) : components.error ? (
              <p className="error">{components.error}</p>
            ) : (
              <AssemblyForm
                products={products.data}
                components={components.data}
                onSaved={saved}
                onCancel={() => setModal(null)}
              />
            ))}
        </Modal>
      )}
    </>
  );
}
