import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { normalizeShift } from '../../components/hmi/ShiftSelect';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { createScouringPhInspection, createScouringRecord, getScouringRecordsForOrder, getMachineOrderProgress, saveMachineOrderProgress, ScouringApiError, type ScouringRecord } from './scouringApi';
import { getWS3ProductionOrderContext, type WS3ProductionOrderReport } from '../orders/ws3OrderApi';
import { useLanguage } from '../../i18n/LanguageContext';

type RecordFieldKey =
  | 'naoh'
  | 'soap'
  | 'desizer'
  | 'h2o2'
  | 'chelate'
  | 'speed'
  | 'temperature'
  | 'cylinderTemperature'
  | 'inputFabricMeters'
  | 'outputFabricMeters'
  | 'lossMeters';

type RecordValues = Record<RecordFieldKey, string> & {
  orderNumber: string;
  item: string;
  lotYarn: string;
  lotNumber: string;
  operatorName: string;
  operatorIdentifier: string;
  shift: string;
  orderProgress: 'IN_PROGRESS' | 'COMPLETED';
};

type FieldDefinition = {
  key: RecordFieldKey;
  label: string;
  unit: string;
  required?: boolean;
  range?: [number, number];
};

const initialValues: RecordValues = {
  orderNumber: '',
  item: '',
  lotYarn: '',
  lotNumber: '',
  operatorName: '',
  operatorIdentifier: '',
  shift: '',
  orderProgress: 'IN_PROGRESS',
  naoh: '',
  soap: '',
  desizer: '',
  h2o2: '',
  chelate: '',
  speed: '',
  temperature: '',
  cylinderTemperature: '',
  inputFabricMeters: '',
  outputFabricMeters: '',
  lossMeters: '',
};

const chemicalFields: FieldDefinition[] = [
  { key: 'naoh', label: 'NaOH', unit: 'L', required: true },
  { key: 'soap', label: 'Soap', unit: 'L', required: true },
  { key: 'desizer', label: 'Desizer', unit: 'L', required: true },
  { key: 'h2o2', label: 'H2O2', unit: 'L', required: true },
  { key: 'chelate', label: 'Chelate', unit: 'L', required: true },
];

const processFields: FieldDefinition[] = [
  { key: 'speed', label: 'Speed', unit: 'm/min', required: true, range: [40, 50] },
  { key: 'temperature', label: 'Temperature', unit: '°C', required: true, range: [90, 98] },
  { key: 'cylinderTemperature', label: 'Cylinder Temperature', unit: '°C', required: true },
];

const productionFields: FieldDefinition[] = [
  { key: 'inputFabricMeters', label: 'Fabric Input · MES', unit: 'm' },
  { key: 'outputFabricMeters', label: 'Fabric Output', unit: 'm' },
  { key: 'lossMeters', label: 'Loss', unit: 'm' },
];

function fieldMessage(value: string, field: FieldDefinition): 'missing' | 'warning' | null {
  if (!value.trim()) return field.required ? 'missing' : null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'missing';
  if (field.range && (numericValue < field.range[0] || numericValue > field.range[1])) return 'warning';
  return null;
}

function completedFields(fields: FieldDefinition[], values: RecordValues): number {
  return fields.filter((field) => values[field.key].trim() !== '' && fieldMessage(values[field.key], field) !== 'missing').length;
}

function calculateLoss(input: string, output: string): string {
  if (!input.trim() || !output.trim()) return '';
  const inputMeters = Number(input);
  const outputMeters = Number(output);
  if (!Number.isFinite(inputMeters) || !Number.isFinite(outputMeters)) return '';
  return String(Number(Math.max(0, inputMeters - outputMeters).toFixed(3)));
}

