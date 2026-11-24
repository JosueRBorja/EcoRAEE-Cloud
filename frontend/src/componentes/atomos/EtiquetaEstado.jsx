import { statusLabels } from "../../utilidades/formato";

export default function Badge({ value }) {
  return (
    <span className={`badge badge--${value?.toLowerCase()}`}>
      {statusLabels[value] || value}
    </span>
  );
}
