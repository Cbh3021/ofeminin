import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Build Electron (Windows 8.1) : Chromium 108 = Electron 22
  ...(mode === 'electron' && {
    build: { target: 'chrome108', cssTarget: 'chrome108' },
  }),
}))
