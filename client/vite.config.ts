import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the Vite dev server proxies /api and the /socket.io WebSocket
// namespace to the backend, so the client can use same-origin URLs. In
// production the built client is served directly by Express (or any static
// host) and VITE_API_URL can point at the deployed backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true },
      // Uploaded background images are served by Express from /uploads, so the
      // dev server has to forward that path too — otherwise the display page
      // 404s on the background image.
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
