import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Código único de cada publicación: la app lo compara con version.json para saber si hay una versión nueva.
const BUILD_ID = String(Date.now());
const versionJson = {
  name: "version-json",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id: BUILD_ID }) });
  },
};

export default defineConfig({
  plugins: [react(), versionJson],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: {
    rollupOptions: {
      output: {
        // Firebase y React en archivos aparte: cambian poco, así el celular los guarda y no los vuelve a bajar en cada versión.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
