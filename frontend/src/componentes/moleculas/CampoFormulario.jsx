import { useContext, useId } from "react";
import { FormRole, guidedOptions } from "../../utilidades/opcionesFormulario";

export default function Field({
  label,
  children,
  as: Control = "input",
  options,
  showExceptionHint = true,
  ...props
}) {
  const id = useId();
  const role = useContext(FormRole);
  const choices = role !== "admin" && !props.readOnly && Control !== "select" && (options || guidedOptions[label]);
  const exceptionHint = showExceptionHint && role !== "admin" && !props.readOnly && !choices && Control !== "select" && !["password", "email", "file", "month", "date"].includes(props.type)
    ? (props.type === "number" ? "Dato exacto: indica únicamente el importe, cantidad o medición real." : "Dato específico: escribe únicamente la información real de identidad, contacto o referencia solicitada.") : null;
  if (choices) {
    return <div className="field"><label htmlFor={id}>{label}{props.required && <span aria-hidden="true"> *</span>}</label><select id={id} required={props.required} disabled={props.disabled} value={props.value} onChange={props.onChange} name={props.name}><option value="">Selecciona una opción{!props.required ? " (opcional)" : ""}</option>{props.value && !choices.includes(props.value) && <option value={props.value}>{props.value} · valor registrado</option>}{choices.map(value => <option key={value} value={value}>{value}</option>)}</select></div>;
  }
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      {Control === "input" ? <input id={id} {...(props.type === "email" && !props.readOnly ? {
        pattern: String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`,
        title: "Ingresa un correo con formato nombre@dominio.com",
      } : {})} {...props} /> : <Control id={id} {...props}>
        {children}
      </Control>}
      {exceptionHint && <small className="field-help">{exceptionHint}</small>}
    </div>
  );
}
