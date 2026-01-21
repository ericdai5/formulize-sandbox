import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Dedupe React and other singleton packages to prevent "multiple copies" errors
    // when using npm link with local formula-editor
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
});
