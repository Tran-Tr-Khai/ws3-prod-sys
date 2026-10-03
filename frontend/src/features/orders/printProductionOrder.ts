import type { WS3ProductionOrderReport } from './ws3OrderApi';

const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function printProductionOrder(order: WS3ProductionOrderReport, language: 'vi' | 'en') {
  const labels = language === 'vi'
    ? ['Ngày sản xuất', 'Mã hàng', 'Tên hàng', 'Số LOT', 'Số máy', 'Chiều dài', 'Ca', 'Công nhân', 'Ghi chú']
    : ['Date production', 'Item Code', 'Item Name', 'Lot no', 'M/C No', 'Length', 'Shift', 'Worker', 'Remarks'];
  const cards = order.rolls.map((roll) => {
    const values = [order.production_date, roll.item_code, roll.item_name, roll.lot_no, roll.machine_no,
      roll.length_meters == null ? '—' : `${roll.length_meters.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB')} Mt`,
      roll.shift, roll.worker, roll.remarks];
    return `<article><header><b>GRS</b><span>${escapeHtml(order.pk_no)}</span></header><table>${values.map((value, index) => `<tr><th>${labels[index]}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><footer>${escapeHtml(roll.roll_id)}</footer></article>`;
  });
  const sheets = Array.from({ length: Math.ceil(cards.length / 6) }, (_, index) => `<section class="sheet">${cards.slice(index * 6, (index + 1) * 6).join('')}</section>`).join('');
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.opener = null;
  popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(order.pk_no)}</title><style>
    @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{font:8px Arial;margin:0}.sheet{width:210mm;height:297mm;padding:8mm;display:grid;grid-template-columns:repeat(2,91mm);grid-template-rows:repeat(3,68mm);justify-content:center;align-content:center;gap:3mm;page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}
    article{width:91mm;height:68mm;min-width:0;min-height:0;border:1px solid #333;overflow:hidden;break-inside:avoid;page-break-inside:avoid}header{display:flex;justify-content:space-between;gap:1mm;padding:1.4mm 1.6mm;font-size:8px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5px;line-height:1.15}th,td{border-top:1px solid #333;padding:1.6mm 1.4mm;text-align:left;overflow-wrap:anywhere}th{width:34%;border-right:1px solid #333;font-weight:normal}td{font-weight:bold}footer{text-align:center;padding:3.2mm 1mm;font-size:8px;font-weight:bold;border-top:1px solid #333}
  </style></head><body>${sheets}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}
