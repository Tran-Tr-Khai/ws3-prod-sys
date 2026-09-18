import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';

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
    <label className={`flex min-h-[104px] min-w-0 flex-col border-2 bg-hmiInput p-2 ${isError ? 'border-alarm' : isWarning ? 'border-warning' : 'border-line'}`}>
      <span className="flex items-start justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-industrial">
        <span className="truncate">{field.label}</span>
        <span className="shrink-0 font-mono text-[10px] font-normal text-slate-500">{field.required ? 'REQUIRED' : 'OPTIONAL'}</span>
      </span>
      <span className="mt-2 flex min-w-0 items-end gap-2">
        <input
          aria-label={`${field.label} value`}
          aria-invalid={isError}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-12 min-w-0 flex-1 appearance-none border-0 border-b-2 bg-transparent px-1 text-right font-mono text-[27px] font-bold leading-none tabular-nums outline-none focus:border-industrial focus:ring-0 ${isError ? 'border-alarm text-alarm' : isWarning ? 'border-warning text-warning' : 'border-info text-industrial'}`}
        />
        <span className="pb-2 font-mono text-[11px] font-bold text-slate-600">{field.unit}</span>
      </span>
      <span className="mt-1 min-h-4 text-[9px] font-bold uppercase tracking-wide">
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
}: {
  title: string;
  fields: FieldDefinition[];
  values: RecordValues;
  showValidation: boolean;
  onChange: (key: RecordFieldKey, value: string) => void;
}) {
  return (
    <section className="border-2 border-line bg-panel">
      <header className="flex min-h-9 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em]">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">{fields.length} FIELDS</span>
      </header>
      <div className="grid grid-cols-1 gap-2 bg-surfaceMuted p-2 sm:grid-cols-2 xl:grid-cols-3">
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

export function ScouringRecordPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<RecordValues>(initialValues);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [reviewReady, setReviewReady] = useState(false);

  const validation = useMemo(
    () => [...chemicalFields, ...processFields, ...productionFields].map((field) => fieldMessage(values[field.key], field)),
    [values],
  );
  const hasErrors = validation.some((message) => message === 'missing');
  const warningCount = validation.filter((message) => message === 'warning').length;

  const updateValue = (key: RecordFieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setReviewReady(false);
  };

  const reviewRecord = () => {
    setReviewAttempted(true);
    setReviewReady(!hasErrors);
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
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2">
            <section className="border-2 border-line bg-panel">
              <header className="flex min-h-9 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em]">Record context</h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">MANUAL ENTRY</span>
              </header>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 bg-surfaceMuted px-3 py-2 text-[11px] sm:grid-cols-3">
                <div><span className="font-bold uppercase tracking-wide text-slate-500">Machine</span><span className="ml-3 font-mono font-bold text-industrial">SC-01</span></div>
                <div><span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="ml-3 font-mono font-bold text-industrial">SC-260917-01</span></div>
                <div><span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span className="ml-3 font-semibold text-slate-700">N. Tran</span></div>
              </div>
            </section>

            <FieldGroup title="Chemical Input" fields={chemicalFields} values={values} showValidation={reviewAttempted} onChange={updateValue} />
            <FieldGroup title="Process Conditions" fields={processFields} values={values} showValidation={reviewAttempted} onChange={updateValue} />
            <FieldGroup title="Production" fields={productionFields} values={values} showValidation={reviewAttempted} onChange={updateValue} />

            {reviewAttempted && (
              <section className={`border-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${hasErrors ? 'border-alarm bg-hmiAlarm text-alarm' : warningCount ? 'border-warning bg-hmiWarning text-warning' : 'border-success bg-hmiNormal text-success'}`}>
                {hasErrors ? 'ERROR · Complete all required values before review.' : reviewReady && warningCount ? `REVIEW READY · ${warningCount} range warning${warningCount === 1 ? '' : 's'} require operator attention.` : 'REVIEW READY · No values have been saved.'}
              </section>
            )}
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t-2 border-industrialDark bg-hmiRail p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">No record is saved by this screen.</span>
          <div className="flex gap-2">
            <HMIButton size="large" variant="secondary" onClick={() => navigate('/machine/scouring')}>CANCEL</HMIButton>
            <HMIButton size="large" variant="primary" onClick={reviewRecord}>REVIEW RECORD</HMIButton>
          </div>
        </div>
      </div>
    </main>
  );
}
