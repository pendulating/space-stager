import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setupTests.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'node_modules/**',
        'public/**',
        'scripts/**',
        '**/*.config.*',
        'vite.config.*',
        'playwright.config.*',
        'tailwind.config.js',
        'postcss.config.js'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      }
    },
    // Minimal output settings
    reporters: ['basic'],
    silent: true,
    // Reduce worker concurrency and set sane timeouts to avoid OOM/hangs
    maxThreads: 2,
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 2,
        minThreads: 1,
      }
    },
    testTimeout: 2000,
    hookTimeout: 2000,
    teardownTimeout: 2000,
    slowTestThreshold: 300,
    fakeTimers: {
      toFake: ['setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','performance'],
      loopLimit: 1000,
    },
    onConsoleLog: (log, type) => {
      // Suppress stdout from tests to minimize noise; keep errors
      if (type === 'stdout') return false
    },
  },
  server: {
    port: 3001,
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