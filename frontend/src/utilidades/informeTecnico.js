const escape = value => String(value ?? "Sin registrar").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function downloadTechnicalReport(device) {
  const evaluation = device.evaluation;
  if (!evaluation) return;
  const rows = device.components.map(c => `<tr><td>${escape(c.name)}</td><td>${escape(c.classification)}</td><td>${escape(c.voltage ?? "No medida")}</td><td>${escape(c.observations || "Sin observaciones")}</td></tr>`).join("");
  const content = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe técnico ${escape(device.code)}</title><style>body{font:16px/1.5 system-ui;max-width:1000px;margin:40px auto;padding:24px;color:#172b4d}h1{color:#2459b6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbc7d8;padding:12px;text-align:left}th{background:#edf3fc}@media print{body{margin:0}}</style><h1>AWStore · Informe técnico</h1><p>Expediente: <strong>${escape(device.code)}</strong><br>Equipo: ${escape(device.model)}<br>Técnico responsable: ${escape(evaluation.technician)}<br>Fecha de evaluación: ${escape(evaluation.created_at)}</p><h2>Conclusión</h2><p>${escape(evaluation.notes)}</p><h2>Diagnóstico por componente</h2><table><thead><tr><th>Componente</th><th>Clasificación</th><th>Voltaje (V)</th><th>Resultado de la prueba</th></tr></thead><tbody>${rows}</tbody></table><p>Documento emitido a partir del diagnóstico guardado en el expediente. Puede imprimirse o guardarse como PDF desde el navegador.</p></html>`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `Informe-tecnico-${device.code}.html`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
