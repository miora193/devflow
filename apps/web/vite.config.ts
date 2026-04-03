// vite.config.ts — configuration for the Vite development server
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// defineConfig is a helper that gives you TypeScript autocomplete for the config
export default defineConfig({
  plugins: [
    // This plugin adds React support — JSX transformation, Fast Refresh etc.
    // Fast Refresh means when you save a React component, only that component
    // updates in the browser — you do not lose your app state.
    react(),
  ],
  resolve: {
    alias: {
      // This connects the "@/" shortcut in your code to the actual src/ folder.
      // When Vite sees "import X from '@/components/X'" it looks in src/components/X
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // host: '0.0.0.0' means "accept connections from any IP address"
    // This is REQUIRED for Docker — without it, Vite only accepts connections
    // from inside the container, so your browser cannot reach it.
    host: '0.0.0.0',
    port: 5173,

    // If port 5173 is already in use, stop and tell me — don't silently use 5174
    strictPort: true,
  },
})