import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import Badge from "../atomos/EtiquetaEstado";
import Button from "../atomos/Boton";
import EmptyState from "../moleculas/EstadoVacio";
import { formatDate } from "../../utilidades/formato";

export default function DeviceTable({ devices, onSelect, onEdit, onDelete }) {
  if (!devices.length)
    return (
      <EmptyState
        title="Sin equipos para mostrar"
        description="Registra una recepción o ajusta los filtros de búsqueda."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Equipo / código</th>
            <th>Cliente / remitente</th>
            <th>Estado</th>
            <th>Ubicación</th>
            <th>Ingreso</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>
                <button
                  className="text-link device-name"
                  onClick={() => onSelect(device.id)}
                >
                  {device.model}
                </button>
                <span className="code">{device.code}</span>
              </td>
              <td>{device.client_name}</td>
              <td>
                <Badge value={device.status} />
              </td>
              <td>{device.location}</td>
              <td className="date-cell">{formatDate(device.created_at)}</td>
              <td>
                <div className="row-actions">
                  {onEdit && device.status === "RECEPCIONADO" && (
                    <>
                      <Button
                        variant="ghost"
                        aria-label={`Editar ${device.code}`}
                        onClick={() => onEdit(device)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Eliminar ${device.code}`}
                        onClick={() => onDelete(device)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    aria-label={`Ver expediente ${device.code}`}
                    onClick={() => onSelect(device.id)}
                  >
                    <ArrowUpRight size={19} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
