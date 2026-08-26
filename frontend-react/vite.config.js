import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Custom plugin to force the Content-Type header for Apple Pay
    {
      name: 'apple-pay-header',
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
  // Whitelist your live domain so Vite doesn't block it
  preview: {
    allowedHosts: ['streetcode101.com']
  }
})
