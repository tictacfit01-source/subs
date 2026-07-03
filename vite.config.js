import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendors in their own chunks: app-code changes don't invalidate the
        // cached react/supabase bundles between deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
