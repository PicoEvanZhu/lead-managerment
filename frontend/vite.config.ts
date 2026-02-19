import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("/reactflow/")) {
            return "vendor-reactflow";
          }
          if (
            id.includes("/antd/") ||
            id.includes("@ant-design") ||
            id.includes("@rc-component/") ||
            id.includes("/rc-")
          ) {
            return "vendor-antd";
          }
          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("/moment/")) {
            return "vendor-moment";
          }
        }
      }
    }
  }
});
