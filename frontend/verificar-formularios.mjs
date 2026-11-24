import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true } });
try {
  const { default: Field } = await server.ssrLoadModule("/src/componentes/moleculas/CampoFormulario.jsx");
  const { FormRole, guidedOptions } = await server.ssrLoadModule("/src/utilidades/opcionesFormulario.js");
  for (const role of ["client", "sales", "technician", "inventory", "finance"]) {
    for (const label of Object.keys(guidedOptions)) {
      const html = renderToStaticMarkup(React.createElement(FormRole.Provider, { value: role }, React.createElement(Field, { label, as: "textarea", value: "", onChange() {} })));
      assert.ok(html.includes("<select"), `${role}: ${label}`);
      assert.ok(!html.includes("<textarea"), `${role}: texto libre en ${label}`);
    }
  }
  const admin = renderToStaticMarkup(React.createElement(FormRole.Provider, { value: "admin" }, React.createElement(Field, { label: "Trabajo realizado", as: "textarea", defaultValue: "Trabajo específico" })));
  assert.ok(admin.includes("<textarea"));
  const historic = renderToStaticMarkup(React.createElement(Field, { label: "Observaciones", value: "Dato histórico especial", onChange() {} }));
  assert.ok(historic.includes("Dato histórico especial"));
  const { ProductForm } = await server.ssrLoadModule("/src/componentes/organismos/FormulariosNegocio.jsx");
  const renderProduct = role => renderToStaticMarkup(React.createElement(FormRole.Provider, { value: role }, React.createElement(ProductForm, {})));
  const inventory = renderProduct("inventory");
  assert.ok(inventory.includes("AW-"));
  assert.ok(inventory.includes("readOnly"));
  assert.ok(inventory.includes("Modelo registrado"));
  assert.ok(inventory.includes("Descripción automática"));
  const { describeProduct } = await server.ssrLoadModule("/src/componentes/organismos/FichaProducto.jsx");
  const description = describeProduct("NovaBook 14", "NUEVO", { ram: "16 GB", storage: "512 GB", storage_type: "SSD NVMe" }, "Computadoras");
  assert.ok(description.includes("Memoria RAM: 16 GB"));
  assert.ok(description.includes("Almacenamiento: 512 GB"));
  const adminProduct = renderProduct("admin");
  assert.ok(adminProduct.includes("<textarea"));
  const { downloadTechnicalReport } = await server.ssrLoadModule("/src/utilidades/informeTecnico.js");
  let savedBlob;
  globalThis.URL.createObjectURL = blob => { savedBlob = blob; return "blob:test"; };
  globalThis.document = { createElement: () => ({ click() {} }) };
  downloadTechnicalReport({ code: "TEST-1", model: '<script>alert(1)</script>', evaluation: { technician: "Técnico", notes: "Evaluado", created_at: "2026-11-21" }, components: [{ name: "RAM", classification: "REUTILIZABLE", voltage: null }] });
  const report = await savedBlob.text();
  assert.ok(report.includes("&lt;script&gt;"));
  assert.ok(!report.includes("<script>"));
  assert.ok(report.includes("No medida"));
  console.log("Formularios: selecciones en los cinco roles, edición del administrador y conservación de datos históricos correctas.");
} finally { await server.close(); }
