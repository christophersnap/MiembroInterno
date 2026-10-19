import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // En producción (Hostinger / dist build) usamos la ruta base oficial /miembros/
  // En modo desarrollo (command === 'serve') usamos '/' para compatibilidad con el servidor dev
  const base = process.env.VITE_BASE_PATH || (command === 'build' ? '/miembros/' : '/');

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
