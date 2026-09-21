import { Link } from 'react-router-dom';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';

export function ScouringEntrySelectionPage() {
  const { t } = useLanguage();

  return (
    <WS3Shell title={`WS3 / ${t('recordEntry')}`} subtitle={t('entryMenu')} machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-hmiConsole p-3 text-slate-800">
        <section className="mx-auto flex w-full max-w-5xl flex-col border-2 border-industrialDark bg-white">
          <header className="flex min-h-10 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-3 py-2 text-white">
            <h1 className="text-sm font-bold uppercase tracking-[0.14em]">{t('entryMenu')}</h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">SC-01</span>
          </header>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <Link to="/machine/scouring/record/operation" className="flex min-h-36 flex-col border-2 border-line bg-white p-4 text-industrialDark transition-colors hover:border-industrialDark hover:bg-hmiHover">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em]">{t('operationRecord')}</span>
              <span className="mt-3 text-[11px] leading-relaxed text-slate-600">{t('operationRecordDescription')}</span>
              <span className="mt-auto pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-industrial">{t('openForm')} →</span>
            </Link>
            <Link to="/machine/scouring/record/inspection" className="flex min-h-36 flex-col border-2 border-line bg-slate-50 p-4 text-industrialDark transition-colors hover:border-industrialDark hover:bg-hmiHover">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em]">{t('phInspection')}</span>
              <span className="mt-3 text-[11px] leading-relaxed text-slate-600">{t('phInspectionDescription')}</span>
              <span className="mt-auto pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t('openForm')} →</span>
            </Link>
          </div>
        </section>
      </div>
    </WS3Shell>
  );
}
