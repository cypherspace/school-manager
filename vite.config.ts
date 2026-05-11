import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // GitHub Pages serves from /<repo>/ — set via env so local dev stays at "/".
  base: process.env.GITHUB_PAGES === "1" ? "/school-manager/" : "/",
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});