function RecordField({
  field,
  value,
  showValidation,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  showValidation: boolean;
  onChange: (value: string) => void;
}) {
  const { t, language } = useLanguage();
  const label = field.key === 'speed' ? t('speed') : field.key === 'temperature' ? t('temperature') : field.key === 'cylinderTemperature' ? t('cylinderTemperature') : field.key === 'inputFabricMeters' ? (language === 'vi' ? 'VẢI ĐẦU VÀO (THEO ĐƠN)' : 'FABRIC INPUT · ORDER') : field.key === 'outputFabricMeters' ? t('fabricOutput') : field.key === 'lossMeters' ? (language === 'vi' ? 'HAO HỤT' : 'LOSS') : field.label;
  const message = showValidation ? fieldMessage(value, field) : null;
  const isError = message === 'missing';
  const isWarning = message === 'warning';
  const isLoss = field.key === 'lossMeters';

  return (
    <label className="scouring-record-field flex min-w-0 w-full flex-col bg-transparent px-1 py-1.5">
      <span className="flex items-start justify-between gap-2 text-[10px] font-bold uppercase leading-normal tracking-[0.1em] text-industrial">
        <span className="truncate">{label}{field.required && <span className="ml-1 text-alarm">*</span>}</span>
      </span>
      <span className={`scouring-record-input-shell mt-2 flex min-w-0 items-stretch border-2 bg-white ${isError ? 'border-alarm' : isWarning ? 'border-warning' : 'border-line'}`}>
        <input
          aria-label={`${label} value`}
          aria-invalid={isError}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={field.key === 'inputFabricMeters' || isLoss}
          aria-readonly={field.key === 'inputFabricMeters' || isLoss}
          className={`scouring-record-input min-w-0 flex-1 appearance-none border-0 px-2 text-center font-mono text-[30px] font-bold leading-none tabular-nums outline-none focus:ring-2 focus:ring-info/60 ${field.key === 'inputFabricMeters' || isLoss ? 'bg-hmiSection' : 'bg-white focus:bg-white'} ${isError ? 'text-alarm' : isWarning ? 'text-warning' : isLoss ? (Number(value) > 0 ? 'text-alarm' : 'text-success') : field.key === 'outputFabricMeters' ? 'text-success' : field.key === 'inputFabricMeters' ? 'text-slate-500' : 'text-industrial'}`}
        />
        <span className="scouring-record-unit flex min-w-14 items-center justify-center border-l-2 border-line bg-surfaceMuted px-2 font-mono text-[13px] font-bold text-slate-600">{field.unit}</span>
      </span>
      <span className="mt-1 min-h-3 text-[8px] font-bold uppercase leading-tight tracking-wide">
        {isError && <span className="text-alarm">ERROR · {field.required ? 'Value required' : 'Enter a number'}</span>}
        {isWarning && field.range && <span className="text-warning">WARNING · {t('expected')} {field.range[0]}–{field.range[1]} {field.unit}</span>}
        {!message && field.range && <span className="text-slate-500">{t('expected')} {field.range[0]}–{field.range[1]} {field.unit}</span>}
      </span>
    </label>
  );
}

