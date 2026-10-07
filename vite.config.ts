import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? '/it-inventory/' : '/',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':   ['react', 'react-dom', 'react-router-dom'],
          'supabase':       ['@supabase/supabase-js'],
          'charts':         ['recharts'],
          'xlsx':           ['xlsx'],
          'ui':             ['lucide-react'],
        },
      },
    },
  },
})
