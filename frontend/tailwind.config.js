import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const contentRoot = frontendDir.replaceAll('\\', '/');

/** @type {import('tailwindcss').Config} */
export default {
  content: [`${contentRoot}/index.html`, `${contentRoot}/src/**/*.{ts,tsx}`],
  theme: {
    extend: {
      colors: {
        navy: '#c4cdd1',
        panel: '#f7f9f9',
        line: '#9aa8af',
        industrial: '#4b6475',
        industrialDark: '#394e5d',
        surfaceMuted: '#d9e2e6',
        success: '#2f7d52',
        warning: '#a46b00',
        warningSurface: '#fff7df',
        alarm: '#b03535',
        info: '#4b6475',
        workspace: '#ccd6da',
        surfaceHover: '#e7edf0',
      },
    },
  },
  plugins: [],
};
