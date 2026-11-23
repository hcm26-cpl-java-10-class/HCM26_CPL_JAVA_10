// Chi dung khi kiem thu bang trinh duyet tich hop cua Claude (khong commit).
// Chay (PowerShell): $env:VITE_API_URL="/api"; $env:VITE_WS_URL="ws://localhost:5175"; npx vite --config vite.pane.config.ts --port 5175
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

const target = 'http://localhost:8080'
// Backend chi chap nhan CORS tu http://localhost:5173, nen doi Origin khi chuyen tiep.
const fixOrigin = (proxy: any) => {
  proxy.on('proxyReq', (req: any) => req.setHeader('origin', 'http://localhost:5173'))
  proxy.on('proxyReqWs', (req: any) => req.setHeader('origin', 'http://localhost:5173'))
}

export default mergeConfig(base, defineConfig({
  server: {
    proxy: {
      '/api': { target, ws: true, configure: fixOrigin },
      '/ws': { target, ws: true, configure: fixOrigin },
    },
  },
}))
