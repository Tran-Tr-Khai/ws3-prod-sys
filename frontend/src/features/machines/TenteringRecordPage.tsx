import { useEffect, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { TENTERING_MACHINES, TenteringMachineSelect, TenteringNavigation } from './TenteringNavigation';
import { getTenteringOrder, getTenteringOrderSource, saveTenteringOrder, type TenteringOrder, type TenteringOrderInput } from './tenteringApi';
import { getMachineOrderProgress, saveMachineOrderProgress } from './scouringApi';

type RollDraft = {
  rollNumber: number;
  savedEntryId?: number;
  rollId: string;
  tenterDate: string;
  weavingDate: string;
  plannedQuantity: string;
  actualQuantity: string;
  note: string;
};

type HeaderDraft = {
  operatorName: string;
  operatorIdentifier: string;
  shift: string;
  customer: string;
  itemDescription: string;
  warpYarn: string;
  weftYarn: string;
  greigeDensityPick: string;
  finishDensityPick: string;
  shrinkPercent: string;
  greigeWidthInch: string;
  finishWidthInch: string;
};

const emptyHeader: HeaderDraft = {
  operatorName: '', operatorIdentifier: '', shift: '',
  customer: '', itemDescription: '', warpYarn: '', weftYarn: '', greigeDensityPick: '',
  finishDensityPick: '', shrinkPercent: '', greigeWidthInch: '', finishWidthInch: '',
};
const emptyRolls = (count = 0): RollDraft[] => Array.from({ length: count }, (_, index) => ({
  rollNumber: index + 1, rollId: '', tenterDate: '', weavingDate: '', plannedQuantity: '', actualQuantity: '', note: '',
}));
const numeric = (value: string) => value.trim() ? Number(value) : null;
const displayDate = (value: string, language: string) => {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB');
};
const toCentimeters = (value: string) => {
  const inches = numeric(value);
  return inches === null || !Number.isFinite(inches) ? '—' : (inches * 2.54).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
};

function headerFromOrder(order: TenteringOrder): HeaderDraft {
  return {
    operatorName: order.operator_name ?? '', operatorIdentifier: order.operator_identifier ?? '', shift: order.shift ?? '',
    customer: order.customer ?? '', itemDescription: order.item_description ?? '', warpYarn: order.warp_yarn ?? '',
    weftYarn: order.weft_yarn ?? '', greigeDensityPick: order.greige_density_pick?.toString() ?? '',
    finishDensityPick: order.finish_density_pick?.toString() ?? '', shrinkPercent: order.shrink_percent?.toString() ?? '',
    greigeWidthInch: order.greige_width_inch?.toString() ?? '', finishWidthInch: order.finish_width_inch?.toString() ?? '',
  };
}

function rollsFromOrder(order: TenteringOrder): RollDraft[] {
  const lastSavedRoll = Math.max(0, ...order.entries.map((entry) => entry.roll_number));
  const result = emptyRolls(lastSavedRoll);
  for (const entry of order.entries) {
    result[entry.roll_number - 1] = {
      rollNumber: entry.roll_number, savedEntryId: entry.id, rollId: entry.roll_id ?? '', tenterDate: entry.tenter_date ?? '', weavingDate: entry.weaving_date ?? '',
      plannedQuantity: entry.planned_quantity?.toString() ?? '', actualQuantity: entry.actual_quantity?.toString() ?? '',
      note: entry.note ?? '',
    };
  }
  return result;
}

function applySourceRolls(rolls: RollDraft[], source: Awaited<ReturnType<typeof getTenteringOrderSource>>): RollDraft[] {
  if (!source) return rolls;
  const rollCount = Math.max(rolls.length, source.total_rolls, ...source.rolls.map((roll) => roll.roll_number));
  const expanded = rollCount > rolls.length ? [...rolls, ...emptyRolls(rollCount).slice(rolls.length)] : rolls;
  return source.rolls.reduce((current, sourceRoll) => {
    if (sourceRoll.roll_number < 1 || sourceRoll.roll_number > current.length) return current;
    return current.map((row) => row.rollNumber === sourceRoll.roll_number ? {
      ...row,
      rollId: sourceRoll.roll_id ?? row.rollId,
      weavingDate: sourceRoll.weaving_date ?? row.weavingDate,
    } : row);
  }, expanded);
}

function inputFromDraft(header: HeaderDraft, rolls: RollDraft[], orderProgress: 'IN_PROGRESS' | 'COMPLETED'): TenteringOrderInput {
  const entries: TenteringOrderInput['entries'] = rolls.filter((row) =>
    row.rollId || row.tenterDate || row.weavingDate || row.plannedQuantity || row.actualQuantity || row.note.trim(),
  ).map((row) => ({
    roll_number: row.rollNumber, roll_id: row.rollId || null, tenter_date: row.tenterDate || null, weaving_date: row.weavingDate || null,
    planned_quantity: numeric(row.plannedQuantity), actual_quantity: numeric(row.actualQuantity), note: row.note.trim() || null,
  }));
  return {
    operator_name: header.operatorName.trim() || null, operator_identifier: header.operatorIdentifier.trim() || null, shift: header.shift || null,
    order_progress: orderProgress,
    customer: header.customer.trim() || null, item_description: header.itemDescription.trim() || null,
    warp_yarn: header.warpYarn.trim() || null, weft_yarn: header.weftYarn.trim() || null,
    greige_density_pick: numeric(header.greigeDensityPick), finish_density_pick: numeric(header.finishDensityPick),
    shrink_percent: numeric(header.shrinkPercent), greige_width_inch: numeric(header.greigeWidthInch),
    finish_width_inch: numeric(header.finishWidthInch), fabric_received_date: null, entries,
  };
}

export function TenteringRecordPage({ machineId: routeMachineId = 'TE-01' }: { machineId?: string }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const vi = language === 'vi';
  const machineId = TENTERING_MACHINES.some((machine) => machine.id === routeMachineId.toUpperCase()) ? routeMachineId.toUpperCase() : 'TE-01';
  const [sopInput, setSopInput] = useState('');
  const [activeSop, setActiveSop] = useState('');
  const [header, setHeader] = useState<HeaderDraft>(emptyHeader);
  const [rolls, setRolls] = useState<RollDraft[]>(emptyRolls);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [newOrder, setNewOrder] = useState(false);
  const [knownOrder, setKnownOrder] = useState(false);
  const [orderProgress, setOrderProgress] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const isOperator = user?.role === 'OPERATOR';
  const tx = (vietnamese: string, english: string) => vi ? vietnamese : english;

  useEffect(() => {
    const normalized = sopInput.trim().toUpperCase();
    if (!normalized || normalized === activeSop) return;
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const result = await getTenteringOrder(machineId, normalized);
        const [sourceResult, progressResult] = await Promise.allSettled([
          getTenteringOrderSource(machineId, normalized),
          getMachineOrderProgress(machineId as 'TE-01' | 'TE-02', normalized),
        ]);
        if (!result && sourceResult.status === 'rejected') throw sourceResult.reason;
        const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
        if (!active) return;
        setActiveSop(normalized);
        setNewOrder(!result);
        setKnownOrder(Boolean(result || source));
        setHeader(result ? headerFromOrder(result) : { ...emptyHeader, customer: source?.customer ?? '', itemDescription: source?.item_description ?? '' });
        setRolls(applySourceRolls(result ? rollsFromOrder(result) : emptyRolls(), source));
        setOrderProgress(progressResult.status === 'fulfilled' ? progressResult.value?.orderProgress ?? result?.order_progress ?? 'IN_PROGRESS' : result?.order_progress ?? 'IN_PROGRESS');
        setProgressError('');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (vi ? 'Không tải được dữ liệu Tentering.' : 'Unable to load Tentering data.'));
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [sopInput, activeSop, machineId, vi]);

  const changeOrderProgress = async (nextProgress: 'IN_PROGRESS' | 'COMPLETED') => {
    if (!activeSop || !knownOrder || progressSaving || loading) return;
    const previousProgress = orderProgress;
    setOrderProgress(nextProgress);
    setProgressSaving(true);
    setProgressError('');
    try {
      await saveMachineOrderProgress(machineId as 'TE-01' | 'TE-02', activeSop, nextProgress);
    } catch (reason) {
      setOrderProgress(previousProgress);
      setProgressError(reason instanceof Error ? reason.message : tx('Không lưu được tiến độ đơn.', 'Unable to save order progress.'));
    } finally {
      setProgressSaving(false);
    }
  };

  const save = async () => {
    if (!activeSop || saving) return;
    if (!header.operatorName.trim() || !header.operatorIdentifier.trim() || !header.shift) { setError(tx('Nhập người vận hành, ID nhân viên và ca làm trước khi lưu.', 'Enter the operator, employee ID, and shift before saving.')); return; }
    const clearedSavedRoll = rolls.find((row) => row.savedEntryId && !row.rollId && !row.tenterDate && !row.weavingDate && !row.plannedQuantity && !row.actualQuantity && !row.note.trim());
    if (clearedSavedRoll) { setError(tx(`Cuộn ${clearedSavedRoll.rollNumber} đã có dữ liệu. Không thể xóa trắng dòng; hãy khôi phục hoặc ghi chú điều chỉnh.`, `Roll ${clearedSavedRoll.rollNumber} already has data. Restore it or add a correction note; blanking a saved row does not delete it.`)); return; }
    const invalidHeader = [header.greigeDensityPick, header.finishDensityPick, header.shrinkPercent, header.greigeWidthInch, header.finishWidthInch]
      .find((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0));
    if (invalidHeader !== undefined) { setError(tx('Thông tin mật độ, co rút hoặc khổ vải phải là số không âm.', 'Density, shrinkage, and width must be non-negative numbers.')); return; }
    const invalidRow = rolls.find((row) => (row.tenterDate || row.weavingDate || row.plannedQuantity || row.actualQuantity || row.note.trim())
      && [row.plannedQuantity, row.actualQuantity].some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)));
    if (invalidRow) { setError(tx(`Số mét ở cuộn ${invalidRow.rollNumber} không hợp lệ.`, `Invalid meter value on roll ${invalidRow.rollNumber}.`)); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await saveTenteringOrder(machineId, activeSop, inputFromDraft(header, rolls, orderProgress));
      const savedRolls = rollsFromOrder(result);
      setHeader(headerFromOrder(result));
      setRolls((current) => current.map((row) => {
        const savedRow = savedRolls[row.rollNumber - 1];
        return savedRow?.savedEntryId ? { ...row, ...savedRow } : row;
      }));
      setSopInput(result.sop_no); setActiveSop(result.sop_no);
      setNewOrder(false); setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tx('Không lưu được dữ liệu Tentering.', 'Unable to save Tentering data.'));
    } finally { setSaving(false); }
  };

  const fieldClass = 'min-h-9 min-w-0 w-full border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark outline-none focus:border-industrial';
  const metadataField = (key: keyof HeaderDraft, label: string, type: 'text' | 'number' | 'date' = 'text', unit?: string) => <label key={key} className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
    {label}{unit ? <span className="flex min-w-0 border-2 border-line"><input type={type} step="any" value={header[key]} onChange={(event) => setHeader((current) => ({ ...current, [key]: event.target.value }))} className="min-h-8 min-w-0 flex-1 px-2 text-xs font-semibold text-industrialDark outline-none" /><span className="flex shrink-0 items-center border-l-2 border-line bg-hmiSection px-2 text-[9px]">{unit}</span></span>
      : <input type={type} step={type === 'number' ? 'any' : undefined} value={header[key]} onChange={(event) => setHeader((current) => ({ ...current, [key]: event.target.value }))} className={fieldClass} />}
  </label>;

  return <WS3Shell title={tx('WS3 / ĐỊNH HÌNH', 'WS3 / TENTERING')} subtitle={tx('Phiếu ghi sản lượng theo cuộn · nhập theo mã SOP', 'Per-roll production record · enter by SOP')} machineId={machineId} machineLabel="Tentering" status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={!isOperator}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <TenteringNavigation machineId={machineId} showMachineSelector={false} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 lg:flex-row lg:overflow-hidden">
        <aside className="flex min-h-0 min-w-0 flex-col border-2 border-industrialDark bg-white lg:w-[320px] lg:shrink-0">
          <header className="flex min-h-10 items-center border-b-2 border-industrialDark bg-industrialDark px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white">{tx('THÔNG TIN VẬN HÀNH', 'OPERATION INFORMATION')}</header>
          <div className="grid content-start">
            <OperationInfoFields beforeFields={<TenteringMachineSelect machineId={machineId} visibleLabel />} orderNumber={sopInput} onOrderNumberChange={(value) => { setSopInput(value.toUpperCase()); setActiveSop(''); setKnownOrder(false); setHeader({ ...emptyHeader }); setRolls(emptyRolls()); setNewOrder(false); setSaved(false); setLoading(false); setOrderProgress('IN_PROGRESS'); setProgressError(''); setError(''); }} operatorName={header.operatorName} onOperatorNameChange={(operatorName) => setHeader((current) => ({ ...current, operatorName }))} employeeId={header.operatorIdentifier} onEmployeeIdChange={(operatorIdentifier) => setHeader((current) => ({ ...current, operatorIdentifier }))} shift={header.shift} onShiftChange={(shift) => setHeader((current) => ({ ...current, shift }))} orderStatus={<label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark disabled:bg-hmiSection disabled:text-slate-400" value={orderProgress} disabled={!knownOrder || loading || progressSaving} onChange={(event) => void changeOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}><option value="IN_PROGRESS">{vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option><option value="COMPLETED">{vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option></select>{loading && <span className="text-[9px] normal-case text-info">{vi ? 'Đang tra đơn…' : 'Looking up order…'}</span>}{progressSaving && <span className="text-[9px] normal-case text-info">{vi ? 'Đang lưu…' : 'Saving…'}</span>}{progressError && <span role="alert" className="text-[9px] normal-case text-alarm">{progressError}</span>}</label>} />
            {error && <p role="alert" className="border border-alarm bg-hmiAlarm p-2 text-[10px] font-bold text-alarm">{error}</p>}
            {saved && <p role="status" className="border border-success bg-hmiNormal p-2 text-[10px] font-bold text-success">{tx('ĐÃ LƯU PHIẾU TENTERING', 'TENTERING SHEET SAVED')}</p>}
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto border-2 border-industrialDark bg-white">
          <header className="sticky top-0 z-10 flex min-h-10 flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-white">
            <h1 className="text-xs font-bold uppercase tracking-wider">{tx('THÔNG SỐ VẬN HÀNH', 'OPERATION PARAMETERS')}</h1>
          </header>
          <div className="grid gap-3 p-3">
            {!activeSop ? <div className="border border-info bg-sky-50 p-4 text-xs text-info">{tx('Nhập mã SOP để mở dữ liệu đã có hoặc bắt đầu phiếu mới.', 'Enter an SOP to open an existing record or start a new sheet.')}</div> : <>
              {newOrder && <div className="border border-warning bg-hmiWarning p-2 text-[10px] font-semibold text-warning">{tx('Chưa có phiếu đã lưu cho SOP này. Hãy nhập thông tin đơn và dữ liệu từng cuộn.', 'No sheet is saved for this SOP. Enter the order information and per-roll details.')}</div>}
              <section className="border border-line">
                <header className="border-b border-line bg-hmiSection px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-industrialDark">{tx('THÔNG TIN ĐƠN', 'ORDER INFORMATION')}</header>
                <div className="grid gap-3 p-3 xl:grid-cols-3">
                  <section className="min-w-0">
                    <h2 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{tx('ĐƠN HÀNG', 'ORDER')}</h2>
                    <div className="grid gap-x-3 gap-y-2">
                      {metadataField('customer', tx('Khách hàng', 'Customer'))}
                      {metadataField('itemDescription', tx('Loại mặt hàng', 'Item'))}
                      {metadataField('warpYarn', tx('Sợi dọc', 'Warp yarn'))}
                      {metadataField('weftYarn', tx('Sợi ngang', 'Weft yarn'))}
                    </div>
                  </section>
                  <section className="min-w-0">
                    <h2 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{tx('MẬT ĐỘ', 'DENSITY')}</h2>
                    <div className="grid gap-x-3 gap-y-2">
                      {metadataField('greigeDensityPick', tx('Mật độ mộc', 'Greige density'), 'number', 'pick')}
                      {metadataField('finishDensityPick', tx('Mật độ thành phẩm', 'Finish density'), 'number', 'pick')}
                      {metadataField('shrinkPercent', tx('Co rút', 'Shrinkage'), 'number', '%')}
                    </div>
                  </section>
                  <section className="min-w-0">
                    <h2 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{tx('KHỔ RỘNG', 'WIDTH')}</h2>
                    <div className="grid gap-x-3 gap-y-2">
                      <label className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{tx('Khổ mộc', 'Greige width')}<span className="flex min-w-0 items-center border-2 border-line bg-white"><input type="number" step="any" value={header.greigeWidthInch} onChange={(event) => setHeader((current) => ({ ...current, greigeWidthInch: event.target.value }))} className="min-h-8 min-w-0 flex-1 px-2 text-xs font-semibold outline-none" /><span className="border-l-2 border-line bg-hmiSection px-2 text-[9px]">in</span><span className="px-2 text-[10px] text-slate-500">{toCentimeters(header.greigeWidthInch)} cm</span></span></label>
                      <label className="grid min-w-0 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{tx('Khổ thành phẩm', 'Finish width')}<span className="flex min-w-0 items-center border-2 border-line bg-white"><input type="number" step="any" value={header.finishWidthInch} onChange={(event) => setHeader((current) => ({ ...current, finishWidthInch: event.target.value }))} className="min-h-8 min-w-0 flex-1 px-2 text-xs font-semibold outline-none" /><span className="border-l-2 border-line bg-hmiSection px-2 text-[9px]">in</span><span className="px-2 text-[10px] text-slate-500">{toCentimeters(header.finishWidthInch)} cm</span></span></label>
                    </div>
                  </section>
                </div>
              </section>
              {rolls.length === 0 ? <p className="border border-info bg-sky-50 p-3 text-xs text-info">{tx('Chưa tìm thấy cuộn của SOP này trong dữ liệu MES.', 'No rolls were found for this SOP in the MES data.')}</p> : <section className="min-w-0 border border-line">
                <div className="overflow-x-auto"><table className="w-full min-w-[1000px] border-collapse text-left text-[10px]"><thead className="bg-hmiSection text-[9px] uppercase tracking-wide text-industrialDark"><tr>{[tx('STT / CUỘN', 'NO. / ROLL'), tx('NGÀY DỆT', 'WEAVING DATE'), tx('MÃ ROLL', 'ROLL ID'), tx('SẢN LƯỢNG THEO ĐƠN', 'PLANNED QUANTITY'), tx('SẢN LƯỢNG THỰC TẾ', 'ACTUAL QUANTITY'), tx('GHI CHÚ', 'NOTE')].map((label) => <th key={label} className="border-r border-b border-line px-2 py-2">{label}</th>)}</tr></thead>
                  <tbody>{rolls.map((row, index) => <tr key={row.rollNumber} className="border-b border-line odd:bg-white even:bg-slate-50"><td className="w-16 px-2 py-1.5 text-center font-mono font-bold">{row.rollNumber}</td>
                    <td aria-label={`${tx('Ngày dệt cuộn', 'Weaving date roll')} ${row.rollNumber}`} className="whitespace-nowrap px-2 py-1 text-[10px]">{displayDate(row.weavingDate, language)}</td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-[10px]">{row.rollId || '—'}</td>
                    <td className="px-1 py-1"><input aria-label={`${tx('Sản lượng theo đơn cuộn', 'Planned quantity roll')} ${row.rollNumber}`} type="number" min="0" step="any" inputMode="decimal" value={row.plannedQuantity} onChange={(event) => setRolls((current) => current.map((item, i) => i === index ? { ...item, plannedQuantity: event.target.value } : item))} className="min-h-8 w-full border border-line bg-white px-2 text-right font-mono text-xs" /></td>
                    <td className="px-1 py-1"><input aria-label={`${tx('Sản lượng thực tế cuộn', 'Actual quantity roll')} ${row.rollNumber}`} type="number" min="0" step="any" inputMode="decimal" value={row.actualQuantity} onChange={(event) => setRolls((current) => current.map((item, i) => i === index ? { ...item, actualQuantity: event.target.value } : item))} className="min-h-8 w-full border border-line bg-white px-2 text-right font-mono text-xs" /></td>
                    <td className="px-1 py-1"><input aria-label={`${tx('Ghi chú cuộn', 'Roll note')} ${row.rollNumber}`} value={row.note} onChange={(event) => setRolls((current) => current.map((item, i) => i === index ? { ...item, note: event.target.value } : item))} className="min-h-8 w-full border border-line bg-white px-2 text-xs" maxLength={1000} /></td></tr>)}</tbody></table></div>
              </section>}
              <div className="flex justify-end"><HMIButton variant="primary" size="large" disabled={saving || loading} onClick={() => void save()}>{saving ? tx('ĐANG LƯU…', 'SAVING…') : tx('LƯU PHIẾU', 'SAVE SHEET')}</HMIButton></div>
            </>}
          </div>
        </main>
      </div>
      {isOperator && <div className="shrink-0 border-t border-line"><SupportChatWidget embedded /></div>}
    </div>
  </WS3Shell>;
}
