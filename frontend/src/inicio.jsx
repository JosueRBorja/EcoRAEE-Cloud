import React from "react";
import { createRoot } from "react-dom/client";
import App from "./Aplicacion";
import "./estilos.css";
import "./negocio.css";
import "./tienda.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "./tema-galeria.css";
import "./tema-tecnologia.css";
import "./tema-uide.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
