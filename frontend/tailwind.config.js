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
        hmiConsole: '#c7d0d4',
        hmiRail: '#aebbc2',
        hmiSection: '#d3dce0',
        hmiInstrument: '#eef2f3',
        hmiInput: '#fffdf2',
        hmiNormal: '#e8f1ec',
        hmiWarning: '#fff7df',
        hmiAlarm: '#f8e7e7',
        hmiSelected: '#dfeaf0',
        hmiHover: '#e7edf0',
        hmiSoftKey: '#e7ecee',
        hmiDisabled: '#e1e6e8',
      },
    },
  },
  plugins: [],
};
