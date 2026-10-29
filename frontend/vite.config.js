import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/gateway': {
        target: 'http://127.0.0.1:3050',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gateway/, ''),
      }
    }
  }
})
