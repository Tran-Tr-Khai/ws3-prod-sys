import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';

type TenterRow = {
  id: number;
  tenterDate: string;
  orderNumber: string;
  weavingDate: string;
  orderedQuantity: string;
  actualQuantity: string;
  note: string;
};

type TenterForm = {
  cardNumber: string;
  customer: string;
  collectedDate: string;
  item: string;
  greyWarp: string;
  greyWeft: string;
  pickWarp: string;
  pickFinish: string;
  shrinkage: string;
  greyWidthInch: string;
  greyWidthCm: string;
  finishWidthInch: string;
  finishWidthCm: string;
  rows: TenterRow[];
};

const storageKey = 'ws3-tenter-form-draft';
const today = () => new Date().toISOString().slice(0, 10);

function newRow(id: number): TenterRow {
  return { id, tenterDate: '', orderNumber: '', weavingDate: '', orderedQuantity: '', actualQuantity: '', note: '' };
}

const emptyForm: TenterForm = {
  cardNumber: '', customer: '', collectedDate: today(), item: '', greyWarp: '', greyWeft: '', pickWarp: '', pickFinish: '', shrinkage: '',
  greyWidthInch: '', greyWidthCm: '', finishWidthInch: '', finishWidthCm: '', rows: Array.from({ length: 8 }, (_, index) => newRow(index + 1)),
};

