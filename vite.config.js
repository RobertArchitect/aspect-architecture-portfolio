import { defineConfig } from 'vite'

function redirectPreviewAdminRoute(server) {
  server.middlewares.use((request, response, next) => {
    if (request.url !== '/admin') return next()
    response.writeHead(302, { Location: '/admin/' })
    response.end()
  })
}

export default defineConfig({
  // Relative asset paths keep the production build working on both the
  // GitHub project URL and the custom aspect.am domain.
  base: './',
  plugins: [{
    name: 'preview-admin-route',
    configureServer: redirectPreviewAdminRoute,
    configurePreviewServer: redirectPreviewAdminRoute,
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/@firebase/auth/') || id.includes('/firebase/auth/')) return 'firebase-auth'
          if (id.includes('/@firebase/firestore/') || id.includes('/firebase/firestore/')) return 'firebase-firestore'
          if (id.includes('/@firebase/storage/') || id.includes('/firebase/storage/')) return 'firebase-storage'
          if (id.includes('/@firebase/app/') || id.includes('/firebase/app/')) return 'firebase-core'
          return undefined
        },
      },
    },
  },
})
