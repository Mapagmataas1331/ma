import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = resolve(__dirname, 'src', 'pages')
const i = 'index.html'

// https://vitejs.dev/config/
export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        404: resolve(root, '404.html'),
        main: resolve(root, i),
        about: resolve(root, 'about', i),
        account: resolve(root, 'account', i),
        signup: resolve(root, 'account', 'signup', i),
        signin: resolve(root, 'account', 'signin', i),
      },
    },
  },
  publicDir: resolve(__dirname, 'public'),
})
