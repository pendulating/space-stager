import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize for maplibre-gl
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'vendor': ['react', 'react-dom']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['maplibre-gl', '@mapbox/mapbox-gl-draw']
  }
})