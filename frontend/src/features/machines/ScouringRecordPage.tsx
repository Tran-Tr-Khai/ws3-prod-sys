import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { createScouringRecord, ScouringApiError } from './scouringApi';

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
  | 'outputFabricMeters';

type RecordValues = Record<RecordFieldKey, string>;

type FieldDefinition = {
  key: RecordFieldKey;
  label: string;
  unit: string;
  required?: boolean;
  range?: [number, number];
};

const initialValues: RecordValues = {
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
  const message = showValidation ? fieldMessage(value, field) : null;
  const isError = message === 'missing';
  const isWarning = message === 'warning';

  return (
    <label className="scouring-record-field flex min-w-0 w-full flex-col bg-transparent px-1 py-1.5">
      <span className="flex items-start justify-between gap-2 text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-industrial">
        <span className="truncate">{field.label}{field.required && <span className="ml-1 text-alarm">*</span>}</span>
        {!field.required && <span className="shrink-0 text-[9px] font-normal normal-case tracking-normal text-slate-500">optional</span>}
      </span>
      <span className={`scouring-record-input-shell mt-2 flex min-w-0 items-stretch border-2 bg-white ${isError ? 'border-alarm' : isWarning ? 'border-warning' : 'border-line'}`}>
        <input
          aria-label={`${field.label} value`}
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
      <span className="mt-0.5 min-h-3 text-[8px] font-bold uppercase leading-tight tracking-wide">
        {isError && <span className="text-alarm">ERROR · {field.required ? 'Value required' : 'Enter a number'}</span>}
        {isWarning && field.range && <span className="text-warning">WARNING · Expected {field.range[0]}–{field.range[1]} {field.unit}</span>}
        {!message && field.range && <span className="text-slate-500">Expected {field.range[0]}–{field.range[1]} {field.unit}</span>}
      </span>
    </label>
  );
}

function FieldGroup({
  title,
  fields,
  values,
  showValidation,
  onChange,
  columns,
}: {
  title: string;
  fields: FieldDefinition[];
  values: RecordValues;
  showValidation: boolean;
  onChange: (key: RecordFieldKey, value: string) => void;
  columns: 2 | 3;
}) {
  return (
    <section className="scouring-record-group border border-industrialDark bg-hmiSection">
      <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">{fields.length} FIELDS</span>
      </header>
      <div className={`scouring-record-grid scouring-record-grid-${columns} grid bg-hmiSection px-3 py-2`}>
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
    </section>
  );
}

