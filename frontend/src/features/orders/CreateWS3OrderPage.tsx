import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { confirmWS3Order, createWS3ImportBatch, createWS3Order, parseWS3SourceFile, type ImportedRow, type WS3Order } from './ws3OrderApi';

const orderFields = [
  ['roll_id', 'Roll ID / mã cuộn'], ['item_code', 'Item Code'], ['item_name', 'Item Name / tên vải'],
  ['lot_no', 'Lot No'], ['machine_no', 'Machine / Loom'], ['length_meters', 'Length / mét'],
  ['shift', 'Shift / ca'], ['worker', 'Worker'], ['remarks', 'Remarks / SOP / ghi chú'],
] as const;

const manualMesFields = ['DATE', 'SHIFT', 'CUSTOMER', 'PO #', 'ORDER #', 'ITEM NO', 'FABRIC', 'STYLE #', 'COLOR', 'SOP #', 'LOT #', 'MACHINE', 'QTY UNIT', 'ROLL', 'KGS', 'YDS', 'MTS', 'WORKER'] as const;
const fields = orderFields;
const manualFields = manualMesFields.map((field) => [field, field] as const);

const manualMesLabels: Record<string, [string, string]> = {
  'DATE': ['NGÀY', 'DATE'], 'SHIFT': ['CA', 'SHIFT'], 'CUSTOMER': ['KHÁCH HÀNG', 'CUSTOMER'], 'PO #': ['SỐ PO', 'PO #'],
  'ORDER #': ['SỐ ORDER', 'ORDER #'], 'ITEM NO': ['MÃ HÀNG', 'ITEM NO'], 'FABRIC': ['TÊN VẢI', 'FABRIC'], 'STYLE #': ['STYLE', 'STYLE #'],
  'COLOR': ['MÀU', 'COLOR'], 'SOP #': ['SOP', 'SOP #'], 'LOT #': ['SỐ LOT', 'LOT #'], 'MACHINE': ['MÁY', 'MACHINE'],
  'QTY UNIT': ['ĐƠN VỊ', 'QTY UNIT'], 'ROLL': ['ROLL', 'ROLL'], 'KGS': ['KILOGRAM', 'KGS'], 'YDS': ['YARD', 'YDS'], 'MTS': ['MÉT', 'MTS'], 'WORKER': ['CÔNG NHÂN', 'WORKER'],
};

function fieldLabel(field: string, language: 'vi' | 'en'): string {
  if (manualMesLabels[field]) return manualFieldLabel(field, language);
  const labels = {
    roll_id: ['MÃ CUỘN', 'ROLL ID'], item_code: ['MÃ HÀNG', 'ITEM CODE'], item_name: ['TÊN VẢI', 'FABRIC NAME'],
    lot_no: ['SỐ LOT', 'LOT NO.'], machine_no: ['MÁY DỆT / LOOM', 'MACHINE / LOOM'], length_meters: ['MÉT', 'LENGTH / M'],
    shift: ['CA', 'SHIFT'], worker: ['CÔNG NHÂN', 'WORKER'], remarks: ['SOP / GHI CHÚ', 'SOP / REMARKS'],
  } as Record<string, [string, string]>;
  return labels[field]?.[language === 'vi' ? 0 : 1] ?? field;
}

function manualFieldLabel(field: string, language: 'vi' | 'en'): string {
  return manualMesLabels[field]?.[language === 'vi' ? 0 : 1] ?? field;
}

