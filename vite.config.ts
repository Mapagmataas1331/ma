import { resolve } from 'path';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = resolve(__dirname, 'src', 'pages')
const outDir = resolve(__dirname, 'dist')
const i = 'index.html'

// https://vitejs.dev/config/
export default defineConfig({
  root,
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, i),
        about: resolve(root, 'about', i),
        account: resolve(root, 'account', i),
        signup: resolve(root, 'account', 'signup', i),
        signin: resolve(root, 'account', 'signin', i),
      }
    }
  }
})
