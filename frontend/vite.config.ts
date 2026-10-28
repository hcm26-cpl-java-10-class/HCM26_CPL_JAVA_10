import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // strictPort: không tự nhảy sang port khác (5174, 5175...) khi 5173 đã bị chiếm.
  // Vite mặc định fallback sang port trống -> frontend chạy ở port khác backend
  // đã allow CORS -> mọi request API bị 403 và không đăng nhập được.
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})