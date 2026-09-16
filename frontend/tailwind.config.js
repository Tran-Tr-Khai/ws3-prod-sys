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
        navy: '#d9dfe3',
        panel: '#f7f8f8',
        line: '#8998a2',
        industrial: '#4b6475',
        industrialDark: '#394e5d',
        surfaceMuted: '#dfe5e8',
        success: '#2f7d52',
        warning: '#a46b00',
        alarm: '#b03535',
        info: '#54788a',
      },
    },
  },
  plugins: [],
};
