import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Portfolio edition: a separate Vite root whose public/ holds only the
// synthetic dataset, so the research payload can never be copied into the
// build. __DG_EDITION__ switches the shared code to its portfolio wording and
// removes research lookups at compile time (src/lib/edition.js).
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
  define: { __DG_EDITION__: JSON.stringify("portfolio") },
  // node_modules may be a symlink (see the dashboard README); keep link paths.
  resolve: { preserveSymlinks: true },
  // The shared modules live one level up in ../src.
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Plotly ships as one pre-built module (~1.5 MB minified); splitting it gains nothing.
    chunkSizeWarningLimit: 2000,
  },
});
