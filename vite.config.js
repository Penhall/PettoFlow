import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const workspaceAccessSecret = env.VITE_WORKSPACE_ACCESS_SECRET ?? env.WORKSPACE_ACCESS_SECRET ?? ''

  return {
    plugins: [react()],
    define: {
      __WORKSPACE_ACCESS_SECRET__: JSON.stringify(workspaceAccessSecret),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.js'],
      include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
  }
})
