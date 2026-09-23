import type jsPDF from 'jspdf';
import regularFontUrl from '../assets/arial.ttf?url';
import boldFontUrl from '../assets/arialbd.ttf?url';

let fontDataPromise: Promise<[string, string]> | null = null;

async function toBase64(url: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function ensureVietnamesePdfFonts(document: jsPDF): Promise<void> {
  if (!fontDataPromise) fontDataPromise = Promise.all([toBase64(regularFontUrl), toBase64(boldFontUrl)]);
  return fontDataPromise.then(([regular, bold]) => {
    document.addFileToVFS('Arial.ttf', regular);
    document.addFont('Arial.ttf', 'Arial', 'normal');
    document.addFileToVFS('Arial-Bold.ttf', bold);
    document.addFont('Arial-Bold.ttf', 'Arial', 'bold');
    document.setFont('Arial', 'normal');
  });
}
