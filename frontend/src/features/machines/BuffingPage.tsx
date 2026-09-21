import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { createBuffingCheck, getBuffingChecks, type BuffingCheck } from './scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';

const currentTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const toCheckRow = (row: BuffingCheck) => ({ id: row.id, time: new Date(row.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), operator: row.operatorName ?? '', checks: row.checks, remark: row.remark ?? '' });
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
    setSaving(true);
    setError(null);
    try {
      const saved = await createBuffingCheck({ checkDate: date, operatorName: operator.trim(), checks, remark: remark.trim() || null });
      setRows((current) => [toCheckRow(saved), ...current]);
      setChecks([false, false, false, false, false]);
      setRemark('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save Buffing check.');
    } finally { setSaving(false); }
  };

  return (
    <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title={`WS3 / ${t('buffingDailyCheck')}`} subtitle={`${t('periodicChecklist')} · Buffing`} machineId="BU-01" machineLabel="Buffing" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="BU-01" machineLabel="Buffing" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('home')}</HMIButton>} />
        <div className="min-h-0 flex-1 p-2">
          <div className="mx-auto flex h-full max-w-[1280px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
            <header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><h1 className="text-sm font-bold uppercase tracking-wider">CHECKLIST</h1><div className="text-[9px] uppercase tracking-[0.18em] text-slate-300">BU-01 / BUFFING</div></header>

            <div className="shrink-0 flex items-end justify-between gap-4 bg-white p-3">
              <label className="grid w-[240px] shrink-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('operator')}<input className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold" value={operator} onChange={(event) => setOperator(event.target.value)} placeholder={t('enterOperator')} /></label>
              <label className="grid shrink-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('recordedTime')}<input aria-label={t('recordedTime')} type="date" className="h-8 w-[145px] border-2 border-line bg-white px-2 text-[11px] font-semibold text-industrialDark" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            </div>

            {error && <div className="shrink-0 border-b border-alarm bg-white px-3 py-2 text-[10px] font-semibold text-alarm">{error}</div>}

            <section className="shrink-0 border-b-2 border-white bg-white p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_2fr]">
                <div><div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('currentCheck')} · {currentTime()}</div><div className="grid grid-cols-5 gap-1">{checks.map((checked, index) => <button key={index} type="button" className={`min-h-12 border-2 text-sm font-bold ${checked ? 'border-success bg-success text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => toggleCheck(index)}>{index + 1}<span className="block text-[8px]">{checked ? t('ok') : t('check')}</span></button>)}</div></div>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('remark')}<textarea className="min-h-12 resize-none border-2 border-line bg-white px-2 py-2 text-xs font-semibold" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={t('note')} /></label>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 bg-white">
                <div className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('checkInterval')}: <span className="ml-1 font-mono text-industrialDark">15 min</span></div>
                <div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void addCheck()} disabled={saving || loading || !operator.trim() || !checks.some(Boolean)}>{saving ? t('saving') : t('confirmCheck')}</HMIButton></div>
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col bg-white">
              <div className="shrink-0 border-b border-line bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white">{t('history')}</div>
              <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[860px] border-collapse text-left text-[10px]"><thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark"><tr><th className="px-3 py-2">{t('time')}</th><th className="px-3 py-2">{t('operator')}</th>{[1, 2, 3, 4, 5].map((point) => <th key={point} className="px-3 py-2 text-center">{point}</th>)}<th className="px-3 py-2">{t('remark')}</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('loadingHistory')}</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('noChecksToday')}</td></tr> : rows.map((row) => <tr key={row.id} className="border-b border-line"><td className="px-3 py-2 font-mono font-bold text-industrial">{row.time}</td><td className="px-3 py-2 font-semibold text-industrialDark">{row.operator || '—'}</td>{row.checks.map((checked, index) => <td key={index} className={`px-3 py-2 text-center text-lg font-bold ${checked ? 'text-success' : 'text-alarm'}`}>{checked ? '✓' : '×'}</td>)}<td className="px-3 py-2 text-slate-600">{row.remark || '—'}</td></tr>)}</tbody></table></div>
            </section>
          </div>
        </div>
      </div>
    </WS3Shell>
  );
}
