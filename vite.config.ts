import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Compress assets
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Split large vendor chunks
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],
          // Firebase
          'firebase-vendor': ['firebase/app', 'firebase/firestore'],
          // XLSX / file processing
          'xlsx-vendor': ['xlsx'],
          // Lucide icons
          'icons-vendor': ['lucide-react'],
        },
        // Organize output files
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase warning threshold since we've split chunks
    chunkSizeWarningLimit: 600,
  },
})
