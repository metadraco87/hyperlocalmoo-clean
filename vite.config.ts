import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, '/api')
            },
            '/auth': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/auth/, '/auth')
            }
        }
    },
    envPrefix: ['VITE_', 'PUBLIC_'],
    ssr: {
        noExternal: ['@googlemaps/js-api-loader'] // Treat as CJS module
    }
});