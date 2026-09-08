import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-root-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/assets/')) {
            const cleanUrl = req.url.split('?')[0];
            const relativePath = cleanUrl.replace(/^\//, '');
            const rootFilePath = path.resolve(process.cwd(), relativePath);
            if (fs.existsSync(rootFilePath) && fs.statSync(rootFilePath).isFile()) {
              const contentType = cleanUrl.endsWith('.glb')
                ? 'model/gltf-binary'
                : cleanUrl.endsWith('.gltf')
                ? 'model/gltf+json'
                : 'application/octet-stream';

              if (req.method === 'HEAD') {
                res.writeHead(200, {
                  'Content-Type': contentType,
                  'Content-Length': fs.statSync(rootFilePath).size,
                });
                res.end();
                return;
              }

              res.writeHead(200, { 'Content-Type': contentType });
              fs.createReadStream(rootFilePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
      closeBundle() {
        // Ensure root assets are copied into dist/assets for production builds
        const srcDir = path.resolve(process.cwd(), 'assets');
        const destDir = path.resolve(process.cwd(), 'dist/assets');
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, { recursive: true, errorOnExist: false });
        }
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
  },
});

