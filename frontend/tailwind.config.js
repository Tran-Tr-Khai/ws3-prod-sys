import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = frontendDir.replaceAll('\\', '/');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    `${contentRoot}/index.html`,
    `${contentRoot}/src/**/*.{ts,tsx}`,
  ],
  theme: {
    extend: {
      colors: {
        navy: '#eef3f7',
        panel: '#ffffff',
        line: '#b8c7d6',
        industrial: '#164f86',
        industrialDark: '#103c67',
        surfaceMuted: '#e8eef4',
        success: '#2ca24c',
        warning: '#e1a500',
        alarm: '#c73535',
        info: '#2d79b8',
      },
    },
  },
  plugins: [],
};
