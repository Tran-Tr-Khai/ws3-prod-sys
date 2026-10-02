import { useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { replaceWS3Snapshot } from './ws3OrderApi';
import { WS3SupervisorNav } from './WS3SupervisorNav';

type SourceKey = 'plan' | 'order' | 'machine' | 'worker';
const sources: Record<SourceKey, { vi: string; en: string; sourceVi: string; sourceEn: string }> = {
  plan: { vi: 'Kế hoạch sản xuất', en: 'Production plan', sourceVi: 'Nguồn kế hoạch', sourceEn: 'Planning source' },
  order: { vi: 'Đơn sản xuất WS3', en: 'WS3 production orders', sourceVi: 'Nguồn đơn hàng', sourceEn: 'Order source' },
  machine: { vi: 'Roll từ máy dệt', en: 'Weaving machine rolls', sourceVi: 'Nguồn roll thực tế', sourceEn: 'Actual roll source' },
  worker: { vi: 'Ca và người vận hành', en: 'Shifts and workers', sourceVi: 'Nguồn ca làm việc', sourceEn: 'Work-shift source' },
};

export function WS3DataSnapshotHmiPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [files, setFiles] = useState<Partial<Record<SourceKey, File>>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const ready = Object.values(files).some(Boolean);

  const upload = async () => {
    if (!ready) return;
    setLoading(true); setMessage('');
    try {
      const result = await replaceWS3Snapshot(files);
      const names: Record<SourceKey, [string, string]> = { plan: ['Kế hoạch', 'Plan'], order: ['Đơn WS3', 'WS3 orders'], machine: ['Roll máy dệt', 'Machine rolls'], worker: ['Ca/công nhân', 'Shifts/workers'] };
      const counts: Record<SourceKey, keyof typeof result.updated> = { plan: 'plans', order: 'orders', machine: 'machines', worker: 'workers' };
      const updated = (Object.keys(files) as SourceKey[]).map((key) => `${names[key][language === 'vi' ? 0 : 1]}: ${result.updated[counts[key]]?.toLocaleString() ?? 0}`).join(' · ');
      setMessage(tx(`Đã cập nhật ${updated}. Các nguồn chưa chọn được giữ nguyên.`, `Updated ${updated}. Sources not selected were kept unchanged.`));
    } catch (error) { setMessage(error instanceof Error ? error.message : tx('Không thể cập nhật dữ liệu.', 'Unable to update the data.')); }
    finally { setLoading(false); }
  };

  if (!user || !['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role)) return <WS3Shell title="WS3 / DATA INTAKE"><div className="p-6 text-sm font-semibold">{tx('Chỉ Supervisor, Production Manager hoặc Admin được nạp dữ liệu.', 'Only Supervisors, Production Managers or Admins can load data.')}</div></WS3Shell>;
  return <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} navigation={<WS3SupervisorNav />} title={tx('WS3 / NẠP DỮ LIỆU', 'WS3 / DATA INTAKE')} subtitle={tx('Cập nhật dữ liệu sản xuất từ các báo cáo Excel', 'Update production data from Excel reports')} status="info" time={new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB')}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <section className="border border-line bg-white">
            <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-3 py-1 text-white"><h1 className="text-[11px] font-bold uppercase tracking-[0.14em]">{tx('Cập nhật dữ liệu sản xuất', 'Production data update')}</h1><span className="text-[9px] uppercase tracking-wider text-slate-300">4 {tx('nguồn', 'sources')}</span></header>
            <div className="border-b border-line bg-white px-3 py-3 text-[10px] text-slate-600">{tx('Chọn một hoặc nhiều báo cáo Excel để cập nhật. Chỉ nguồn đã chọn được thay bằng snapshot mới; các nguồn còn lại được giữ nguyên.', 'Select one or more Excel reports to update. Only selected sources are replaced; all other current snapshots are kept unchanged.')}</div>
            <div className="grid gap-2 p-2 md:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(sources) as SourceKey[]).map((key) => { const label = sources[key]; return <label key={key} className={`flex min-h-32 cursor-pointer flex-col border-2 bg-white p-3 transition-colors ${files[key] ? 'border-success bg-hmiNormal' : 'border-line hover:border-industrial'}`}>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-industrialDark">{language === 'vi' ? label.vi : label.en}</span><span className="mt-1 text-[9px] uppercase tracking-wide text-slate-400">{language === 'vi' ? label.sourceVi : label.sourceEn}</span>
                <input type="file" accept=".xls,.xlsx" className="mt-auto text-[10px]" onChange={(event) => { const file = event.target.files?.[0]; if (file) setFiles((current) => ({ ...current, [key]: file })); }} />
                <span className="mt-2 truncate border-t border-line pt-2 text-[10px] font-semibold text-slate-600">{files[key]?.name ?? tx('Chưa chọn file', 'No file selected')}</span>
              </label>; })}
            </div>
          </section>
          {message && <div className={`mt-2 border px-3 py-2 text-[10px] font-bold uppercase ${message.startsWith('Đã') || message.startsWith('Data') || message.startsWith('Updated') ? 'border-success bg-hmiNormal text-success' : 'border-alarm bg-hmiAlarm text-alarm'}`}>{message}</div>}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-hmiConsole p-2"><HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => { setFiles({}); setMessage(''); }} disabled={loading}>{tx('XÓA LỰA CHỌN', 'CLEAR SELECTION')}</HMIButton><HMIButton size="large" variant="primary" onClick={() => void upload()} disabled={!ready || loading}>{loading ? tx('ĐANG KIỂM TRA...', 'VALIDATING...') : tx('CẬP NHẬT DỮ LIỆU', 'UPDATE DATA')}</HMIButton></footer>
      </div>
    </div>
  </WS3Shell>;
}
