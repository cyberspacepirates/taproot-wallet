import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import * as NodePolly from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    NodePolly.nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
    react(),
  ],
});
