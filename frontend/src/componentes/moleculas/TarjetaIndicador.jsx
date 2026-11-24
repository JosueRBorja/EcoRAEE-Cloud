import { ArrowUpRight } from "lucide-react";

export default function StatCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}) {
  return (
    <article className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <div className="stat-value">
        {value}
        <ArrowUpRight size={22} />
      </div>
      <p>{description}</p>
    </article>
  );
}
