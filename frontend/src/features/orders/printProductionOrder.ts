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
  }).join('');
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.opener = null;
  popup.document.write(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(order.pk_no)}</title><style>
    @page{size:A4;margin:8mm}body{font:12px Arial;margin:0}.sheet{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
    article{border:1px solid #333;break-inside:avoid;page-break-inside:avoid}header{display:flex;justify-content:space-between;padding:3mm}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-top:1px solid #333;padding:2mm;text-align:left;overflow-wrap:anywhere}th{width:29%;border-right:1px solid #333;font-weight:normal}td{font-weight:bold}footer{text-align:center;padding:6mm 2mm;font-weight:bold;border-top:1px solid #333}
  </style></head><body><div class="sheet">${cards}</div></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}
