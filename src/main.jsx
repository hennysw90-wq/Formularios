import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import App from "./App.jsx";
import { aplicarModoEmbebido } from "./embed.js";

aplicarModoEmbebido(); // si se abre dentro del portal (?embed=1)

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
