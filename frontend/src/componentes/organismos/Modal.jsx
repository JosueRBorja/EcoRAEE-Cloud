import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import Button from "../atomos/Boton";

export default function Modal({ title, children, onClose, open = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <Button variant="ghost" aria-label="Cerrar ventana" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
