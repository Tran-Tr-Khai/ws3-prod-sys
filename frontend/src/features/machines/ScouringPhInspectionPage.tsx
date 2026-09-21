import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { createScouringPhInspection, getLatestScouringRecord, type ScouringRecord } from './scouringApi';

const tankNumbers = Array.from({ length: 8 }, (_, index) => index);

export function ScouringPhInspectionPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [operator, setOperator] = useState('');
  const [inspectedAt, setInspectedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [tankValues, setTankValues] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [operationRecord, setOperationRecord] = useState<ScouringRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    void getLatestScouringRecord().then(setOperationRecord).catch((reason) => setSaveError(reason instanceof Error ? reason.message : 'Unable to load the latest Scouring record.')).finally(() => setLoadingRecord(false));
  }, []);

  const saveInspection = async () => {
    if (saving || saveSuccess || !operationRecord) return;
    const tankPh = tankNumbers.map((tank) => tankValues[tank]?.trim() ? Number(tankValues[tank]) : null);
    if (!tankPh.some((value) => value !== null && Number.isFinite(value))) {
      setSaveError('Enter at least one tank pH value before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await createScouringPhInspection({ scouringRecordId: operationRecord.id, inspectedAt: new Date(inspectedAt).toISOString(), operatorName: operator.trim() || null, tankPh, note: note.trim() || null });
      setSaveSuccess(true);
      window.setTimeout(() => navigate('/machine/scouring/history'), 700);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Unable to save the PH inspection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WS3Shell title={`WS3 / ${t('phInspection')}`} subtitle={t('manualInspectionEntry')} machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
        <div className="scouring-screen-frame scouring-full-width-frame scouring-inspection-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <div className="mx-auto grid min-h-full w-full max-w-[1280px] gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="flex h-full flex-col border border-line bg-white">
                <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{t('inspectionContext')}</h2>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-slate-300">SC-01</span>
                </header>
                <div className="grid gap-3 px-3 py-3 text-[10px]">
                  <div><span className="block font-semibold uppercase tracking-[0.12em] text-slate-400">{t('machine')}</span><span className="mt-0.5 block font-mono text-[20px] font-bold text-industrialDark">SC-01</span></div>
                  {operationRecord && <div className="grid gap-1 border-t border-line pt-2 text-[10px]"><span className="font-semibold uppercase tracking-[0.12em] text-slate-400">{t('operationRecord')}</span><span className="font-mono font-bold text-industrialDark">ID {operationRecord.id}</span><span className="text-slate-600">{operationRecord.item || '—'} · {operationRecord.lotNumber || '—'}</span></div>}
                  <label className="grid gap-1"><span className="font-semibold uppercase tracking-[0.12em] text-slate-400">{t('inspectionTime')}</span><input type="datetime-local" value={inspectedAt} onChange={(event) => setInspectedAt(event.target.value)} className="min-h-10 border-2 border-line bg-white px-2 font-mono text-[11px] font-bold text-industrial outline-none focus:border-info" /></label>
                  <label className="grid gap-1"><span className="font-semibold uppercase tracking-[0.12em] text-slate-400">{t('operator')}</span><input type="text" value={operator} onChange={(event) => setOperator(event.target.value)} placeholder={t('enterOperator')} className="min-h-10 border-2 border-line bg-white px-2 text-[13px] font-semibold text-slate-700 outline-none focus:border-info" /></label>
                </div>
              </aside>

              <section className="h-full border border-line bg-white">
                <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white">
                  <h1 className="text-[11px] font-bold uppercase tracking-[0.14em]">{t('phInspection')}</h1>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">8 {t('tanks')}</span>
                </header>
                <div className="p-3">
                  <div className="mb-2 border-b border-line pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('enterCheckedTanks')}</div>
                  {loadingRecord && <div className="mb-2 text-[10px] font-bold uppercase text-slate-500">{t('loadingRecords')}</div>}
                  {saveError && <div className="mb-2 border border-alarm bg-hmiAlarm px-2 py-2 text-[10px] font-bold uppercase text-alarm">{saveError}</div>}
                  {saveSuccess && <div className="mb-2 border border-success bg-hmiNormal px-2 py-2 text-[10px] font-bold uppercase text-success">PH CHECK SAVED · Opening history...</div>}
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {tankNumbers.map((tank) => (
                      <label key={tank} className="grid min-w-0 gap-1 bg-white p-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-industrial">{t('tank')} {tank}</span>
                        <span className="flex min-w-0 h-14 border-2 border-line bg-white">
                          <input type="number" inputMode="decimal" step="any" value={tankValues[tank] ?? ''} onChange={(event) => setTankValues((current) => ({ ...current, [tank]: event.target.value }))} className="min-w-0 flex-1 bg-white px-2 text-center font-mono text-[24px] font-bold text-industrial outline-none focus:ring-2 focus:ring-info/60" aria-label={`Tank ${tank} pH`} />
                          <span className="flex w-12 items-center justify-center border-l-2 border-line bg-surfaceMuted font-mono text-[11px] font-bold text-slate-600">pH</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="mt-4 grid gap-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-industrial">{t('note')}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="resize-none border-2 border-line bg-white p-2 text-[12px] text-slate-700 outline-none focus:border-info" /></label>
                </div>
              </section>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-hmiConsole p-2">
            <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/machine/scouring/record')}>{t('back')}</HMIButton>
            <div className="flex gap-2">
              <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/machine/scouring/record')}>{t('cancel')}</HMIButton>
              <HMIButton size="large" variant="primary" disabled={saving || saveSuccess || loadingRecord || !operationRecord} onClick={saveInspection}>{saving ? t('saving') : t('saveCheck')}</HMIButton>
            </div>
          </div>
        </div>
      </div>
    </WS3Shell>
  );
}
