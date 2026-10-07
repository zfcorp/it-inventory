import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use /it-inventory/ base for GitHub Pages, / for Vercel and local dev
const base = process.env.GITHUB_ACTIONS ? '/it-inventory/' : '/'

export default defineConfig({
  plugins: [react()],
  base,
})
