import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Configuração do app: React + Tailwind + PWA (instalável no celular)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // atualiza sozinho quando sair versão nova
      includeAssets: ['icone-192.png', 'icone-512.png'],
      manifest: {
        name: 'Controle de Máquinas',
        short_name: 'Máquinas',
        description: 'Leituras de máquinas e divisão de resultado por ponto',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        start_url: '/',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Guarda as telas do app no aparelho para abrir mesmo sem internet
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,png,svg}'] },
    }),
  ],
});
