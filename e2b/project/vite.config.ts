import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// HMR clientPort=443 because E2B exposes the dev server over HTTPS via
// `getHost(5173)`; without this the in-iframe HMR client tries to dial
// localhost and fails.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 443, protocol: "wss" },
    allowedHosts: true,
  },
});
