import { useLanguage } from '../../i18n/LanguageContext';

const shiftOptions = [
  { value: 'CA A', vi: 'CA A', en: 'SHIFT A' },
  { value: 'CA B', vi: 'CA B', en: 'SHIFT B' },
  { value: 'CA C', vi: 'CA C', en: 'SHIFT C' },
  { value: 'HÀNH CHÍNH', vi: 'HÀNH CHÍNH', en: 'ADMINISTRATIVE' },
] as const;

export function normalizeShift(value?: string | null): string {
  const normalized = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (['CA A', 'SHIFT A', 'A'].includes(normalized)) return 'CA A';
  if (['CA B', 'SHIFT B', 'B'].includes(normalized)) return 'CA B';
  if (['CA C', 'SHIFT C', 'C'].includes(normalized)) return 'CA C';
  if (['HANH CHINH', 'ADMINISTRATIVE', 'ADMIN'].includes(normalized)) return 'HÀNH CHÍNH';
  return '';
}

type ShiftSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ShiftSelect({ value, onChange }: ShiftSelectProps) {
  const { language } = useLanguage();
  return <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Ca làm' : 'Shift'}<select className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{language === 'vi' ? 'Chọn ca làm' : 'Select shift'}</option>{shiftOptions.map((option) => <option key={option.value} value={option.value}>{language === 'vi' ? option.vi : option.en}</option>)}</select></label>;
}
