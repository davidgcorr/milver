import { releaseVersion } from './scripts/releases/version.mjs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { browserDocsPlugin } from './scripts/browser-docs.ts';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ define:{__MILVER_VERSION__:JSON.stringify(releaseVersion().version)}, plugins: [react(), tailwindcss(), browserDocsPlugin()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } });
