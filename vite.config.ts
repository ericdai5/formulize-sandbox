import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { e2bPlugin } from "./scripts/vite-plugin-e2b";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv(prefix='') loads every var from .env (Vite normally only exposes
  // VITE_* to the client; the e2b plugin runs in the Node side, so we hand it
  // the values directly).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      e2bPlugin({
        apiKey: env.E2B_API_KEY,
        template: env.E2B_TEMPLATE,
        openAiApiKey: env.OPENAI_API_KEY,
        openAiModel: env.OPENAI_MODEL,
      }),
    ],
    resolve: {
      // Dedupe React and other singleton packages to prevent "multiple copies"
      // errors when using npm link with local formula-editor
      dedupe: [
        "react",
        "react-dom",
        "mobx",
        "mobx-react-lite",
        "mobx-state-tree",
      ],
    },
    build: {
      // Disable minification to preserve function source code for step engine
      minify: false,
      rollupOptions: {
        // Disable tree-shaking to preserve view() calls in manual functions
        treeshake: false,
      },
    },
  };
});
