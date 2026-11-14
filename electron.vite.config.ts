import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: "out/main" },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: { output: { format: "cjs", entryFileNames: "index.cjs" } },
    },
  },
  renderer: {
    root: ".",
    plugins: [react()],
    server: { host: "0.0.0.0", port: 7100 },
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: `${process.cwd()}/index.html` },
    },
  },
});