function parseSource(text: string): { columns: string[]; rows: ImportedRow[] } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { columns: [], rows: [] };
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (line: string) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
  const columns = split(lines[0]).map((column, index) => column || `Column ${index + 1}`);
  const rows = lines.slice(1).map((line) => {
    const values = split(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
  return { columns, rows };
}

function compareTableValues(left: string, right: string): number {
  const a = left.trim();
  const b = right.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const dateValue = (value: string) => {
    const match = value.match(/^(\d{1,2})[\\/-](\d{1,2})[\\/-](\d{2,4})$/);
    if (match) return Date.parse(`${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
    return Date.parse(value);
  };
  const dateA = dateValue(a);
  const dateB = dateValue(b);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  const numberA = Number(a.replace(/,/g, ''));
  const numberB = Number(b.replace(/,/g, ''));
  if (Number.isFinite(numberA) && Number.isFinite(numberB)) return numberA - numberB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function guessMapping(columns: string[]): Record<string, string> {
  const normalized = columns.map((column) => [column, column.toLowerCase()] as const);
  const result: Record<string, string> = {};
  for (const [field, label] of orderFields) {
    const match = normalized.find(([, value]) => {
      if (field === 'roll_id') return value.includes('roll') || value.includes('cuộn') || value.includes('qr');
      if (field === 'item_code') return value.includes('item code') || value.includes('item no') || value === 'item';
      if (field === 'item_name') return value.includes('item name') || value.includes('fabric') || value.includes('tên vải');
      if (field === 'lot_no') return value.includes('lot');
      if (field === 'machine_no') return value.includes('machine') || value.includes('loom') || value.includes('m/c');
      if (field === 'length_meters') return value === 'mts' || value.includes('length') || value.includes('meter') || value === 'met';
      if (field === 'shift') return value.includes('shift') || value.includes('ca');
      if (field === 'worker') return value.includes('worker') || value.includes('operator');
      return value.includes('remark') || value.includes('note') || value.includes('sop') || value.includes('ghi chú');
    });
    if (match) result[field] = match[0];
  }
  return result;
}

function printOrder(order: WS3Order, language: 'vi' | 'en') {
  const printText = language === 'vi'
    ? { title: 'PHIẾU ĐƠN SẢN XUẤT WS3', order: 'Đơn', source: 'Nguồn', total: 'Tổng số cuộn', roll: 'Mã cuộn', machine: 'Máy', length: 'Mét', shift: 'Ca', status: 'Trạng thái' }
    : { title: 'WS3 PRODUCTION ORDER', order: 'Order', source: 'Source', total: 'Total rolls', roll: 'Roll ID', machine: 'Machine', length: 'Length (m)', shift: 'Shift', status: 'Status' };
  const rows = order.rolls.map((roll, index) => `<tr><td>${index + 1}</td><td>${roll.roll_id || '—'}</td><td>${roll.machine_no || '—'}</td><td>${roll.length_meters ?? '—'}</td><td>${roll.shift || '—'}</td><td>${roll.status}</td></tr>`).join('');
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(`<html><head><title>${order.order_no}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#203746}h1{font-size:22px;margin:0 0 8px}p{margin:4px 0}table{border-collapse:collapse;width:100%;margin-top:22px}th,td{border:1px solid #8799a3;padding:7px;text-align:left;font-size:12px}th{background:#e8eef1} @media print{button{display:none}}</style></head><body><h1>${printText.title}</h1><p><b>${printText.order}:</b> ${order.order_no}</p><p><b>${printText.source}:</b> ${order.source_filename || order.source_format}</p><p><b>${printText.total}:</b> ${order.rolls.length}</p><table><thead><tr><th>No.</th><th>${printText.roll}</th><th>${printText.machine}</th><th>${printText.length}</th><th>${printText.shift}</th><th>${printText.status}</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

export function CreateWS3OrderPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceText, setSourceText] = useState('');
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState('PASTE');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<WS3Order | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<'reading' | 'saving' | 'confirming' | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<'import' | 'order'>('import');
  const [importBatchId, setImportBatchId] = useState<number | null>(null);
  const [manualRow, setManualRow] = useState<Record<string, string>>({});
  const [rowFilter, setRowFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [rowView, setRowView] = useState<'all' | 'new' | 'duplicate' | 'incomplete'>('all');
  const [importStats, setImportStats] = useState<{ duplicate: number; newRows: number; incomplete: number } | null>(null);
  const [duplicateIndexes, setDuplicateIndexes] = useState<Set<number>>(new Set());
  const [incompleteIndexes, setIncompleteIndexes] = useState<Set<number>>(new Set());
  const pageSize = 50;

  const loadParsed = (parsed: { columns: string[]; rows: ImportedRow[] }, format = 'PASTE', filename: string | null = null, text = '', notice = '', selectedIndexes?: number[], stats?: { duplicate: number; newRows: number; incomplete: number }, duplicateRows?: number[], incompleteRows?: number[]) => {
    setSourceText(text); setSourceFormat(format); setSourceFilename(filename);
    setColumns(parsed.columns); setRows(parsed.rows); setMapping(guessMapping(parsed.columns)); setSelected(new Set(selectedIndexes ?? parsed.rows.map((_, index) => index))); setMessage(notice); setImportStats(stats ?? null); setDuplicateIndexes(new Set(duplicateRows ?? [])); setIncompleteIndexes(new Set(incompleteRows ?? [])); setImportBatchId(null); setOrder(null);
  };
  const loadText = (text: string, format = 'PASTE', filename: string | null = null) => {
    loadParsed(parseSource(text), format, filename, text);
  };
  const startManual = () => { setSourceText(''); setSourceFormat('MANUAL'); setSourceFilename(null); setColumns([...manualMesFields]); setMapping({ roll_id: 'ROLL', item_code: 'ITEM NO', item_name: 'FABRIC', lot_no: 'LOT #', machine_no: 'MACHINE', length_meters: 'MTS', shift: 'SHIFT', worker: 'WORKER', remarks: 'SOP #' }); setRows([]); setSelected(new Set()); setManualRow({}); setMessage(''); setImportStats(null); setDuplicateIndexes(new Set()); setIncompleteIndexes(new Set()); setImportBatchId(null); setOrder(null); setManualOpen(true); };
  const addManualRow = () => { const index = rows.length; setRows((current) => [...current, Object.fromEntries(manualMesFields.map((field) => [field, manualRow[field] || '']))]); setSelected((current) => new Set([...current, index])); setManualRow({}); };

  const selectedRows = useMemo(() => rows.filter((_, index) => selected.has(index)), [rows, selected]);
  const totalMeters = useMemo(() => selectedRows.reduce((sum, row) => {
    const value = mapping.length_meters ? row[mapping.length_meters] : '';
    return sum + (Number(String(value).replace(/,/g, '')) || 0);
  }, 0), [mapping.length_meters, selectedRows]);
  const filteredRows = useMemo(() => {
    const result = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => {
      const matchesSearch = !rowFilter.trim() || Object.values(row).some((value) => value.toLowerCase().includes(rowFilter.trim().toLowerCase()));
      const matchesView = rowView === 'all' || (rowView === 'duplicate' && duplicateIndexes.has(index)) || (rowView === 'incomplete' && incompleteIndexes.has(index)) || (rowView === 'new' && !duplicateIndexes.has(index) && !incompleteIndexes.has(index));
      return matchesSearch && matchesView;
    });
    if (!sortConfig) return result;
    return [...result].sort((left, right) => {
      const compared = compareTableValues(left.row[sortConfig.column] || '', right.row[sortConfig.column] || '');
      return sortConfig.direction === 'asc' ? compared : -compared;
    });
  }, [rowFilter, rows, sortConfig, rowView, duplicateIndexes, incompleteIndexes]);
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    if (!mapping.roll_id) messages.push(tx('Chưa chọn cột Mã cuộn.', 'Roll ID column has not been selected.'));
    if (!mapping.length_meters) messages.push(tx('Chưa chọn cột MTS, tổng sản lượng sẽ bằng 0.', 'MTS column has not been selected, so total meters will be 0.'));
    return messages;
  }, [mapping.length_meters, mapping.roll_id, selectedRows]);

  const saveOrder = async () => {
    if (!columns.length || !rows.length || (workflowMode === 'order' && !selectedRows.length)) { setMessage(workflowMode === 'import' ? tx('Hãy nhập dữ liệu trước khi lưu.', 'Enter data before saving.') : tx('Hãy chọn ít nhất một dòng để tạo đơn.', 'Select at least one row to create an order.')); return; }
    setSaving(true); setProcessing('saving'); setMessage('');
    try {
      if (workflowMode === 'import') {
        const batch = await createWS3ImportBatch({ source_filename: sourceFilename, source_format: sourceFormat, columns, rows, mapping, selected_row_indexes: rows.map((_, index) => index) });
        setImportBatchId(batch.id);
        setMessage(`${tx('Đã lưu dữ liệu MES.', 'MES data saved.')} ${tx('Batch', 'Batch')} #${batch.id} · ${tx('Dòng sẵn sàng', 'Available rows')}: ${batch.available_count} · ${tx('Dòng trùng', 'Duplicates')}: ${batch.duplicate_count} · ${tx('Thiếu key', 'Incomplete key')}: ${batch.incomplete_key_count}`);
      } else {
        const created = await createWS3Order({ source_filename: sourceFilename, source_format: sourceFormat, columns, rows, mapping, selected_row_indexes: [...selected], import_batch_id: importBatchId });
        setOrder(created);
        setMessage(`${tx('Đã lưu đơn nháp.', 'Draft order saved.')} ${tx('Dòng mới', 'New rows')}: ${created.new_count} · ${tx('Dòng trùng', 'Duplicates')}: ${created.duplicate_count} · ${tx('Thiếu key', 'Incomplete key')}: ${created.incomplete_key_count}`);
      }
    }
    catch (error) { setMessage(error instanceof Error ? error.message : tx('Không thể lưu đơn.', 'Unable to save the order.')); }
    finally { setSaving(false); setProcessing(null); }
  };

  const confirmOrder = async () => { if (!order) return; setSaving(true); setProcessing('confirming'); try { setOrder(await confirmWS3Order(order.id)); setMessage(tx('Đã chốt đơn. Công nhân có thể xem đơn để gom vải.', 'Order confirmed. Workers can now view it for roll collection.')); } catch (error) { setMessage(error instanceof Error ? error.message : tx('Không thể chốt đơn.', 'Unable to confirm the order.')); } finally { setSaving(false); setProcessing(null); } };

  const processingText = processing === 'reading'
    ? tx('ĐANG ĐỌC VÀ KIỂM TRA FILE MES...', 'READING AND CHECKING MES FILE...')
    : processing === 'saving'
      ? tx('ĐANG KIỂM TRA TRÙNG VÀ LƯU ĐƠN...', 'CHECKING DUPLICATES AND SAVING ORDER...')
      : tx('ĐANG CHỐT ĐƠN...', 'CONFIRMING ORDER...');

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) return <WS3Shell title="WS3 / Orders" subtitle={tx('Yêu cầu quyền Supervisor', 'Supervisor access required')}><div className="p-6 text-sm font-semibold">{tx('Chỉ Supervisor hoặc Admin có thể tạo đơn.', 'Only Supervisors or Admins can create orders.')}</div></WS3Shell>;
  return <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title="WS3 / Create Order" subtitle={tx('Nhập dữ liệu MES linh hoạt', 'Flexible MES data entry')} status="info" time={new Date().toLocaleTimeString('vi-VN')}>
    <nav aria-label="Supervisor navigation" className="flex min-h-10 items-center justify-between border-b-2 border-industrialDark bg-hmiSection px-2 py-1"><div className="flex items-center gap-2"><div className="border-r border-line pr-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-industrialDark">SUPERVISOR</div><div className="flex gap-1"><HMIButton size="compact" variant={workflowMode === 'import' ? 'primary' : undefined} onClick={() => setWorkflowMode('import')}>{tx('NHẬP DỮ LIỆU', 'IMPORT DATA')}</HMIButton><HMIButton size="compact" variant={workflowMode === 'order' ? 'primary' : undefined} onClick={() => setWorkflowMode('order')}>{tx('TẠO ĐƠN', 'CREATE ORDER')}</HMIButton></div></div><HMIButton size="compact" onClick={() => navigate('/ws3')}>{tx('TRANG CHỦ', 'HOME')}</HMIButton></nav>
    <div className={`h-full min-h-0 overflow-y-auto overflow-x-hidden ${workflowMode === 'import' ? 'px-3 pb-3 pt-2 md:px-5 md:pb-5 md:pt-3' : 'p-3 md:p-5'}`}><div className="relative w-full space-y-3" aria-busy={Boolean(processing)}>
      {processing && <div className="absolute inset-0 z-50 flex items-start justify-center bg-slate-900/35 px-4 pt-28 backdrop-blur-[1px]" role="status" aria-live="polite"><div className="flex min-w-[260px] items-center gap-3 border-2 border-industrialDark bg-white px-5 py-4 shadow-xl"><span className="h-6 w-6 animate-spin rounded-full border-4 border-slate-300 border-t-industrialDark" aria-hidden="true" /><div><div className="text-xs font-bold uppercase tracking-[0.08em] text-industrialDark">{processingText}</div><div className="mt-1 text-[10px] text-slate-500">{tx('Vui lòng chờ, không bấm lại hoặc đóng trang.', 'Please wait. Do not click again or close this page.')}</div></div></div></div>}
      <section className={workflowMode === 'import' ? 'p-0' : 'border-2 border-industrialDark bg-white p-3'}><div className="flex flex-wrap items-center justify-between gap-2">{workflowMode === 'order' && <div><h1 className="text-sm font-bold uppercase tracking-[0.12em] text-industrialDark">{tx('TẠO ĐƠN TỪ DỮ LIỆU ĐÃ NHẬP', 'CREATE ORDER FROM IMPORTED DATA')}</h1><p className="mt-1 text-xs text-slate-500">{tx('Chọn các dòng dữ liệu đã nhập để gom thành đơn sản xuất.', 'Select imported rows to group into a production order.')}</p></div>}<div className="flex gap-2"><input ref={fileRef} type="file" accept=".xls,.xlsx,.csv,.tsv,.txt" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setProcessing('reading'); try { const parsed = await parseWS3SourceFile(file); parsed.rows && parsed.columns ? loadParsed({ columns: parsed.columns, rows: parsed.rows }, parsed.format, parsed.filename, '', language === 'vi' ? (parsed.normalization_message || tx('Đã đọc và chuẩn hóa file MES.', 'MES file read and normalized.')) : (parsed.normalization_message_en || tx('Đã đọc và chuẩn hóa file MES.', 'MES file read and normalized.')), parsed.new_row_indexes, { duplicate: parsed.duplicate_count || 0, newRows: parsed.new_count || 0, incomplete: parsed.incomplete_key_count || 0 }, parsed.duplicate_row_indexes, parsed.incomplete_key_indexes) : loadText(parsed.text || '', parsed.format, parsed.filename); } catch (error) { setMessage(error instanceof Error ? error.message : tx('Không đọc được file.', 'Unable to read the file.')); } finally { setProcessing(null); event.target.value = ''; } }} /><HMIButton size="compact" disabled={Boolean(processing) || Boolean(order)} onClick={() => fileRef.current?.click()}>{tx('TẢI FILE MES', 'UPLOAD MES FILE')}</HMIButton><HMIButton size="compact" disabled={Boolean(processing) || Boolean(order)} onClick={startManual}>{tx('NHẬP THỦ CÔNG', 'MANUAL ENTRY')}</HMIButton></div></div>{message && !rows.length && <div className="mt-3 border-l-4 border-success bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-900">{message}</div>}{workflowMode === 'order' && sourceFormat !== 'MANUAL' && <textarea value={sourceText} onChange={(event) => loadText(event.target.value)} placeholder={tx('Bạn có thể copy một vùng từ Excel/MES rồi dán vào đây. Hàng đầu tiên là tên cột; các cột còn lại vẫn được giữ nguyên.', 'Copy a range from Excel/MES and paste it here. The first row should contain column names; all other columns are preserved.')} className="mt-3 min-h-28 w-full border-2 border-line p-2 font-mono text-xs outline-none focus:border-industrialDark" />}</section>
      {workflowMode === 'order' && columns.length > 0 && <section className="border-2 border-line bg-white p-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-industrialDark">{tx('CHỌN CỘT SỬ DỤNG CHO ĐƠN', 'SELECT ORDER FIELDS')}</h2><p className="mt-1 text-xs text-slate-500">{tx('Các cột không chọn vẫn được lưu trong dữ liệu gốc.', 'Unselected columns remain in the original source data.')}</p></div><div className="grid grid-cols-2 gap-2 text-right text-[10px] font-bold uppercase tracking-wide"><span className="border border-line bg-hmiSection px-3 py-2"><b className="block text-base text-industrialDark">{selectedRows.length.toLocaleString('vi-VN')}</b>{tx('cuộn đã chọn', 'selected rolls')}</span><span className="border border-line bg-hmiSection px-3 py-2"><b className="block text-base text-industrialDark">{totalMeters.toLocaleString('vi-VN')}</b>{tx('m dự kiến', 'planned m')}</span></div></div>{importStats && <div className="mt-3 grid gap-2 text-[10px] font-bold uppercase tracking-wide sm:grid-cols-3"><div className="border border-success/40 bg-emerald-50 px-3 py-2 text-emerald-900">{tx('DÒNG MỚI', 'NEW ROWS')}: {importStats.newRows.toLocaleString('vi-VN')}</div><div className="border border-warning/40 bg-amber-50 px-3 py-2 text-amber-900">{tx('DÒNG TRÙNG', 'DUPLICATES')}: {importStats.duplicate.toLocaleString('vi-VN')}</div><div className="border border-line bg-slate-50 px-3 py-2 text-slate-700">{tx('THIẾU KEY', 'INCOMPLETE KEY')}: {importStats.incomplete.toLocaleString('vi-VN')}</div></div>}<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field]) => <label key={field} className="text-[11px] font-bold uppercase text-slate-600">{fieldLabel(field, language)}<select value={mapping[field] || ''} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 min-h-9 w-full border border-line bg-white px-2 text-xs font-normal text-slate-800"><option value="">{tx('Không chọn', 'Not selected')}</option>{columns.map((column, columnIndex) => <option key={`${column}-${columnIndex}`} value={column}>{column || tx('Cột chưa đặt tên', 'Unnamed column')}</option>)}</select></label>)}</div>{validationMessages.length > 0 && <div className="mt-3 border-l-4 border-warning bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900">{validationMessages.map((item) => <div key={item}>{tx('CẢNH BÁO', 'WARNING')} · {item}</div>)}</div>}</section>}
      {workflowMode === 'import' && importStats && <section className="grid gap-2 sm:grid-cols-3"><article className="border-2 border-success bg-white"><div className="flex items-center justify-between border-b border-success/50 bg-emerald-50 px-3 py-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-900">{tx('DỮ LIỆU HỢP LỆ', 'VALID DATA')}</span><span className="h-2 w-2 bg-success" aria-hidden="true" /></div><div className="flex items-end justify-between px-3 py-2.5"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{tx('Dòng mới', 'New rows')}</span><b className="font-mono text-xl leading-none text-emerald-800">{importStats.newRows.toLocaleString('vi-VN')}</b></div></article><article className="border-2 border-warning bg-white"><div className="flex items-center justify-between border-b border-warning/50 bg-amber-50 px-3 py-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-900">{tx('CẦN KIỂM TRA', 'REVIEW REQUIRED')}</span><span className="h-2 w-2 bg-warning" aria-hidden="true" /></div><div className="flex items-end justify-between px-3 py-2.5"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{tx('Dòng trùng', 'Duplicates')}</span><b className="font-mono text-xl leading-none text-amber-800">{importStats.duplicate.toLocaleString('vi-VN')}</b></div></article><article className="border-2 border-industrialDark bg-white"><div className="flex items-center justify-between border-b border-line bg-hmiSection px-3 py-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.1em] text-industrialDark">{tx('CẦN BỔ SUNG', 'INCOMPLETE')}</span><span className="h-2 w-2 bg-industrialDark" aria-hidden="true" /></div><div className="flex items-end justify-between px-3 py-2.5"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{tx('Thiếu key', 'Missing key')}</span><b className="font-mono text-xl leading-none text-industrialDark">{importStats.incomplete.toLocaleString('vi-VN')}</b></div></article></section>}
      {rows.length > 0 && <section className="border-2 border-line bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-industrialDark">{workflowMode === 'import' ? tx('DỮ LIỆU MES ĐÃ NHẬP', 'IMPORTED MES DATA') : tx('CHỌN DỮ LIỆU ĐƯA VÀO ĐƠN', 'SELECT DATA FOR ORDER')}</h2><p className="mt-1 text-[10px] text-slate-500">{tx('Đang hiển thị', 'Showing')} {filteredRows.length.toLocaleString('vi-VN')} / {rows.length.toLocaleString('vi-VN')} {tx('dòng', 'rows')}</p></div><div className="flex items-center gap-2"><input value={rowFilter} onChange={(event) => { setRowFilter(event.target.value); setPage(1); }} placeholder={tx('Tìm item, lot, order...', 'Search item, lot, order...')} className="min-h-8 w-52 border border-line px-2 text-xs outline-none focus:border-industrialDark" /><div className="flex gap-1">{(['all', 'new', 'duplicate', 'incomplete'] as const).map((view) => <button key={view} type="button" className={`border px-2 py-1 text-[10px] font-bold uppercase ${rowView === view ? 'border-industrialDark bg-industrialDark text-white' : 'border-line text-industrial'}`} onClick={() => { setRowView(view); setPage(1); }}>{view === 'all' ? tx('TẤT CẢ', 'ALL') : view === 'new' ? tx('DÒNG MỚI', 'NEW') : view === 'duplicate' ? tx('DÒNG TRÙNG', 'DUPLICATES') : tx('THIẾU KEY', 'INCOMPLETE')}</button>)}</div>{workflowMode === 'order' && <button type="button" className="text-[11px] font-bold uppercase text-industrial" onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((_, index) => index)))}>{selected.size === rows.length ? tx('Bỏ chọn tất cả', 'DESELECT ALL') : tx('Chọn tất cả', 'SELECT ALL')}</button>}</div></div><div className="mt-2 min-h-[420px] max-h-[calc(100vh-20rem)] overflow-auto border border-line"><table className="min-w-max border-collapse text-left text-[11px]"><thead className="sticky top-0 z-10 bg-hmiSection"><tr>{workflowMode === 'order' && <th className="sticky left-0 z-20 w-8 bg-hmiSection p-2"></th>}{columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`} className="whitespace-nowrap p-0 font-bold"><button type="button" className="flex w-full items-center gap-1 whitespace-nowrap px-2 py-2 text-left hover:bg-slate-200" title={tx('Sắp xếp cột', 'Sort column')} onClick={() => setSortConfig((current) => current?.column === column ? (current.direction === 'asc' ? { column, direction: 'desc' } : null) : { column, direction: 'asc' })}>{column || tx('Cột chưa đặt tên', 'Unnamed column')}<span className="text-[10px] text-slate-500">{sortConfig?.column === column ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>)}</tr></thead><tbody>{visibleRows.map(({ row, index }) => <tr key={index} className="border-t border-line">{workflowMode === 'order' && <td className="sticky left-0 bg-white p-2"><input type="checkbox" checked={selected.has(index)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(index) ? next.delete(index) : next.add(index); return next; })} /></td>}{columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`} className="whitespace-nowrap px-3 py-2">{row[column] || '—'}</td>)}</tr>)}</tbody></table></div><div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">{workflowMode === 'order' ? <span>{tx('Đã chọn', 'Selected')}: {selectedRows.length.toLocaleString('vi-VN')} {tx('dòng', 'rows')}</span> : <span>{tx('Dữ liệu đang hiển thị', 'Rows shown')}: {filteredRows.length.toLocaleString('vi-VN')}</span>}<div className="flex gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="border border-line px-2 py-1 disabled:opacity-40">‹</button><span className="px-2 py-1">{tx('Trang', 'Page')} {page}/{pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="border border-line px-2 py-1 disabled:opacity-40">›</button></div></div></section>}
      <section className="flex flex-wrap items-center justify-between gap-2 border-2 border-industrialDark bg-hmiSection p-3"><div className="text-xs font-semibold text-slate-600">{message || tx('Kiểm tra dữ liệu trước khi lưu đơn.', 'Review the data before saving the order.')}</div><div className="flex gap-2"><HMIButton size="compact" disabled={saving || Boolean(order)} onClick={saveOrder}>{saving ? tx('ĐANG LƯU...', 'SAVING...') : workflowMode === 'import' ? tx('LƯU DỮ LIỆU', 'SAVE DATA') : tx('LƯU ĐƠN NHÁP', 'SAVE DRAFT')}</HMIButton>{order && <><HMIButton size="compact" onClick={() => printOrder(order, language)}>{tx('IN PHIẾU ĐƠN', 'PRINT ORDER')}</HMIButton><HMIButton size="compact" variant="primary" disabled={saving || order.status === 'CONFIRMED'} onClick={confirmOrder}>{order.status === 'CONFIRMED' ? tx('ĐÃ CHỐT ĐƠN', 'ORDER CONFIRMED') : tx('CHỐT ĐƠN', 'CONFIRM ORDER')}</HMIButton></>}</div></section>
      {manualOpen && <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 pt-16 backdrop-blur-[1px]"><div className="w-full max-w-5xl border-2 border-industrialDark bg-white p-4 shadow-2xl"><div className="flex items-center justify-between border-b border-line pb-3"><div><h2 className="text-sm font-bold uppercase tracking-[0.12em] text-industrialDark">{tx('NHẬP DÒNG THỦ CÔNG', 'MANUAL ROW ENTRY')}</h2><p className="mt-1 text-xs text-slate-500">{tx('Nhập thông tin một cuộn rồi bấm thêm dòng. Bạn có thể thêm nhiều dòng liên tiếp.', 'Enter one roll and add it. You can add multiple rows one after another.')}</p></div><button type="button" className="border border-line px-3 py-1 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100" onClick={() => setManualOpen(false)}>{tx('ĐÓNG', 'CLOSE')}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{manualFields.map(([field]) => <label key={field} className="text-[11px] font-bold uppercase text-slate-600">{fieldLabel(field, language)}<input autoFocus={field === 'DATE'} value={manualRow[field] || ''} onChange={(event) => setManualRow((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 min-h-9 w-full border border-line px-2 text-xs font-normal outline-none focus:border-industrialDark" /></label>)}</div><div className="mt-4 flex justify-end gap-2 border-t border-line pt-3"><HMIButton size="compact" onClick={() => setManualOpen(false)}>{tx('ĐÓNG FORM', 'CLOSE FORM')}</HMIButton><HMIButton size="compact" disabled={Boolean(processing) || Boolean(order)} onClick={addManualRow}>{tx('THÊM DÒNG THỦ CÔNG', 'ADD MANUAL ROW')}</HMIButton></div></div></div>}
    </div></div>
  </WS3Shell>;
}
