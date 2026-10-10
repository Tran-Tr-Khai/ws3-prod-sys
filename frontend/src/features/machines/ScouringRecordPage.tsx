import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { normalizeShift } from '../../components/hmi/ShiftSelect';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { createScouringPhInspection, createScouringRecord, updateScouringRecord, deleteScouringRecord, getScouringRecords, getScouringRecordsForOrder, getScouringPhInspections, getMachineOrderProgress, saveMachineOrderProgress, ScouringApiError, type ScouringPhInspection, type ScouringRecord } from './scouringApi';
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

const TRANSIENT_NOTICE_MS = 15_000;

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

function localizedRequestError(error: unknown, language: string, action: 'record' | 'ph' | 'progress'): string {
  const vi = language === 'vi';
  if (error instanceof ScouringApiError) {
    if (error.status === 422) {
      if (action === 'ph') return vi ? 'Giá trị pH không hợp lệ. Kiểm tra lại dữ liệu.' : 'The pH value is invalid. Check the entered data.';
      return vi ? 'Mã SOP hoặc dữ liệu nhập không hợp lệ. Hãy kiểm tra lại.' : 'The SOP or entered data is invalid. Please check it.';
    }
    if (error.status === 409) {
      return action === 'progress'
        ? (vi ? 'Không thể cập nhật tiến độ đơn. Hãy tải lại và thử lại.' : 'Unable to update order progress. Reload and try again.')
        : (vi ? 'Dữ liệu đã thay đổi hoặc mã SOP chưa rõ ràng. Hãy kiểm tra lại rồi thử lại.' : 'The data changed or the SOP is ambiguous. Check it and try again.');
    }
    if (error.status === 404) return vi ? 'Không tìm thấy bản ghi cần cập nhật.' : 'The record to update could not be found.';
  }
  if (action === 'progress') return vi ? 'Không lưu được tiến độ đơn.' : 'Unable to save order progress.';
  if (action === 'ph') return vi ? 'Không lưu được checklist pH. Vui lòng thử lại.' : 'Unable to save the pH checklist. Please try again.';
  return vi ? 'Không lưu được bản ghi Scouring. Vui lòng thử lại.' : 'Unable to save the Scouring record. Please try again.';
}

