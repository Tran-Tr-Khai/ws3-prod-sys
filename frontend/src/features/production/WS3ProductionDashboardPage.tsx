import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { getBuffingChecks, getScouringRecords, type BuffingCheck, type ScouringRecord } from '../machines/scouringApi';

function displayTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function WS3ProductionDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [scouringRecords, setScouringRecords] = useState<ScouringRecord[]>([]);
  const [buffingChecks, setBuffingChecks] = useState<BuffingCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getScouringRecords(), getBuffingChecks()])
      .then(([records, checks]) => {
        if (!active) return;
        setScouringRecords(records);
        setBuffingChecks(checks);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) return <Navigate to="/ws3" replace />;

  const latestScouring = scouringRecords[0];
  const latestBuffing = buffingChecks[0];
  const checkedBuffingPoints = latestBuffing?.checks.filter(Boolean).length ?? 0;
  const scouringToday = scouringRecords.filter((record) => record.recordedAt.slice(0, 10) === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
  const scouringMetersToday = scouringToday.reduce((total, record) => total + (record.productionQuantityMeters ?? 0), 0);

  return <WS3Shell title="WS3 / Production" subtitle="Tổng quan sản xuất" status="info" showGlobalNavigation={false}>
    <main className="flex h-full min-h-0 flex-col overflow-auto bg-hmiConsole p-2 text-industrialDark">
      <div className="mb-2 flex items-center justify-between gap-2 border-2 border-industrial bg-white px-3 py-2">
        <div><h1 className="font-mono text-xs font-bold uppercase tracking-wider">Tổng quan sản xuất</h1><p className="mt-1 text-[10px] text-slate-500">Các chỉ số hiện có; có thể mở rộng biểu đồ tại khu vực này.</p></div>
        <Link to="/ws3"><HMIButton size="compact">TRANG CHỦ</HMIButton></Link>
      </div>
      {error && <p role="status" className="mb-2 border border-warning bg-white px-3 py-2 text-xs text-warning">Không tải được một số dữ liệu sản xuất.</p>}
      {loading ? <p className="border-2 border-line bg-white p-6 text-center text-xs text-slate-500">{t('loadingRecorded')}</p> : <div className="grid gap-2 md:grid-cols-2">
        <section className="border-2 border-industrial bg-white">
          <header className="flex items-center justify-between bg-industrial px-3 py-2 text-white"><h2 className="font-mono text-[11px] font-bold uppercase">Scouring</h2><span className="text-[9px]">{scouringToday.length} BẢN GHI HÔM NAY</span></header>
          <div className="grid grid-cols-2 gap-px bg-line text-xs">
            <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Sản lượng hôm nay</p><p className="mt-1 font-mono text-xl font-bold text-industrial">{scouringMetersToday.toLocaleString('vi-VN')} m</p></div>
            <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Ghi nhận gần nhất</p><p className="mt-1 font-mono font-bold">{latestScouring ? displayTime(latestScouring.recordedAt) : '—'}</p></div>
            <div className="col-span-2 bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Đơn gần nhất</p><p className="mt-1 font-mono font-bold">{latestScouring?.orderNumber || '—'}</p><p className="mt-1 text-slate-600">{latestScouring?.item || '—'} · {latestScouring?.machineId || '—'}</p></div>
          </div>
        </section>
        <section className="border-2 border-industrial bg-white">
          <header className="flex items-center justify-between bg-industrial px-3 py-2 text-white"><h2 className="font-mono text-[11px] font-bold uppercase">Buffing</h2><span className="text-[9px]">KIỂM TRA GẦN NHẤT</span></header>
          <div className="grid grid-cols-2 gap-px bg-line text-xs">
            <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Điểm đạt</p><p className="mt-1 font-mono text-xl font-bold text-industrial">{latestBuffing ? `${checkedBuffingPoints}/${latestBuffing.checks.length}` : '—'}</p></div>
            <div className="bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Ghi nhận gần nhất</p><p className="mt-1 font-mono font-bold">{latestBuffing ? displayTime(latestBuffing.checkedAt) : '—'}</p></div>
            <div className="col-span-2 bg-white p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Người vận hành · Máy</p><p className="mt-1 font-semibold">{latestBuffing?.operatorName || '—'} · {latestBuffing?.machineId || '—'}</p></div>
          </div>
        </section>
      </div>}
    </main>
  </WS3Shell>;
}