function FieldGrid({
  fields,
  values,
  showValidation,
  onChange,
  columns,
}: {
  fields: FieldDefinition[];
  values: RecordValues;
  showValidation: boolean;
  onChange: (key: RecordFieldKey, value: string) => void;
  columns: 2 | 3 | 5;
}) {
  return (
    <div className="overflow-x-auto bg-white">
        <div className={`scouring-record-grid scouring-record-grid-${columns} grid bg-white px-3 pb-5`}>
        {fields.map((field) => (
          <RecordField
            key={field.key}
            field={field}
            value={values[field.key]}
            showValidation={showValidation}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

export function ScouringRecordPage() {
  const { user } = useAuth();
  const isScouringOperator = user?.role === 'OPERATOR' && user.machineIds.some((machineId) => machineId.trim().toUpperCase().startsWith('SC-'));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const [values, setValues] = useState<RecordValues>(initialValues);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [entryMode, setEntryMode] = useState<'operation' | 'ph'>(() => searchParams.get('tab') === 'ph' ? 'ph' : 'operation');
  const [production, setProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState(false);
  const [savedOrderRecords, setSavedOrderRecords] = useState<ScouringRecord[]>([]);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [phValues, setPhValues] = useState<Record<number, string>>({});
  const [phNote, setPhNote] = useState('');
  const [phError, setPhError] = useState<string | null>(null);
  const [phSaving, setPhSaving] = useState(false);
  const [phSaved, setPhSaved] = useState(false);

  useEffect(() => {
    const orderNumber = values.orderNumber.trim();
    if (!orderNumber) { setProduction(null); setProductionLoading(false); setProductionError(false); return; }
    let active = true;
    setProductionLoading(true);
    setProductionError(false);
    const timer = window.setTimeout(() => {
      getWS3ProductionOrderContext(orderNumber, 'SC-01')
        .then((report) => {
          if (!active) return;
          setProduction(report);
          const hasMeters = Boolean(report?.rolls.length && report.rolls.every((roll) => roll.length_meters !== null && Number.isFinite(roll.length_meters)));
          const inputMeters = hasMeters ? report!.rolls.reduce((total, roll) => total + (roll.length_meters ?? 0), 0) : null;
          setValues((current) => current.orderNumber.trim().toLocaleLowerCase() === orderNumber.trim().toLocaleLowerCase()
            ? { ...current, inputFabricMeters: inputMeters === null ? '' : String(inputMeters), lossMeters: calculateLoss(inputMeters === null ? '' : String(inputMeters), current.outputFabricMeters) }
            : current);
        })
        .catch(() => { if (active) { setProduction(null); setProductionError(true); } })
        .finally(() => { if (active) setProductionLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [values.orderNumber]);

  const normalizedOrderNumber = values.orderNumber.trim().toLocaleLowerCase();
  const selectedOrderRecord = savedOrderRecords[0] ?? null;

  useEffect(() => {
    const orderNumber = values.orderNumber.trim();
    if (!orderNumber) { setSavedOrderRecords([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      Promise.all([getScouringRecordsForOrder(orderNumber), getMachineOrderProgress('SC-01', orderNumber)])
        .then(([records, savedProgress]) => {
          if (!active) return;
          setSavedOrderRecords(records);
          const latest = records[0];
          setValues((current) => current.orderNumber.trim().toLocaleLowerCase() !== orderNumber.toLocaleLowerCase() ? current : ({
            ...current,
            operatorName: latest?.operatorName || current.operatorName,
            operatorIdentifier: latest?.operatorIdentifier || current.operatorIdentifier,
            shift: normalizeShift(latest?.shift) || current.shift,
            orderProgress: savedProgress?.orderProgress ?? latest?.orderProgress ?? current.orderProgress,
          }));
        })
        .catch(() => { if (active) setSavedOrderRecords([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [values.orderNumber]);

  const changeOrderProgress = async (orderProgress: 'IN_PROGRESS' | 'COMPLETED') => {
    const orderNumber = values.orderNumber.trim();
    if (!orderNumber || !production || progressSaving) return;
    const previousProgress = values.orderProgress;
    setValues((current) => ({ ...current, orderProgress }));
    setProgressSaving(true);
    setProgressError(null);
    try {
      await saveMachineOrderProgress('SC-01', orderNumber, orderProgress);
      setSavedOrderRecords((records) => records.map((record) => ({ ...record, orderProgress })));
      setSaveError(null);
    } catch (error) {
      setValues((current) => ({ ...current, orderProgress: previousProgress }));
      setProgressError(error instanceof Error ? error.message : (language === 'vi' ? 'Không lưu được tiến độ đơn.' : 'Unable to save order progress.'));
    } finally { setProgressSaving(false); }
  };

  const updateValue = (key: RecordFieldKey, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'outputFabricMeters') next.lossMeters = calculateLoss(current.inputFabricMeters, value);
      return next;
    });
  };

  const hasBlockingErrors = [...chemicalFields, ...processFields, ...productionFields]
    .some((field) => fieldMessage(values[field.key], field) === 'missing');

  const saveRecord = async () => {
    setSaveAttempted(true);
    if (saving || saveSuccess) return;
    if (!values.orderNumber.trim() || !production) {
      setSaveError(language === 'vi' ? 'Nhập mã đơn hợp lệ có trong dữ liệu MES trước khi ghi nhận.' : 'Enter a valid order in the MES data before recording.');
      return;
    }
    if (!values.operatorName.trim() || !values.operatorIdentifier.trim() || !values.shift.trim()) {
      setSaveError(language === 'vi' ? 'Vui lòng nhập người vận hành, ID nhân viên và ca làm.' : 'Enter operator name, employee ID, and shift.');
      return;
    }
    if (hasBlockingErrors) {
      setSaveError(t('completeRequired'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        machineId: 'SC-01',
        recordedAt: new Date().toISOString(),
        orderNumber: values.orderNumber.trim() || null,
        item: production.item_name || production.item_code || null,
        lotYarn: values.lotYarn.trim() || null,
        lotNumber: production.lot_no || null,
        operatorName: values.operatorName.trim() || null,
        operatorIdentifier: values.operatorIdentifier.trim(),
        shift: values.shift.trim(),
        orderProgress: values.orderProgress,
        naoh: Number(values.naoh),
        soap: Number(values.soap),
        desizer: Number(values.desizer),
        h2o2: Number(values.h2o2),
        chelate: Number(values.chelate),
        speed: Number(values.speed),
        temperature: Number(values.temperature),
        cylinderTemperature: Number(values.cylinderTemperature),
        inputFabricMeters: values.inputFabricMeters.trim() ? Number(values.inputFabricMeters) : null,
        outputFabricMeters: values.outputFabricMeters.trim() ? Number(values.outputFabricMeters) : null,
        productionQuantityMeters: values.outputFabricMeters.trim() ? Number(values.outputFabricMeters) : null,
        lossMeters: calculateLoss(values.inputFabricMeters, values.outputFabricMeters) ? Number(calculateLoss(values.inputFabricMeters, values.outputFabricMeters)) : null,
      };
      const saved = await createScouringRecord(payload);
      setSavedOrderRecords((records) => [saved, ...records]);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error instanceof ScouringApiError ? error.message : 'Unable to save the Scouring record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const savePhInspection = async () => {
    if (phSaving || phSaved) return;
    if (!selectedOrderRecord) { setPhError(language === 'vi' ? 'Hãy lưu thông số của đơn này trước khi ghi checklist pH.' : 'Save operation data for this order before the pH checklist.'); return; }
    const tankPh = Array.from({ length: 8 }, (_, tank) => phValues[tank]?.trim() ? Number(phValues[tank]) : null);
    if (!tankPh.some((value) => value !== null && Number.isFinite(value))) { setPhError(language === 'vi' ? 'Nhập ít nhất một giá trị pH.' : 'Enter at least one pH value.'); return; }
    setPhSaving(true); setPhError(null);
    try {
      await createScouringPhInspection({ scouringRecordId: selectedOrderRecord.id, operatorName: values.operatorName.trim() || selectedOrderRecord.operatorName || null, tankPh, note: phNote.trim() || null });
      setPhSaved(true);
    } catch (error) { setPhError(error instanceof Error ? error.message : 'Unable to save the pH checklist.'); }
    finally { setPhSaving(false); }
  };

  return (
    <WS3Shell title="WS3 / Scouring Record" subtitle="Operator data entry · Scouring / 정련기" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')} showSupportWidget={!isScouringOperator}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
        <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div className={`scouring-record-workspace grid w-full min-h-full gap-2 ${isScouringOperator ? 'scouring-record-workspace-with-notices grid-cols-[minmax(0,0.85fr)_minmax(0,3.15fr)_minmax(260px,0.9fr)]' : 'grid-cols-[minmax(0,0.85fr)_minmax(0,3.15fr)]'}`}>
            <aside className="scouring-record-context flex h-full min-h-0 self-stretch flex-col border-2 border-industrialDark bg-white">
              <header className="flex h-12 min-h-12 items-center border-b-2 border-industrialDark bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-industrialDark">
                <h2 className="whitespace-nowrap">{language === 'vi' ? 'Thông tin vận hành' : 'Operation details'}</h2>
              </header>
              <OperationInfoFields orderNumber={values.orderNumber} onOrderNumberChange={(orderNumber) => { setProduction(null); setSavedOrderRecords([]); setProgressError(null); setValues((current) => ({ ...current, orderNumber, operatorName: '', operatorIdentifier: '', shift: '', orderProgress: 'IN_PROGRESS', inputFabricMeters: '', outputFabricMeters: '', lossMeters: '' })); }} operatorName={values.operatorName} onOperatorNameChange={(operatorName) => setValues((current) => ({ ...current, operatorName }))} employeeId={values.operatorIdentifier} onEmployeeIdChange={(operatorIdentifier) => setValues((current) => ({ ...current, operatorIdentifier }))} shift={values.shift} onShiftChange={(shift) => setValues((current) => ({ ...current, shift }))} orderStatus={<label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark disabled:bg-hmiSection disabled:text-slate-400" value={values.orderProgress} disabled={!production || progressSaving} onChange={(event) => void changeOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}><option value="IN_PROGRESS">{language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option><option value="COMPLETED">{language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option></select>{progressSaving && <span className="text-[9px] normal-case text-info">{language === 'vi' ? 'Đang lưu…' : 'Saving…'}</span>}{progressError && <span role="alert" className="text-[9px] normal-case text-alarm">{progressError}</span>}</label>} />
            </aside>

            <section className="flex h-full min-w-0 flex-col gap-3 border-2 border-industrialDark bg-white">
              <nav className="flex h-12 min-h-12 shrink-0 border-b-2 border-line bg-white" aria-label={language === 'vi' ? 'Loại ghi nhận Scouring' : 'Scouring entry type'}>{(['operation', 'ph'] as const).map((mode) => <button key={mode} type="button" aria-pressed={entryMode === mode} onClick={() => setEntryMode(mode)} className={`h-full min-h-10 flex-1 border-b-2 px-3 text-[10px] font-bold uppercase tracking-wide ${entryMode === mode ? 'border-industrialDark bg-industrialDark text-white' : 'border-transparent text-slate-500'}`}>{mode === 'operation' ? (language === 'vi' ? 'Thông số vận hành' : 'Operation parameters') : (language === 'vi' ? 'Checklist pH' : 'pH checklist')}</button>)}</nav>
                {(productionLoading || productionError || (normalizedOrderNumber && !productionLoading && !productionError && !production)) && <div className="shrink-0 border-b border-line bg-white px-3 py-2 text-[10px]"><p role="status" className="font-bold text-warning">{productionLoading ? (language === 'vi' ? 'Đang đối chiếu dữ liệu MES…' : 'Looking up MES data…') : productionError ? (language === 'vi' ? 'Không tải được dữ liệu MES.' : 'MES data could not be loaded.') : (language === 'vi' ? 'Không tìm thấy mã đơn trong dữ liệu MES.' : 'Order not found in MES data.')}</p></div>}
              {entryMode === 'ph' ? <section className="min-h-0 min-w-0 flex-1 overflow-auto p-3"><header className="mb-3 flex items-center justify-between border-b border-line pb-2"><h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{t('phInspection')}</h2><span className="font-mono text-[9px] text-slate-500">8 {t('tanks')}</span></header>{selectedOrderRecord ? <p className="mb-3 text-[10px] text-slate-600">{t('operationRecord')}: <strong className="font-mono text-industrial">{selectedOrderRecord.orderNumber || '—'}</strong> · {selectedOrderRecord.item || '—'} · {selectedOrderRecord.lotNumber || '—'}</p> : <p className="mb-3 border border-warning bg-hmiWarning p-2 text-[10px] font-bold text-warning">{language === 'vi' ? 'Cần lưu thông số của đơn này trước khi ghi checklist pH.' : 'Save operation data for this order before the pH checklist.'}</p>}<div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, tank) => <label key={tank} className="grid min-w-0 gap-1 p-2"><span className="text-[10px] font-bold uppercase text-industrial">{t('tank')} {tank}</span><span className="flex h-12 min-w-0 border-2 border-line"><input type="number" inputMode="decimal" step="any" value={phValues[tank] ?? ''} onChange={(event) => setPhValues((current) => ({ ...current, [tank]: event.target.value }))} className="min-w-0 flex-1 text-center font-mono text-lg font-bold text-industrial outline-none" aria-label={`${t('tank')} ${tank} pH`} /><span className="flex w-10 shrink-0 items-center justify-center border-l-2 border-line bg-surfaceMuted font-mono text-[10px] font-bold">pH</span></span></label>)}</div><div className="mt-3 min-w-0"><label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase text-slate-500">{t('note')}<input value={phNote} onChange={(event) => setPhNote(event.target.value)} className="min-h-9 min-w-0 border-2 border-line px-2 text-xs font-semibold normal-case" /></label></div>{phError && <p role="alert" className="mt-3 border border-alarm bg-hmiAlarm p-2 text-[10px] font-bold text-alarm">{phError}</p>}{phSaved && <p role="status" className="mt-3 border border-success bg-hmiNormal p-2 text-[10px] font-bold text-success">{language === 'vi' ? 'ĐÃ LƯU CHECKLIST pH' : 'pH CHECKLIST SAVED'}</p>}</section> : <>
              <>
                <section className="scouring-record-group border-b border-line bg-white">
                  <div className="bg-white">
                    <div className="border-b border-line"><h3 className="flex items-center justify-between px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><span>{t('chemicalInput')}</span><span className="font-mono">{completedFields(chemicalFields, values)}/{chemicalFields.length} ✓</span></h3><FieldGrid fields={chemicalFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} /></div>
                    <div className="border-b border-line"><h3 className="flex items-center justify-between px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><span>{t('processConditions')}</span><span className="font-mono">{completedFields(processFields, values)}/{processFields.length} ✓</span></h3><FieldGrid fields={processFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} /></div>
                    <div><h3 className="flex items-center justify-between px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"><span>{t('production')}</span><span className="font-mono">{completedFields(productionFields, values)}/{productionFields.length}</span></h3><FieldGrid fields={productionFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} />{!values.inputFabricMeters && <p className="px-4 pb-3 text-[9px] font-semibold uppercase text-warning">{language === 'vi' ? 'MES chưa có đủ mét cuộn để tự điền vải đầu vào.' : 'MES does not have all roll lengths needed to fill fabric input.'}</p>}</div>
                  </div>
                </section>
              </>
              {saveAttempted && processFields.some((field) => fieldMessage(values[field.key], field) === 'warning') && <div className="border border-warning bg-hmiWarning px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-warning">DATA / PROCESS WARNING · Values outside the expected range can still be saved.</div>}
              {saveAttempted && hasBlockingErrors && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">{t('completeRequired')}</div>}
              {saveError && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">SAVE ERROR · {saveError}</div>}
              {saveSuccess && <div className="border border-success bg-hmiNormal px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-success">RECORD SAVED · You can now record pH inspection.</div>}
              </>}</section>
            {isScouringOperator && <SupportChatWidget embedded />}

          </div>
        </div>
        <div className="scouring-record-actions grid shrink-0 grid-cols-[minmax(0,0.85fr)_minmax(0,3.15fr)] gap-2 border-t border-line bg-hmiConsole p-2">
          <div className="scouring-record-back-action flex items-center">
            <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/ws3')}>{t('back')}</HMIButton>
          </div>
          <div className="scouring-record-action-buttons flex justify-end gap-2">
            <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/ws3')}>{t('cancel')}</HMIButton>
            {entryMode === 'operation' ? <HMIButton size="large" variant="primary" disabled={saving || saveSuccess || productionLoading || !production || !values.orderNumber.trim()} onClick={saveRecord}>{saving ? t('saving') : t('saveRecord')}</HMIButton> : <HMIButton size="large" variant="primary" disabled={phSaving || phSaved || !selectedOrderRecord} onClick={() => void savePhInspection()}>{phSaving ? t('saving') : t('saveCheck')}</HMIButton>}
          </div>
        </div>
        </div>
      </div>
    </WS3Shell>
  );
}
