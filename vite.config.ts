import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  optimizeDeps: { include: ["@mediapipe/tasks-vision"] },
  cacheDir: ".vite-cache",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600 },
});
