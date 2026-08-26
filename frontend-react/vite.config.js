import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Custom plugin to inject the Apple Pay text/plain header
    {
      name: 'apple-pay-header',
      // Applies when running 'npm run dev'
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/.well-known/apple-developer-merchantid-domain-association') {
            res.setHeader('Content-Type', 'text/plain');
          }
          next();
        });
      },
      // Applies when running 'vite preview'
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/.well-known/apple-developer-merchantid-domain-association') {
            res.setHeader('Content-Type', 'text/plain');
          }
          next();
        });
      }
    }
  ],
  // Whitelists your domain for 'npm run dev' to prevent 403 Forbidden errors
  server: {
    allowedHosts: [
      'streetcode101.com',
      'www.streetcode101.com'
    ]
  },
  // Whitelists your domain for 'vite preview' to prevent 403 Forbidden errors
  preview: {
    allowedHosts: [
      'streetcode101.com',
      'www.streetcode101.com'
    ]
  }
})
