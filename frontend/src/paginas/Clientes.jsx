import { useState } from "react";
import { Plus, Pencil, Trash2, Search, UserRound } from "lucide-react";
import Button from "../componentes/atomos/Boton";
import EmptyState from "../componentes/moleculas/EstadoVacio";

export default function Clients({ clients, onCreate, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const list = clients.filter((c) =>
    `${c.name} ${c.document}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">CONTACTOS DE VENTAS Y RECEPCIÓN</div>
          <h1>
            Clientes y remitentes<span>.</span>
          </h1>
          <p>
            Clientes que compran y personas que entregan equipos usados. Una
            ficha puede cumplir ambas funciones.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={18} /> Nuevo contacto
        </Button>
      </section>
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Buscar clientes y remitentes"
              placeholder="Buscar por nombre o identificador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="small-label">{list.length} CONTACTOS</span>
        </div>
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente / remitente</th>
                  <th>Identificador</th>
                  <th>Teléfono</th>
                  <th>Sector / dirección</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="person-cell">
                        <span className="person-avatar">
                          <UserRound size={18} />
                        </span>
                        <strong>{c.name}</strong>
                      </span>
                    </td>
                    <td className="mono">{c.document}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.address || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Editar ${c.name}`}
                          onClick={() => onEdit(c)}
                        >
                          <Pencil size={17} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Eliminar ${c.name}`}
                          onClick={() => onDelete(c)}
                        >
                          <Trash2 size={17} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Todavía no hay contactos" />
        )}
      </section>
      <p className="section-hint">
        Las fichas asociadas a compras, cuentas o equipos se conservan para
        proteger el historial. «Remitente» es quien entrega un equipo usado para
        evaluación o reciclaje.
      </p>
    </>
  );
}
