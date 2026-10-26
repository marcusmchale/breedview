import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import graphql from '@rollup/plugin-graphql'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
  // a build without the API's address would send every request to "undefined/graphql": refuse it (the address goes in
  // .env.<mode>, its .local, or the environment)
  if (command === 'build' && !env.VITE_API_HOST) {
    throw new Error(`No VITE_API_HOST for the ${mode} build: set it in .env.${mode}.local or the environment`)
  }
  return {
    // the path the site is served under, e.g. /demo/ for the demonstration site beside production on its host; the
    // router, the guide's media and its links follow it (import.meta.env.BASE_URL)
    base: env.VITE_BASE_PATH || '/',
    plugins: [
      vue(),
      graphql()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 8080,
      open: true,
      // the guide recorder's frames (thousands a chapter) and the build it records from are no part of the app:
      // watching them ran out of the system's file watchers
      watch: { ignored: ['**/guide/out/**', '**/.guide-dist/**'] }
    },
    build: {
      outDir: 'dist'
    }
  }
})
