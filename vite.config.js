import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the production build working on both the
  // GitHub project URL and the custom aspect.am domain.
  base: './',
})
