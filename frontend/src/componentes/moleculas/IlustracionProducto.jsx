import { useEffect, useState } from "react";
import { Laptop, Monitor, Headphones, Keyboard, Mouse, Cpu, Cable, Router, Tablet, UserRound } from "lucide-react";

export function ResourcePhoto({ record, kind = "products", className = "resource-photo" }) {
  const [failed, setFailed] = useState(false);
  const filename = record?.photo_filename;
  useEffect(() => setFailed(false), [filename, record?.id]);
  const category = `${record?.category || ""} ${record?.name || record?.model || ""}`.toLowerCase();
  const Icon = kind === "users" ? UserRound : /monitor/.test(category) ? Monitor : /audio|audífono/.test(category) ? Headphones : /teclado|keyboard/.test(category) ? Keyboard : /mouse/.test(category) ? Mouse : /redes|router/.test(category) ? Router : /tablet/.test(category) ? Tablet : /componente|ssd|batería/.test(category) ? Cpu : /accesorio|hub/.test(category) ? Cable : Laptop;
  return <div className={className}>
    {filename && !failed ? <img src={`/api/photos/${kind}/${record.id}?v=${encodeURIComponent(filename)}`} alt={kind === "users" ? `Foto de ${record.name}` : record.name || record.model} loading="lazy" onError={() => setFailed(true)} /> : <div className="tech-placeholder" role="img" aria-label={kind === "users" ? "Avatar predeterminado" : `Ilustración de ${record?.category || "equipo tecnológico"}`}><Icon strokeWidth={1.2} /><span>{kind === "users" ? record?.name?.slice(0, 2).toUpperCase() : record?.category || "AWStore"}</span></div>}
  </div>;
}

export default function IlustracionProducto({ producto }) {
  return <ResourcePhoto record={producto} className="product-illustration" />;
}
