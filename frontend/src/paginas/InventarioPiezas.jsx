import { useState } from "react";
import { ArrowUpRight, Boxes, Search } from "lucide-react";
import ClassificationGuide from "../componentes/moleculas/GuiaClasificacion";
import Badge from "../componentes/atomos/EtiquetaEstado";
import Button from "../componentes/atomos/Boton";
import EmptyState from "../componentes/moleculas/EstadoVacio";
import { classifications, statusLabels } from "../utilidades/formato";

export default function Inventory({ components, onSelect }) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("");
  const list = components.filter(
    (c) =>
      (!filter || c.classification === filter) &&
      (!availability ||
        (availability === "pending" ? !c.closed_at : !!c.closed_at)) &&
      `${c.name} ${c.code} ${c.model}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">RECUPERAR · REPARAR · RECICLAR</div>
          <h1>
            Inventario circular<span>.</span>
          </h1>
          <p>
            Identifica qué se puede usar, reparar o reciclar. Las piezas con
            destino confirmado ya no están disponibles para ensamble.
          </p>
        </div>
        <span className="header-chip">
          <Boxes size={17} /> {components.length} componentes
        </span>
      </section>
      <ClassificationGuide />
      <div className="inventory-counts">
        {classifications.map((key) => (
          <button key={key} onClick={() => setFilter(key)}>
            <strong>
              {
                components.filter(
                  (c) => c.classification === key && !c.closed_at,
                ).length
              }
            </strong>
            <span>{statusLabels[key]} · pendientes</span>
          </button>
        ))}
      </div>
      <div className="filter-tabs">
        <button
          className={!filter ? "selected" : ""}
          onClick={() => setFilter("")}
        >
          Todos
        </button>
        {classifications.map((c) => (
          <button
            key={c}
            className={filter === c ? "selected" : ""}
            onClick={() => setFilter(c)}
          >
            {statusLabels[c]}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Buscar componentes"
              placeholder="Nombre, código o equipo de origen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Disponibilidad de componentes"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="">Todos los componentes</option>
            <option value="pending">Pendientes de destino</option>
            <option value="closed">Con destino confirmado</option>
          </select>
        </div>
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Equipo de origen</th>
                  <th>Clasificación</th>
                  <th>Voltaje</th>
                  <th>Destino</th>
                  <th>Expediente</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <span className="code">
                        {c.observations || "Sin observaciones"}
                      </span>
                    </td>
                    <td>
                      {c.model}
                      <span className="code">{c.code}</span>
                    </td>
                    <td>
                      <Badge value={c.classification} />
                    </td>
                    <td>{c.voltage == null ? "—" : `${c.voltage} V`}</td>
                    <td>
                      {c.destination || (
                        <span className="muted">Pendiente de confirmar</span>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`Ver equipo ${c.code}`}
                        onClick={() => onSelect(c.device_id)}
                      >
                        <ArrowUpRight size={19} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aquí comienza la segunda vida"
            description="Los componentes aparecerán cuando registres un diagnóstico en el taller."
          />
        )}
      </section>
    </>
  );
}
