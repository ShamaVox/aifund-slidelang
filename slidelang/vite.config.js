import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy agent calls to the local API server (keeps the API key server-side).
    proxy: { "/api": "http://localhost:8000", "/d": "http://localhost:8000" },
  },
});
