import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import graphql from '@rollup/plugin-graphql'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  // a build without the API's address would send every request to "undefined/graphql": refuse it (the address goes in
  // .env.<mode>, its .local, or the environment)
  if (command === 'build' && !loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_').VITE_API_HOST) {
    throw new Error(`No VITE_API_HOST for the ${mode} build: set it in .env.${mode}.local or the environment`)
  }
  return {
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
      open: true
    },
    build: {
      outDir: 'dist'
    }
  }
})
