import { Sprout } from "lucide-react";

export default function EmptyState({
  title = "Todavía no hay registros",
  description = "Los registros que agregues aparecerán aquí.",
  children,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Sprout size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