function localizedShift(shift: string | null | undefined, language: string): string {
  const normalized = normalizeShift(shift);
  if (normalized === 'HÀNH CHÍNH') return language === 'vi' ? normalized : 'ADMINISTRATIVE';
  if (normalized.startsWith('CA ')) return language === 'vi' ? normalized : normalized.replace('CA ', 'SHIFT ');
  return shift || '—';
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
  const label = field.key === 'naoh' ? 'NaOH' : field.key === 'soap' ? (language === 'vi' ? 'XÀ PHÒNG' : 'SOAP') : field.key === 'desizer' ? (language === 'vi' ? 'CHẤT GIŨ HỒ' : 'DESIZER') : field.key === 'h2o2' ? 'H2O2' : field.key === 'chelate' ? (language === 'vi' ? 'CHẤT TẠO PHỨC' : 'CHELATE') : field.key === 'speed' ? t('speed') : field.key === 'temperature' ? t('temperature') : field.key === 'cylinderTemperature' ? t('cylinderTemperature') : field.key === 'inputFabricMeters' ? (language === 'vi' ? 'VẢI ĐẦU VÀO (THEO ĐƠN)' : 'FABRIC INPUT · ORDER') : field.key === 'outputFabricMeters' ? t('fabricOutput') : field.key === 'lossMeters' ? (language === 'vi' ? 'HAO HỤT' : 'LOSS') : field.label;
  const message = showValidation ? fieldMessage(value, field) : null;
  const isError = message === 'missing';
  const isWarning = message === 'warning';
  const isLoss = field.key === 'lossMeters';

  return (
    <label className="scouring-record-field flex min-w-0 w-full flex-col bg-transparent px-1 py-1">
      <span className="flex items-start justify-between gap-2 text-[9px] font-bold uppercase leading-normal tracking-wide text-industrial">
        <span className="truncate">{label}{field.required && <span className="ml-1 text-alarm">*</span>}</span>
      </span>
      <span className={`scouring-record-input-shell mt-1 flex min-w-0 items-stretch border-2 bg-white ${isError ? 'border-alarm' : isWarning ? 'border-warning' : 'border-line'}`}>
        <input
          aria-label={`${label} ${language === 'vi' ? 'giá trị' : 'value'}`}
          aria-invalid={isError}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={field.key === 'inputFabricMeters' || isLoss}
          aria-readonly={field.key === 'inputFabricMeters' || isLoss}
          className={`scouring-record-input min-w-0 flex-1 appearance-none border-0 px-2 text-center font-mono text-[18px] font-bold leading-none tabular-nums outline-none focus:ring-2 focus:ring-info/60 ${field.key === 'inputFabricMeters' || isLoss ? 'bg-hmiSection' : 'bg-white focus:bg-white'} ${isError ? 'text-alarm' : isWarning ? 'text-warning' : isLoss ? (Number(value) > 0 ? 'text-alarm' : 'text-success') : field.key === 'outputFabricMeters' ? 'text-success' : field.key === 'inputFabricMeters' ? 'text-slate-500' : 'text-industrial'}`}
        />
        <span className="scouring-record-unit flex min-w-14 items-center justify-center border-l-2 border-line bg-surfaceMuted px-2 font-mono text-[13px] font-bold text-slate-600">{field.unit}</span>
      </span>
      <span className="mt-1 min-h-3 text-[8px] font-bold uppercase leading-tight tracking-wide">
        {isError && <span className="text-alarm">{language === 'vi' ? 'LỖI' : 'ERROR'} · {field.required ? (language === 'vi' ? 'BẮT BUỘC NHẬP' : 'VALUE REQUIRED') : (language === 'vi' ? 'NHẬP SỐ HỢP LỆ' : 'ENTER A NUMBER')}</span>}
        {isWarning && field.range && <span className="text-warning">{language === 'vi' ? 'CẢNH BÁO' : 'WARNING'} · {t('expected')} {field.range[0]}–{field.range[1]} {field.unit}</span>}
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
        <div className={`scouring-record-grid scouring-record-grid-${columns} grid bg-white px-3 pb-3`}>
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
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const [values, setValues] = useState<RecordValues>(initialValues);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showProcessWarning, setShowProcessWarning] = useState(false);
  const [entryMode, setEntryMode] = useState<'operation' | 'ph'>(() => searchParams.get('tab') === 'ph' ? 'ph' : 'operation');
  const [production, setProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState(false);
  const [savedOrderRecords, setSavedOrderRecords] = useState<ScouringRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<ScouringRecord[]>([]);
  const [todayPhInspections, setTodayPhInspections] = useState<ScouringPhInspection[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [phValues, setPhValues] = useState<Record<number, string>>({});
  const [phNote, setPhNote] = useState('');
  const [phError, setPhError] = useState<string | null>(null);
  const [phSaving, setPhSaving] = useState(false);
  const [showPhSaved, setShowPhSaved] = useState(false);

  useEffect(() => {
    if (!saveError) return;
    const timer = window.setTimeout(() => setSaveError(null), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [saveError]);

  useEffect(() => {
    if (!progressError) return;
    const timer = window.setTimeout(() => setProgressError(null), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [progressError]);

  useEffect(() => {
    if (!phError) return;
    const timer = window.setTimeout(() => setPhError(null), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [phError]);

  useEffect(() => {
    if (!showSaveSuccess) return;
    const timer = window.setTimeout(() => setShowSaveSuccess(false), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [showSaveSuccess]);

  useEffect(() => {
    if (!showProcessWarning) return;
    const timer = window.setTimeout(() => setShowProcessWarning(false), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [showProcessWarning]);

  useEffect(() => {
    if (!showPhSaved) return;
    const timer = window.setTimeout(() => setShowPhSaved(false), TRANSIENT_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [showPhSaved]);

  useEffect(() => {
    let active = true;
    setTodayLoading(true);
    Promise.all([getScouringRecords(), getScouringPhInspections()])
      .then(([records, inspections]) => {
        if (!active) return;
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const isToday = (value: string) => {
          const date = new Date(value);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === todayKey;
        };
        setTodayRecords(records.filter((record) => isToday(record.recordedAt)).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id - a.id));
        setTodayPhInspections(inspections.filter((inspection) => isToday(inspection.inspectedAt)));
      })
      .catch(() => { if (active) { setTodayRecords([]); setTodayPhInspections([]); } })
      .finally(() => { if (active) setTodayLoading(false); });
    return () => { active = false; };
  }, [todayRefreshKey]);

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
      setProgressError(localizedRequestError(error, language, 'progress'));
    } finally { setProgressSaving(false); }
  };

  const updateValue = (key: RecordFieldKey, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === 'outputFabricMeters') next.lossMeters = calculateLoss(current.inputFabricMeters, value);
      return next;
    });
  };

  const selectRecordForEditing = (record: ScouringRecord) => {
    setEditingRecordId(record.id);
    setSaveAttempted(false);
    setSaveError(null);
    setSaveSuccess(false);
    setShowSaveSuccess(false);
    setValues((current) => ({
      ...current,
      orderNumber: record.orderNumber ?? current.orderNumber,
      item: record.item ?? '',
      lotYarn: record.lotYarn ?? '',
      lotNumber: record.lotNumber ?? '',
      operatorName: record.operatorName ?? '',
      operatorIdentifier: record.operatorIdentifier ?? '',
      shift: normalizeShift(record.shift) || record.shift || '',
      orderProgress: record.orderProgress ?? 'IN_PROGRESS',
      naoh: String(record.naoh), soap: String(record.soap), desizer: String(record.desizer),
      h2o2: String(record.h2o2), chelate: String(record.chelate), speed: String(record.speed),
      temperature: String(record.temperature), cylinderTemperature: String(record.cylinderTemperature),
      inputFabricMeters: record.inputFabricMeters == null ? '' : String(record.inputFabricMeters),
      outputFabricMeters: record.outputFabricMeters == null ? '' : String(record.outputFabricMeters),
      lossMeters: record.lossMeters == null ? '' : String(record.lossMeters),
    }));
  };

  const cancelEditing = () => {
    setEditingRecordId(null);
    setSaveAttempted(false);
    setSaveError(null);
    setSaveSuccess(false);
    setShowSaveSuccess(false);
    setValues((current) => ({ ...initialValues, orderNumber: current.orderNumber }));
  };

  const removeTodayRecord = async (record: ScouringRecord) => {
    const relatedChecks = todayPhInspections.filter((inspection) => inspection.scouringRecordId === record.id).length;
    const recordedTime = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recordedAt));
    const prompt = language === 'vi'
      ? `Xóa bản ghi SOP ${record.orderNumber || '—'} lúc ${recordedTime}${relatedChecks ? ` và ${relatedChecks} checklist pH liên quan` : ''}? Thao tác này không thể hoàn tác.`
      : `Delete the SOP ${record.orderNumber || '—'} record from ${recordedTime}${relatedChecks ? ` and its ${relatedChecks} related pH checklist(s)` : ''}? This cannot be undone.`;
    if (!window.confirm(prompt) || deletingRecordId !== null) return;
    setDeletingRecordId(record.id);
    setSaveError(null);
    try {
      await deleteScouringRecord(record.id);
      setTodayRecords((records) => records.filter((item) => item.id !== record.id));
      setTodayPhInspections((inspections) => inspections.filter((item) => item.scouringRecordId !== record.id));
      setSavedOrderRecords((records) => records.filter((item) => item.id !== record.id));
      if (editingRecordId === record.id) cancelEditing();
    } catch (error) {
      setSaveError(localizedRequestError(error, language, 'record'));
    } finally {
      setDeletingRecordId(null);
    }
  };

  const hasBlockingErrors = [...chemicalFields, ...processFields, ...productionFields]
    .some((field) => fieldMessage(values[field.key], field) === 'missing');

  const saveRecord = async () => {
    setSaveAttempted(true);
    setShowProcessWarning(processFields.some((field) => fieldMessage(values[field.key], field) === 'warning'));
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
        orderNumber: editingRecordId === null
          ? values.orderNumber.trim() || null
          : savedOrderRecords.find((record) => record.id === editingRecordId)?.orderNumber ?? (values.orderNumber.trim() || null),
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
      const saved = editingRecordId === null
        ? await createScouringRecord(payload)
        : await updateScouringRecord(editingRecordId, payload);
      setSavedOrderRecords((records) => editingRecordId === null
        ? [saved, ...records]
        : records.map((record) => record.id === saved.id ? saved : record).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id - a.id));
      setTodayRefreshKey((key) => key + 1);
      setSaveSuccess(true);
      setShowSaveSuccess(true);
    } catch (error) {
      setSaveError(localizedRequestError(error, language, 'record'));
    } finally {
      setSaving(false);
    }
  };

  const savePhInspection = async () => {
    if (phSaving) return;
    if (!selectedOrderRecord) { setPhError(language === 'vi' ? 'Hãy lưu thông số của đơn này trước khi ghi checklist pH.' : 'Save operation data for this order before the pH checklist.'); return; }
    const tankPh = Array.from({ length: 8 }, (_, tank) => phValues[tank]?.trim() ? Number(phValues[tank]) : null);
    if (!tankPh.some((value) => value !== null && Number.isFinite(value))) { setPhError(language === 'vi' ? 'Nhập ít nhất một giá trị pH.' : 'Enter at least one pH value.'); return; }
    setPhSaving(true); setPhError(null);
    try {
      await createScouringPhInspection({ scouringRecordId: selectedOrderRecord.id, operatorName: values.operatorName.trim() || selectedOrderRecord.operatorName || null, tankPh, note: phNote.trim() || null });
      setTodayRefreshKey((key) => key + 1);
      setPhValues({});
      setPhNote('');
      setShowPhSaved(true);
    } catch (error) { setPhError(localizedRequestError(error, language, 'ph')); }
    finally { setPhSaving(false); }
  };

  return (
    <WS3Shell title={language === 'vi' ? 'WS3 / Ghi nhận Scouring' : 'WS3 / Scouring Record'} subtitle={language === 'vi' ? 'Nhập dữ liệu vận hành · Scouring' : 'Operator data entry · Scouring'} machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB')} showSupportWidget={!isScouringOperator}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
        <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden bg-hmiConsole">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <div className={`scouring-record-workspace grid w-full min-h-full grid-cols-[minmax(0,0.85fr)_minmax(0,3.15fr)] gap-2 ${isScouringOperator ? 'scouring-record-workspace-with-notices' : ''}`}>
            <aside className="scouring-record-context flex h-full min-h-0 self-stretch flex-col border-2 border-industrialDark bg-white">
              <header className="flex h-12 min-h-12 items-center border-b-2 border-industrialDark bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-industrialDark">
                <h2 className="whitespace-nowrap">{language === 'vi' ? 'Thông tin vận hành' : 'Operation details'}</h2>
              </header>
              <OperationInfoFields orderNumber={values.orderNumber} orderNumberDisabled={editingRecordId !== null} onOrderNumberChange={(orderNumber) => { setProduction(null); setSavedOrderRecords([]); setEditingRecordId(null); setSaveAttempted(false); setSaveError(null); setSaveSuccess(false); setShowSaveSuccess(false); setShowPhSaved(false); setPhValues({}); setPhNote(''); setPhError(null); setProgressError(null); setValues((current) => ({ ...current, orderNumber, operatorName: '', operatorIdentifier: '', shift: '', orderProgress: 'IN_PROGRESS', inputFabricMeters: '', outputFabricMeters: '', lossMeters: '' })); }} operatorName={values.operatorName} onOperatorNameChange={(operatorName) => setValues((current) => ({ ...current, operatorName }))} employeeId={values.operatorIdentifier} onEmployeeIdChange={(operatorIdentifier) => setValues((current) => ({ ...current, operatorIdentifier }))} shift={values.shift} onShiftChange={(shift) => setValues((current) => ({ ...current, shift }))} orderStatus={<label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark disabled:bg-hmiSection disabled:text-slate-400" value={values.orderProgress} disabled={!production || progressSaving} onChange={(event) => void changeOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}><option value="IN_PROGRESS">{language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option><option value="COMPLETED">{language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option></select>{progressSaving && <span className="text-[9px] normal-case text-info">{language === 'vi' ? 'Đang lưu…' : 'Saving…'}</span>}{progressError && <span role="alert" className="text-[9px] normal-case text-alarm">{progressError}</span>}</label>} />
            </aside>

            <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-2 border-industrialDark bg-white">
              <nav className="flex h-12 min-h-12 shrink-0 border-b-2 border-line bg-white" aria-label={language === 'vi' ? 'Loại ghi nhận Scouring' : 'Scouring entry type'}>{(['operation', 'ph'] as const).map((mode) => <button key={mode} type="button" aria-pressed={entryMode === mode} onClick={() => setEntryMode(mode)} className={`h-full min-h-10 flex-1 border-b-2 px-3 text-[10px] font-bold uppercase tracking-wide ${entryMode === mode ? 'border-industrialDark bg-industrialDark text-white' : 'border-transparent text-slate-500'}`}>{mode === 'operation' ? (language === 'vi' ? 'Thông số vận hành' : 'Operation parameters') : (language === 'vi' ? 'Checklist pH' : 'pH checklist')}</button>)}</nav>
                {(productionLoading || productionError || (normalizedOrderNumber && !productionLoading && !productionError && !production)) && <div className="shrink-0 border-b border-line bg-white px-3 py-2 text-[10px]"><p role="status" className="font-bold text-warning">{productionLoading ? (language === 'vi' ? 'Đang đối chiếu dữ liệu MES…' : 'Looking up MES data…') : productionError ? (language === 'vi' ? 'Không tải được dữ liệu MES.' : 'MES data could not be loaded.') : (language === 'vi' ? 'Không tìm thấy mã đơn trong dữ liệu MES.' : 'Order not found in MES data.')}</p></div>}
              <div className="min-h-0 flex-[1.15] overflow-auto">
              {entryMode === 'ph' ? <section className="min-w-0 p-3"><header className="mb-3 flex justify-end border-b border-line pb-2"><span className="font-mono text-[9px] text-slate-500">8 {t('tanks')}</span></header>{selectedOrderRecord ? <p className="mb-3 text-[10px] text-slate-600">{t('operationRecord')}: <strong className="font-mono text-industrial">{selectedOrderRecord.orderNumber || '—'}</strong> · {selectedOrderRecord.item || '—'} · {selectedOrderRecord.lotNumber || '—'}</p> : <p className="mb-3 border border-warning bg-hmiWarning p-2 text-[10px] font-bold text-warning">{language === 'vi' ? 'Cần lưu thông số của đơn này trước khi ghi checklist pH.' : 'Save operation data for this order before the pH checklist.'}</p>}<div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, tank) => <label key={tank} className="grid min-w-0 gap-1 p-2"><span className="text-[10px] font-bold uppercase text-industrial">{t('tank')} {tank}</span><span className="flex h-12 min-w-0 border-2 border-line"><input type="number" inputMode="decimal" step="any" value={phValues[tank] ?? ''} onChange={(event) => setPhValues((current) => ({ ...current, [tank]: event.target.value }))} className="min-w-0 flex-1 text-center font-mono text-lg font-bold text-industrial outline-none" aria-label={`${t('tank')} ${tank} pH`} /><span className="flex w-10 shrink-0 items-center justify-center border-l-2 border-line bg-surfaceMuted font-mono text-[10px] font-bold">pH</span></span></label>)}</div><div className="mt-3 min-w-0"><label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase text-slate-500">{t('note')}<input value={phNote} onChange={(event) => setPhNote(event.target.value)} className="min-h-9 min-w-0 border-2 border-line px-2 text-xs font-semibold normal-case" /></label></div>{phError && <p role="alert" className="mt-3 border border-alarm bg-hmiAlarm p-2 text-[10px] font-bold text-alarm">{phError}</p>}{showPhSaved && <p role="status" className="mt-3 border border-success bg-hmiNormal p-2 text-[10px] font-bold text-success">{language === 'vi' ? 'ĐÃ LƯU CHECKLIST pH' : 'pH CHECKLIST SAVED'}</p>}</section> : <>
              <>
                <section className="scouring-record-group border border-line bg-white">
                  <div className="grid gap-3 p-3 xl:grid-cols-3">
                    <section className="min-w-0">
                      <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{t('chemicalInput')}</h3>
                      <FieldGrid fields={chemicalFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={2} />
                    </section>
                    <section className="min-w-0">
                      <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{t('processConditions')}</h3>
                      <FieldGrid fields={processFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={2} />
                    </section>
                    <section className="min-w-0">
                      <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{t('production')}</h3>
                      <FieldGrid fields={productionFields} values={values} showValidation={saveAttempted} onChange={updateValue} columns={2} />
                      {!values.inputFabricMeters && <p className="px-2 pb-1 text-[9px] font-semibold uppercase text-warning">{language === 'vi' ? 'MES chưa có đủ mét cuộn để tự điền vải đầu vào.' : 'MES does not have all roll lengths needed to fill fabric input.'}</p>}
                    </section>
                  </div>
                </section>
              </>
              {showProcessWarning && processFields.some((field) => fieldMessage(values[field.key], field) === 'warning') && <div className="border border-warning bg-hmiWarning px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-warning">{language === 'vi' ? 'CẢNH BÁO THÔNG SỐ · Giá trị ngoài khoảng chuẩn vẫn có thể được lưu.' : 'DATA / PROCESS WARNING · Values outside the expected range can still be saved.'}</div>}
              {saveAttempted && hasBlockingErrors && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">{t('completeRequired')}</div>}
              {saveError && <div className="border border-alarm bg-hmiAlarm px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-alarm">{language === 'vi' ? 'LỖI LƯU' : 'SAVE ERROR'} · {saveError}</div>}
              {showSaveSuccess && <div role="status" className="border border-success bg-hmiNormal px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-success">{editingRecordId !== null ? (language === 'vi' ? 'ĐÃ CẬP NHẬT BẢN GHI · Lịch sử giữ nguyên một dòng.' : 'RECORD UPDATED · The history still shows one row.') : (language === 'vi' ? 'ĐÃ LƯU BẢN GHI · Có thể tiếp tục nhập checklist pH.' : 'RECORD SAVED · You can continue with the pH checklist.')}</div>}
              </>}
              </div>
              <div className="flex shrink-0 justify-end border-t border-line bg-white px-3 py-2">
                {entryMode === 'operation' ? <HMIButton size="compact" variant="primary" disabled={saving || saveSuccess || productionLoading || !production || !values.orderNumber.trim()} onClick={saveRecord}>{saving ? t('saving') : editingRecordId !== null ? (language === 'vi' ? 'CẬP NHẬT BẢN GHI' : 'UPDATE RECORD') : t('saveRecord')}</HMIButton> : <HMIButton size="compact" variant="primary" disabled={phSaving || !selectedOrderRecord} onClick={() => void savePhInspection()}>{phSaving ? t('saving') : t('saveCheck')}</HMIButton>}
              </div>
              <section className="flex min-h-[190px] flex-[0.85] flex-col border-t border-line bg-white">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white"><span>{language === 'vi' ? 'HÔM NAY' : 'TODAY'}</span><div className="flex items-center gap-3">{editingRecordId !== null && <button type="button" className="text-[9px] font-bold uppercase text-white underline" onClick={cancelEditing}>{language === 'vi' ? 'Bỏ sửa' : 'Cancel edit'}</button>}</div></header>
                <div className="min-h-0 flex-1 overflow-auto bg-white p-2">
                  <table className="w-full min-w-[1240px] border-collapse text-left text-[10px]"><thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark"><tr><th className="px-3 py-2">{t('time')}</th><th className="px-3 py-2">SOP</th><th className="px-3 py-2">{language === 'vi' ? 'Người vận hành' : 'Operator'}</th><th className="px-3 py-2">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</th><th className="px-3 py-2">{language === 'vi' ? 'Ca' : 'Shift'}</th><th className="px-3 py-2">NaOH</th><th className="px-3 py-2">{t('speed')}</th><th className="px-3 py-2">{t('temperature')}</th><th className="px-3 py-2">{language === 'vi' ? 'Đầu ra (m)' : 'Output (m)'}</th><th className="px-3 py-2">pH</th><th className="px-2 py-2 text-center"></th></tr></thead><tbody>
                    {todayLoading ? <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">{language === 'vi' ? 'Đang tải bản ghi…' : 'Loading records…'}</td></tr> : todayRecords.length === 0 ? <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">{language === 'vi' ? 'Chưa có bản ghi trong ngày hôm nay.' : 'No records today.'}</td></tr> : todayRecords.map((record) => {
                      const checks = todayPhInspections.filter((inspection) => inspection.scouringRecordId === record.id).sort((a, b) => Date.parse(b.inspectedAt) - Date.parse(a.inspectedAt) || b.id - a.id);
                      const latestCheck = checks[0];
                      const latestValues = latestCheck?.tankPh.map((value, index) => `${index}: ${value ?? '—'}`).join(' · ');
                      return <tr key={record.id} className={`border-b border-line hover:bg-hmiHover ${editingRecordId === record.id ? 'bg-hmiSelected' : 'bg-white'}`}><td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-industrial">{new Date(record.recordedAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</td><td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">{record.orderNumber || '—'}</td><td className="px-3 py-2">{record.operatorName || '—'}</td><td className="px-3 py-2 font-mono">{record.operatorIdentifier || '—'}</td><td className="px-3 py-2">{localizedShift(record.shift, language)}</td><td className="px-3 py-2 text-right font-mono">{record.naoh}</td><td className="px-3 py-2 text-right font-mono">{record.speed}</td><td className="px-3 py-2 text-right font-mono">{record.temperature}°</td><td className="px-3 py-2 text-right font-mono">{record.outputFabricMeters ?? '—'}</td><td className="px-3 py-2">{checks.length ? <span title={checks.map((check, checkIndex) => `${language === 'vi' ? 'Lần' : 'Check'} ${checkIndex + 1}: ${check.tankPh.map((value, index) => `B${index}: ${value ?? '—'}`).join(' · ')}`).join('\n')} className="block font-semibold text-success"><span>{language === 'vi' ? `${checks.length} lần` : `${checks.length} checks`}</span>{latestValues && <span className="mt-0.5 block max-w-[320px] truncate text-[9px] font-normal text-slate-600">{latestValues}</span>}</span> : <span className="text-slate-400">—</span>}</td><td className="px-2 py-2 text-center"><button type="button" className="inline-flex h-7 w-7 items-center justify-center border border-alarm text-alarm hover:bg-red-50 disabled:cursor-wait disabled:opacity-50" title={language === 'vi' ? 'Xóa bản ghi' : 'Delete record'} aria-label={language === 'vi' ? 'Xóa bản ghi' : 'Delete record'} disabled={deletingRecordId === record.id} onClick={() => void removeTodayRecord(record)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13" /></svg></button></td></tr>;
                    })}
                  </tbody></table>
                </div>
              </section>
              </section>
            {isScouringOperator && <div className="scouring-record-notices min-w-0"><SupportChatWidget embedded /></div>}
          </div>
        </div>
        </div>
      </div>
    </WS3Shell>
  );
}
