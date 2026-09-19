import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { createScouringRecord, ScouringApiError } from './scouringApi';
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
  | 'productionQuantityMeters';

type RecordValues = Record<RecordFieldKey, string> & {
  orderNumber: string;
  item: string;
  lotYarn: string;
  lotNumber: string;
  operatorName: string;
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
  productionQuantityMeters: '',
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
  { key: 'inputFabricMeters', label: 'Fabric Input', unit: 'm' },
  { key: 'outputFabricMeters', label: 'Fabric Output', unit: 'm' },
  { key: 'productionQuantityMeters', label: 'Production Quantity', unit: 'm' },
];

function fieldMessage(value: string, field: FieldDefinition): 'missing' | 'warning' | null {
  if (!value.trim()) return field.required ? 'missing' : null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'missing';
  if (field.range && (numericValue < field.range[0] || numericValue > field.range[1])) return 'warning';
  return null;
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
  const { t } = useLanguage();
  const label = field.key === 'speed' ? t('speed') : field.key === 'temperature' ? t('temperature') : field.key === 'cylinderTemperature' ? t('cylinderTemperature') : field.key === 'inputFabricMeters' ? t('fabricInput') : field.key === 'outputFabricMeters' ? t('fabricOutput') : field.key === 'productionQuantityMeters' ? t('productionQuantity') : field.label;
  const message = showValidation ? fieldMessage(value, field) : null;
  const isError = message === 'missing';
  const isWarning = message === 'warning';

  return (
    <label className="scouring-record-field flex min-w-0 w-full flex-col bg-transparent px-1 py-1.5">
      <span className="flex items-start justify-between gap-2 text-[10px] font-bold uppercase leading-normal tracking-[0.1em] text-industrial">
        <span className="truncate">{label}{field.required && <span className="ml-1 text-alarm">*</span>}</span>
        {!field.required && <span className="shrink-0 text-[9px] font-normal normal-case tracking-normal text-slate-500">{t('optional')}</span>}
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
          className={`scouring-record-input min-w-0 flex-1 appearance-none border-0 bg-white px-2 text-center font-mono text-[30px] font-bold leading-none tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-info/60 ${isError ? 'text-alarm' : isWarning ? 'text-warning' : 'text-industrial'}`}
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
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [values, setValues] = useState<RecordValues>(initialValues);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateValue = (key: RecordFieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const hasBlockingErrors = [...chemicalFields, ...processFields, ...productionFields]
    .some((field) => fieldMessage(values[field.key], field) === 'missing');

  const saveRecord = async () => {
    setSaveAttempted(true);
    if (saving || saveSuccess) return;
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
        item: values.item.trim() || null,
        lotYarn: values.lotYarn.trim() || null,
        lotNumber: values.lotNumber.trim() || null,
        operatorName: values.operatorName.trim() || null,
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
        productionQuantityMeters: values.productionQuantityMeters.trim() ? Number(values.productionQuantityMeters) : null,
      };
      await createScouringRecord(payload);
      setSaveSuccess(true);
      window.setTimeout(() => navigate('/machine/scouring'), 900);
    } catch (error) {
      setSaveError(error instanceof ScouringApiError ? error.message : 'Unable to save the Scouring record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WS3Shell title="WS3 / Scouring Record" subtitle="Operator data entry · Scouring / 정련기" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
        <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div className="scouring-record-workspace grid w-full min-h-full grid-cols-[220px_minmax(0,1fr)] gap-2">
            <aside className="scouring-record-context flex h-full min-h-0 self-stretch flex-col border border-line bg-white">
              <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
                <h2 className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.14em]">{t('recordContext')}</h2>
              </header>
              <div className="scouring-record-context-content grid gap-3 bg-white px-3 py-3 text-[10px]">
                <div><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Machine</span><span className="mt-0.5 block font-mono text-[20px] font-bold tracking-wide text-industrialDark">SC-01</span></div>
                <label className="grid gap-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('orderNumber')}</span><input aria-label={t('orderNumber')} type="text" value={values.orderNumber} onChange={(event) => setValues((current) => ({ ...current, orderNumber: event.target.value }))} className="min-h-10 border-2 border-line bg-white px-2 font-mono text-[13px] font-bold text-industrial outline-none focus:border-info" /></label>
                <label className="grid gap-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('item')}</span><input aria-label={t('item')} type="text" value={values.item} onChange={(event) => setValues((current) => ({ ...current, item: event.target.value }))} className="min-h-10 border-2 border-line bg-white px-2 font-mono text-[13px] font-bold text-industrial outline-none focus:border-info" /></label>
                <label className="grid gap-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('lotYarn')}</span><input aria-label={t('lotYarn')} type="text" value={values.lotYarn} onChange={(event) => setValues((current) => ({ ...current, lotYarn: event.target.value }))} className="min-h-10 border-2 border-line bg-white px-2 font-mono text-[13px] font-bold text-industrial outline-none focus:border-info" /></label>
                <label className="grid gap-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('lotNumber')}</span><input aria-label={t('lotNumber')} type="text" value={values.lotNumber} onChange={(event) => setValues((current) => ({ ...current, lotNumber: event.target.value }))} className="min-h-10 border-2 border-line bg-white px-2 font-mono text-[13px] font-bold text-industrial outline-none focus:border-info" /></label>
                <label className="grid gap-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t('operator')}</span><input aria-label={t('operator')} type="text" value={values.operatorName} onChange={(event) => setValues((current) => ({ ...current, operatorName: event.target.value }))} className="min-h-10 border-2 border-line bg-white px-2 text-[14px] font-semibold text-slate-700 outline-none focus:border-info" placeholder={t('enterOperator')} /></label>
              </div>
            </aside>

            <section className="flex h-full min-w-0 flex-col gap-3 border border-line bg-white">
              <>
                <section className="scouring-record-group border-b border-line bg-white">
                  <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{t('scouringParameters')}</h2>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">10 {t('fields')}</span>
                  </header>
                  <div className="bg-white">
                    <div className="border-b border-line"><h3 className="px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('chemicalInput')}</h3><FieldGrid fields={chemicalFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} /></div>
                    <div className="border-b border-line"><h3 className="px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('processConditions')}</h3><FieldGrid fields={processFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} /></div>
                    <div><h3 className="px-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{t('production')}</h3><FieldGrid fields={productionFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={5} /></div>
                  </div>
                </section>
              </>
              {saveAttempted && processFields.some((field) => fieldMessage(values[field.key], field) === 'warning') && <div className="border border-warning bg-hmiWarning px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-warning">DATA / PROCESS WARNING · Values outside the expected range can still be saved.</div>}
              {saveAttempted && hasBlockingErrors && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">{t('completeRequired')}</div>}
              {saveError && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">SAVE ERROR · {saveError}</div>}
              {saveSuccess && <div className="border border-success bg-hmiNormal px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-success">RECORD SAVED · Returning to Scouring overview...</div>}
            </section>

          </div>
        </div>
        <div className="grid shrink-0 grid-cols-[220px_minmax(0,1fr)] gap-2 border-t border-line bg-hmiConsole p-2">
          <div className="flex items-center">
            <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/machine/scouring')}>{t('back')}</HMIButton>
          </div>
          <div className="flex justify-end gap-2">
            <HMIButton size="large" variant="secondary" className="border-line bg-white" onClick={() => navigate('/machine/scouring')}>{t('cancel')}</HMIButton>
            <HMIButton size="large" variant="primary" disabled={saving || saveSuccess} onClick={saveRecord}>{saving ? t('saving') : t('saveRecord')}</HMIButton>
          </div>
        </div>
        </div>
      </div>
    </WS3Shell>
  );
}