function ReviewSection({ title, fields, values }: { title: string; fields: FieldDefinition[]; values: RecordValues }) {
  return (
    <section className="scouring-record-group border border-industrialDark bg-hmiSection">
      <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">REVIEW</span>
      </header>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-white px-3 py-2 lg:grid-cols-3">
        {fields.map((field) => {
          const message = fieldMessage(values[field.key], field);
          return (
            <div key={field.key} className="flex min-w-0 items-baseline justify-between gap-2 border-b border-line/60 py-1.5 text-[11px]">
              <span className="truncate font-semibold uppercase tracking-wide text-slate-600">{field.label}</span>
              <span className="shrink-0 text-right">
                <span className={`font-mono text-[14px] font-bold ${message === 'warning' ? 'text-warning' : 'text-industrialDark'}`}>
                  {values[field.key] || '—'} {values[field.key] && field.unit}
                </span>
                {message === 'warning' && <span className="ml-2 font-mono text-[9px] font-bold uppercase text-warning">WARNING</span>}
                {message === 'missing' && <span className="ml-2 font-mono text-[9px] font-bold uppercase text-alarm">ERROR</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ScouringRecordPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<RecordValues>(initialValues);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [reviewState, setReviewState] = useState<'entry' | 'review'>('entry');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateValue = (key: RecordFieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const hasBlockingErrors = [...chemicalFields, ...processFields, ...productionFields]
    .some((field) => fieldMessage(values[field.key], field) === 'missing');

  const reviewRecord = () => {
    setReviewAttempted(true);
    setSaveError(null);
    if (!hasBlockingErrors) setReviewState('review');
  };

  const confirmRecord = async () => {
    if (saving || hasBlockingErrors) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createScouringRecord({
        machineId: 'SC-01',
        recordedAt: new Date().toISOString(),
        batchIdentifier: 'SC-260917-01',
        operatorName: 'N. Tran',
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
      });
      setSaveSuccess(true);
      window.setTimeout(() => navigate('/machine/scouring'), 900);
    } catch (error) {
      setSaveError(error instanceof ScouringApiError ? error.message : 'Unable to save the Scouring record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <HMIHeader
        variant="machine"
        title="WS3 / Scouring Record"
        subtitle="Operator data entry · Scouring / 정련기 · Batch SC-260917-01 · Operator N. Tran"
        machineName="SC-01"
        status="info"
        time={new Date().toLocaleTimeString('vi-VN')}
      />

      <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div className="scouring-record-workspace grid w-full min-h-full grid-cols-[220px_minmax(0,1fr)] gap-2">
            <aside className="scouring-record-context flex min-h-0 flex-col border border-line bg-white">
              <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white">
                <h2 className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.14em]">Record context</h2>
                <span className="font-mono text-[8px] uppercase tracking-wider text-slate-300">MANUAL ENTRY</span>
              </header>
              <div className="scouring-record-context-content grid gap-3 bg-white px-3 py-3 text-[10px]">
                <div><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Machine</span><span className="mt-0.5 block font-mono text-[20px] font-bold tracking-wide text-industrialDark">SC-01</span></div>
                <div><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Batch</span><span className="mt-0.5 block font-mono text-[13px] font-bold text-industrial">SC-260917-01</span></div>
                <div><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Operator</span><span className="mt-0.5 block text-[14px] font-semibold text-slate-700">N. Tran</span></div>
              </div>
              <div className="scouring-record-reference mx-3 mt-1 flex min-h-[54px] flex-none items-center justify-center border border-dashed border-line bg-slate-50 text-center text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Machine reference reserved
              </div>
            </aside>

            <section className="flex min-w-0 flex-col gap-2">
              {reviewState === 'entry' ? <>
                <FieldGroup title="Chemical Input" fields={chemicalFields} values={values} showValidation={reviewAttempted} onChange={updateValue} columns={3} />
                <FieldGroup title="Process Conditions" fields={processFields} values={values} showValidation={reviewAttempted} onChange={updateValue} columns={3} />
                <FieldGroup title="Production" fields={productionFields} values={values} showValidation={reviewAttempted} onChange={updateValue} columns={2} />
              </> : <>
                <div className="border border-industrialDark bg-white px-3 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-bold uppercase tracking-wider text-industrialDark">Review record</p><p className="mt-0.5 text-slate-600">Check the entered values before sending this snapshot to PostgreSQL.</p></div>
                    <span className="font-mono text-[10px] font-bold uppercase text-success">READY TO CONFIRM</span>
                  </div>
                </div>
                <ReviewSection title="Chemical Input" fields={chemicalFields} values={values} />
                <ReviewSection title="Process Conditions" fields={processFields} values={values} />
                <ReviewSection title="Production" fields={productionFields} values={values} />
                <div className="border border-warning bg-hmiWarning px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-warning">
                  {processFields.some((field) => fieldMessage(values[field.key], field) === 'warning')
                    ? 'DATA / PROCESS WARNING · One or more values are outside the expected operating range. Confirmation is still allowed.'
                    : 'DATA CHECK · Review all values before confirmation.'}
                </div>
              </>}
              {reviewAttempted && hasBlockingErrors && reviewState === 'entry' && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">ERROR · Complete all required values before review.</div>}
              {saveError && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">SAVE ERROR · {saveError}</div>}
              {saveSuccess && <div className="border border-success bg-hmiNormal px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-success">RECORD SAVED · Returning to Scouring overview...</div>}
              <div className="mt-auto flex justify-end gap-2 border-t-2 border-industrialDark bg-industrialDark p-2">
                {reviewState === 'entry' ? <>
                  <HMIButton size="large" variant="secondary" onClick={() => navigate('/machine/scouring')}>CANCEL</HMIButton>
                  <HMIButton size="large" variant="primary" onClick={reviewRecord}>REVIEW RECORD</HMIButton>
                </> : <>
                  <HMIButton size="large" variant="secondary" onClick={() => { setReviewState('entry'); setSaveError(null); }}>BACK TO ENTRY</HMIButton>
                  <HMIButton size="large" variant="primary" disabled={saving || saveSuccess} onClick={confirmRecord}>{saving ? 'SAVING...' : 'CONFIRM RECORD'}</HMIButton>
                </>}
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
