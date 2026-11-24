import { useState } from "react";
import { Plus, Search } from "lucide-react";
import Button from "../componentes/atomos/Boton";
import DeviceTable from "../componentes/organismos/TablaEquipos";
import SolicitudesRecoleccion from "../componentes/organismos/SolicitudesRecoleccion";
import { statusLabels } from "../utilidades/formato";

export default function Devices({
  devices,
  workshop,
  manageCollections,
  onReceived,
  onCreate,
  onSelect,
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const list = devices.filter(
    (d) =>
      (!workshop || d.status === "EN_EVALUACION") &&
      (!status || d.status === status) &&
      `${d.model} ${d.code} ${d.client_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            {workshop ? "EVALUACIÓN TÉCNICA" : "EL INICIO DEL RECORRIDO"}
          </div>
          <h1>
            {workshop ? "Taller y diagnóstico" : "Recepción RAEE"}
            <span>.</span>
          </h1>
          <p>
            {workshop
              ? "Abre un expediente para evaluar sus componentes y registrar el diagnóstico."
              : "Registra cada equipo y mantén su información organizada."}
          </p>
        </div>
        {!workshop && (
          <Button onClick={onCreate}>
            <Plus size={18} /> Nueva recepción
          </Button>
        )}
      </section>
      {manageCollections && <SolicitudesRecoleccion onReceived={onReceived} />}
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Buscar equipos"
              placeholder="Buscar por código, equipo o remitente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!workshop && (
            <select
              aria-label="Filtrar por estado"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {["RECEPCIONADO", "EN_EVALUACION", "CLASIFICADO", "CERRADO"].map(
                (value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ),
              )}
            </select>
          )}
          <span className="small-label">{list.length} REGISTROS</span>
        </div>
        <DeviceTable
          devices={list}
          onSelect={onSelect}
          onEdit={workshop ? undefined : onEdit}
          onDelete={onDelete}
        />
      </section>
    </>
  );
}
