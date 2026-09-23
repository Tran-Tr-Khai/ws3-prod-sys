import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { createBuffingCheck, getBuffingChecks, uploadBuffingImages, type BuffingCheck, type BuffingImage } from './scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureVietnamesePdfFonts } from '../../utils/pdfFonts';

const currentTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const toCheckRow = (row: BuffingCheck) => ({ id: row.id, time: new Date(row.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), operator: row.operatorName ?? '', checks: row.checks, remark: row.remark ?? '', images: row.images });
type CheckRow = ReturnType<typeof toCheckRow>;

export function BuffingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [operator, setOperator] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [remark, setRemark] = useState('');
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [gallery, setGallery] = useState<{ images: BuffingImage[]; index: number } | null>(null);

  useEffect(() => {
    if (!gallery) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGallery(null);
      if (event.key === 'ArrowLeft') setGallery((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current);
      if (event.key === 'ArrowRight') setGallery((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current);
      if (event.key === 'Home') setGallery((current) => current ? { ...current, index: 0 } : current);
      if (event.key === 'End') setGallery((current) => current ? { ...current, index: current.images.length - 1 } : current);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gallery]);

  const loadRows = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError(null);
    try { setRows((await getBuffingChecks(selectedDate)).map(toCheckRow)); }
    catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : 'Unable to load Buffing history.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadRows(date); }, [date, loadRows]);

  const toggleCheck = (index: number) => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));

  const addCheck = async () => {
    if (!operator.trim()) { setError('Operator is required before confirming a check.'); return; }
    if (!checks.some(Boolean) || saving) return;
    if (!checks.every(Boolean) && imageFiles.length === 0) { setError(t('buffingImageRequired')); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await createBuffingCheck({ checkDate: date, operatorName: operator.trim(), checks, remark: remark.trim() || null });
      const images = imageFiles.length > 0 ? await uploadBuffingImages(saved.id, imageFiles) : [];
      setRows((current) => [toCheckRow({ ...saved, images }), ...current]);
      setChecks([false, false, false, false, false]);
      setRemark('');
      setImageFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save Buffing check.');
    } finally { setSaving(false); }
  };

  const chooseImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 10) { setError(t('buffingImageLimit')); return; }
    const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) { setError(t('buffingImageFormat')); return; }
    setError(null);
    setImageFiles(files);
  };

  const removeImages = () => setImageFiles([]);

  const exportPdf = async () => {
    if (loading || rows.length === 0) return;

    const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    await ensureVietnamesePdfFonts(document);
    autoTable(document, {
      startY: 12,
      head: [[t('time'), t('operator'), '1', '2', '3', '4', '5', t('remark')]],
      body: rows.map((row) => [
        row.time,
        row.operator || '—',
        ...row.checks.map((checked) => checked ? '✓' : '✕'),
        row.remark || '—',
      ]),
      theme: 'grid',
      styles: { font: 'Arial', fontSize: 9, cellPadding: 3, textColor: [36, 59, 74], lineColor: [196, 208, 214], lineWidth: 0.2 },
      headStyles: { font: 'Arial', fillColor: [71, 98, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 248, 250] },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 38 }, 2: { halign: 'center', cellWidth: 15 }, 3: { halign: 'center', cellWidth: 15 }, 4: { halign: 'center', cellWidth: 15 }, 5: { halign: 'center', cellWidth: 15 }, 6: { halign: 'center', cellWidth: 15 } },
    });
    document.save(`buffing-history-${date}.pdf`);
  };

  return (
    <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title={`WS3 / ${t('buffingDailyCheck')}`} subtitle={`${t('periodicChecklist')} · Buffing`} machineId="BU-01" machineLabel="Buffing" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="buffing-page-shell flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="BU-01" machineLabel="Buffing" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('home')}</HMIButton>} />
        <div className="buffing-page-content min-h-0 flex-1 p-2">
          <div className="buffing-card mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
            <header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><h1 className="text-sm font-bold uppercase tracking-wider">CHECKLIST</h1><div className="text-[9px] uppercase tracking-[0.18em] text-slate-300">BU-01 / BUFFING</div></header>

            <div className="buffing-meta buffing-no-print shrink-0 flex items-end justify-between gap-4 bg-white p-3">
              <label className="grid w-[240px] shrink-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('operator')}<input className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold" value={operator} onChange={(event) => setOperator(event.target.value)} placeholder={t('enterOperator')} /></label>
              <label className="grid shrink-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('recordedTime')}<input aria-label={t('recordedTime')} type="date" className="h-8 w-[145px] border-2 border-line bg-white px-2 text-[11px] font-semibold text-industrialDark" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            </div>

            {error && <div className="buffing-no-print shrink-0 border-b border-alarm bg-white px-3 py-2 text-[10px] font-semibold text-alarm">{error}</div>}

            <section className="buffing-no-print shrink-0 border-b-2 border-white bg-white p-3">
              <div className="grid items-stretch gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
                <div className="box-border flex h-24 min-h-24 flex-col"><div className="mb-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('currentCheck')} · {currentTime()}</div><div className="grid min-h-0 flex-1 grid-cols-5 gap-1">{checks.map((checked, index) => <button key={index} type="button" className={`min-h-0 border-2 text-sm font-bold ${checked ? 'border-success bg-success text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => toggleCheck(index)}>{index + 1}<span className="block text-[8px]">{checked ? t('ok') : t('check')}</span></button>)}</div></div>
                <label className="box-border flex h-24 min-h-24 flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600"><span className="block h-4 shrink-0 leading-4">{t('remark')}</span><textarea className="box-border min-h-0 flex-1 resize-none border-2 border-line bg-white px-2 py-2 text-xs font-semibold" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={t('note')} /></label>
                <div className="box-border flex h-24 min-h-24 flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <span className="block h-4 shrink-0 leading-4">{t('buffingImages')}</span>
                  <div className="flex min-h-0 flex-1 items-center gap-2 border-2 border-line bg-white px-2">
                    <label className="inline-flex min-h-8 cursor-pointer items-center border-2 border-industrialDark bg-industrial px-3 text-[10px] font-bold text-white hover:bg-industrialDark"><span>{t('chooseImages')}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={chooseImages} /></label>
                    <span className="text-[10px] font-semibold text-industrialDark">{imageFiles.length > 0 ? `${imageFiles.length} ${t('imageCount')}` : t('noImages')}</span>
                    {imageFiles.length > 0 && <button type="button" className="ml-auto text-[9px] font-bold text-alarm" onClick={removeImages}>{t('removeImages')}</button>}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 bg-white">
                <div className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('checkInterval')}: <span className="ml-1 font-mono text-industrialDark">15 min</span></div>
                <div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void addCheck()} disabled={saving || loading || !operator.trim() || !checks.some(Boolean)}>{saving ? t('saving') : t('confirmCheck')}</HMIButton></div>
              </div>
            </section>

            <section className="buffing-history flex min-h-0 flex-1 flex-col bg-white">
              <div className="flex shrink-0 items-center justify-between border-b border-line bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white"><span>{t('history')}</span><HMIButton size="compact" className="buffing-no-print !min-h-6 !px-2 !py-1 !text-[9px]" onClick={exportPdf} disabled={loading || rows.length === 0}>{t('overview')} PDF</HMIButton></div>
              <div className="buffing-history-scroll min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[980px] border-collapse text-left text-[10px]"><thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark"><tr><th className="px-3 py-2">{t('time')}</th><th className="px-3 py-2">{t('operator')}</th>{[1, 2, 3, 4, 5].map((point) => <th key={point} className="px-3 py-2 text-center">{point}</th>)}<th className="px-3 py-2">{t('remark')}</th><th className="px-3 py-2">{t('buffingImages')}</th></tr></thead><tbody>{loading ? <tr><td colSpan={9} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('loadingHistory')}</td></tr> : rows.length === 0 ? <tr><td colSpan={9} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('noChecksToday')}</td></tr> : rows.map((row) => <tr key={row.id} className="border-b border-line"><td className="px-3 py-2 font-mono font-bold text-industrial">{row.time}</td><td className="px-3 py-2 font-semibold text-industrialDark">{row.operator || '—'}</td>{row.checks.map((checked, index) => <td key={index} className={`px-3 py-2 text-center text-lg font-bold ${checked ? 'text-success' : 'text-alarm'}`}>{checked ? '✓' : '×'}</td>)}<td className="px-3 py-2 text-slate-600">{row.remark || '—'}</td><td className="px-3 py-2">{row.images.length > 0 ? <button type="button" className="flex items-center gap-2 text-industrial underline" onClick={() => setGallery({ images: row.images, index: row.images.findIndex((image) => image.isPrimary) >= 0 ? row.images.findIndex((image) => image.isPrimary) : 0 })}><img src={row.images.find((image) => image.isPrimary)?.url ?? row.images[0].url} alt={t('primaryImage')} className="h-10 w-14 object-cover" /><span>{row.images.length} {t('imageCount')}</span></button> : <span className="text-slate-400">—</span>}</td></tr>)}</tbody></table></div>
            </section>
          </div>
        </div>
      </div>
      {gallery && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-10 sm:p-14" role="dialog" aria-modal="true" aria-label={t('buffingImages')} onClick={() => setGallery(null)}><div className="relative flex max-h-full max-w-full flex-col items-center gap-4" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={t('closeGallery')} className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center bg-industrial text-lg text-white shadow-lg" onClick={() => setGallery(null)}>×</button><img src={gallery.images[gallery.index].url} alt={`${t('buffingImages')} ${gallery.index + 1}`} className="block max-h-[72vh] max-w-[min(1200px,calc(100vw-8rem))] object-contain shadow-2xl" /><div className="flex w-full items-center justify-between gap-3 text-white"><button type="button" aria-label={t('previousImage')} className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40" disabled={gallery.index === 0} onClick={() => setGallery((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}>‹</button><span className="text-xs font-bold">{gallery.index + 1} / {gallery.images.length}</span><button type="button" aria-label={t('nextImage')} className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40" disabled={gallery.index === gallery.images.length - 1} onClick={() => setGallery((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current)}>›</button></div></div></div>}
    </WS3Shell>
  );
}
