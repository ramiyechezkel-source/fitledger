import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = שם ה-repo ב-GitHub Pages. אם משנים את שם ה-repo, לשנות כאן.
export default defineConfig({
  plugins: [react()],
  base: '/fitledger/',
  build: { outDir: 'dist', sourcemap: false },
})
