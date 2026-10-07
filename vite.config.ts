import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages needs /it-inventory/ base
// Vercel and local dev use /
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? '/it-inventory/' : '/',
})
