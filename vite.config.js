import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      // Listen on all interfaces so http://<LAN-IP>:5174 works.
      host: true,
      // Dev: browser calls /api/v1/... on the Vite host; this forwards to FastAPI (avoids direct :8000 fetch issues).
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          // Avoid premature disconnects on slow responses / large multipart uploads.
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
        "/uploads": {
          target: proxyTarget,
          changeOrigin: true,
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  };
});
