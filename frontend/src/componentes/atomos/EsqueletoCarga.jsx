export default function Skeleton({ rows = 4 }) {
  return (
    <div
      className="skeleton-group"
      role="status"
      aria-label="Cargando información"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
      <span className="sr-only">Cargando información…</span>
    </div>
  );
}
