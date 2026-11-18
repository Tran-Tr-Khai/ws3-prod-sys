import { useLanguage } from '../../../i18n/useLanguage';
import { shiftOptions } from './shiftLabels';

type ShiftSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Render the shared shift selector used by machine operation forms. */
export function ShiftSelect({ value, onChange }: ShiftSelectProps) {
  const { language } = useLanguage();

  return (
    <label className="grid min-w-0 gap-1 text-[10px] font-bold tracking-wide text-slate-600">
      {language === 'vi' ? 'Ca làm' : 'Shift'}
      <select
        className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{language === 'vi' ? 'Chọn ca làm' : 'Select shift'}</option>
        {shiftOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {language === 'vi' ? option.vi : option.en}
          </option>
        ))}
      </select>
    </label>
  );
}
