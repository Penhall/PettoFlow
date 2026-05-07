import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function includesSegment(id, segment) {
  return id.includes(segment) || id.includes(segment.replaceAll('/', '\\'))
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (includesSegment(id, '/node_modules/react/') || includesSegment(id, '/node_modules/react-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('framer-motion')) return 'motion-vendor'
          if (id.includes('@fullcalendar')) return 'calendar-vendor'
          if (id.includes('@supabase/supabase-js')) return 'supabase-vendor'
          if (id.includes('@tiptap')) return 'editor-vendor'
          if (id.includes('@dnd-kit')) return 'dnd-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