export function TenterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<TenterForm>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? emptyForm; } catch { return emptyForm; }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(form)); }, [form]);

  const orderedTotal = useMemo(() => form.rows.reduce((total, row) => total + (Number(row.orderedQuantity) || 0), 0), [form.rows]);
  const actualTotal = useMemo(() => form.rows.reduce((total, row) => total + (Number(row.actualQuantity) || 0), 0), [form.rows]);

  const updateForm = (key: keyof Omit<TenterForm, 'rows'>, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateRow = (id: number, key: keyof Omit<TenterRow, 'id'>, value: string) => setForm((current) => ({ ...current, rows: current.rows.map((row) => row.id === id ? { ...row, [key]: value } : row) }));
  const addRow = () => setForm((current) => ({ ...current, rows: [...current.rows, newRow(Math.max(...current.rows.map((row) => row.id), 0) + 1)] }));
  const removeRow = (id: number) => setForm((current) => ({ ...current, rows: current.rows.length > 1 ? current.rows.filter((row) => row.id !== id) : current.rows }));
  const clearForm = () => { setForm({ ...emptyForm, collectedDate: today() }); setSaved(false); };

  return (
    <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title="WS3 / Tenter" subtitle="Production entry" machineId="TE-01" machineLabel="Tenter" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="TE-01" machineLabel="Tenter" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>Home</HMIButton>} />
        <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col border-2 border-industrialDark bg-white">
          <header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><h1 className="text-sm font-bold uppercase tracking-[0.14em]">TENTER PRODUCTION CARD</h1><span className="font-mono text-[10px] text-slate-300">TE-01</span></header>

          <div className="grid gap-2 border-b-2 border-line p-3 text-[10px] md:grid-cols-4">
            <Field label="Card number" value={form.cardNumber} onChange={(value) => updateForm('cardNumber', value)} />
            <Field label="Customer" value={form.customer} onChange={(value) => updateForm('customer', value)} />
            <Field label="Collected date" type="date" value={form.collectedDate} onChange={(value) => updateForm('collectedDate', value)} />
            <Field label="Item / fabric" value={form.item} onChange={(value) => updateForm('item', value)} />
          </div>

          <section className="grid gap-2 border-b-2 border-line bg-slate-50 p-3 text-[10px] md:grid-cols-4">
            <Field label="Grey warp" value={form.greyWarp} onChange={(value) => updateForm('greyWarp', value)} />
            <Field label="Grey weft" value={form.greyWeft} onChange={(value) => updateForm('greyWeft', value)} />
            <Field label="Pick / grey" value={form.pickWarp} onChange={(value) => updateForm('pickWarp', value)} />
            <Field label="Pick / finish" value={form.pickFinish} onChange={(value) => updateForm('pickFinish', value)} />
            <Field label="Shrinkage %" type="number" value={form.shrinkage} onChange={(value) => updateForm('shrinkage', value)} />
            <Field label="Grey width (inch)" type="number" value={form.greyWidthInch} onChange={(value) => updateForm('greyWidthInch', value)} />
            <Field label="Grey width (cm)" type="number" value={form.greyWidthCm} onChange={(value) => updateForm('greyWidthCm', value)} />
            <Field label="Finish width (inch)" type="number" value={form.finishWidthInch} onChange={(value) => updateForm('finishWidthInch', value)} />
            <Field label="Finish width (cm)" type="number" value={form.finishWidthCm} onChange={(value) => updateForm('finishWidthCm', value)} />
          </section>

          <section className="min-h-0 overflow-auto p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-industrialDark">Production by roll</h2><HMIButton size="compact" onClick={addRow}>+ Add row</HMIButton></div>
            <div className="overflow-x-auto border-2 border-line"><table className="w-full min-w-[980px] border-collapse text-left text-[10px]"><thead className="bg-industrial text-white"><tr><th className="w-10 px-2 py-2 text-center">STT</th><th className="px-2 py-2">Date tenter</th><th className="px-2 py-2">Order number</th><th className="px-2 py-2">Weaving date</th><th className="px-2 py-2">Ordered qty</th><th className="px-2 py-2">Actual qty</th><th className="px-2 py-2">Note</th><th className="w-14 px-2 py-2"></th></tr></thead><tbody>{form.rows.map((row) => <tr key={row.id} className="border-b border-line align-top"><td className="px-2 py-2 text-center font-mono font-bold text-industrial">{row.id}</td><td className="p-1"><input type="date" className="h-8 w-full border border-line px-1" value={row.tenterDate} onChange={(event) => updateRow(row.id, 'tenterDate', event.target.value)} /></td><td className="p-1"><input className="h-8 w-full border border-line px-2" value={row.orderNumber} onChange={(event) => updateRow(row.id, 'orderNumber', event.target.value)} /></td><td className="p-1"><input type="date" className="h-8 w-full border border-line px-1" value={row.weavingDate} onChange={(event) => updateRow(row.id, 'weavingDate', event.target.value)} /></td><td className="p-1"><input type="number" min="0" className="h-8 w-full border border-line px-2" value={row.orderedQuantity} onChange={(event) => updateRow(row.id, 'orderedQuantity', event.target.value)} /></td><td className="p-1"><input type="number" min="0" className="h-8 w-full border border-line px-2" value={row.actualQuantity} onChange={(event) => updateRow(row.id, 'actualQuantity', event.target.value)} /></td><td className="p-1"><input className="h-8 w-full border border-line px-2" value={row.note} onChange={(event) => updateRow(row.id, 'note', event.target.value)} /></td><td className="p-1 text-center"><button type="button" className="px-2 py-2 text-[10px] font-bold text-alarm" onClick={() => removeRow(row.id)} aria-label={`Remove row ${row.id}`}>×</button></td></tr>)}</tbody><tfoot className="bg-slate-50 font-bold"><tr><td colSpan={4} className="px-2 py-2 text-right uppercase">Total</td><td className="px-2 py-2 text-industrial">{orderedTotal.toLocaleString()} m</td><td className="px-2 py-2 text-industrial">{actualTotal.toLocaleString()} m</td><td colSpan={2}></td></tr></tfoot></table></div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line bg-slate-50 p-3"><span className="text-[10px] font-semibold uppercase text-slate-500">Draft is saved in this browser</span><div className="flex gap-2"><HMIButton size="compact" onClick={clearForm}>Clear</HMIButton><HMIButton size="compact" variant="primary" onClick={() => setSaved(true)}>{saved ? 'Saved' : 'Save draft'}</HMIButton></div></footer>
        </div>
      </div>
    </WS3Shell>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="grid gap-1 font-bold uppercase tracking-wide text-slate-600">{label}<input type={type} className="h-8 border-2 border-line bg-white px-2 text-xs font-semibold normal-case text-industrialDark" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
