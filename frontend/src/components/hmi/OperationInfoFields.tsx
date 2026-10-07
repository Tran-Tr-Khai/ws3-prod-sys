import { ShiftSelect } from './ShiftSelect';
import { useLanguage } from '../../i18n/LanguageContext';

type OperationInfoFieldsProps = {
  orderNumber: string;
  onOrderNumberChange: (value: string) => void;
  orderNumberDisabled?: boolean;
  operatorName: string;
  onOperatorNameChange: (value: string) => void;
  employeeId: string;
  onEmployeeIdChange: (value: string) => void;
  shift: string;
  onShiftChange: (value: string) => void;
  orderStatus?: React.ReactNode;
};

export function OperationInfoFields({ orderNumber, onOrderNumberChange, orderNumberDisabled = false, operatorName, onOperatorNameChange, employeeId, onEmployeeIdChange, shift, onShiftChange, orderStatus }: OperationInfoFieldsProps) {
  const { language, t } = useLanguage();
  return <div className="buffing-meta grid content-start gap-3 p-3">
    <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Mã SOP / đơn sản xuất' : 'SOP / production order'}
      <input className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold uppercase text-industrialDark disabled:bg-hmiSection disabled:text-slate-500" value={orderNumber} disabled={orderNumberDisabled} onChange={(event) => onOrderNumberChange(event.target.value)} placeholder={language === 'vi' ? 'Nhập mã SOP…' : 'Enter SOP number…'} maxLength={160} />
    </label>
    <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{t('operator')}<input className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold" value={operatorName} onChange={(event) => onOperatorNameChange(event.target.value)} placeholder={t('enterOperator')} /></label>
    <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}<input className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold" value={employeeId} onChange={(event) => onEmployeeIdChange(event.target.value)} placeholder={language === 'vi' ? 'Nhập ID nhân viên' : 'Enter employee ID'} /></label>
    <ShiftSelect value={shift} onChange={onShiftChange} />
    {orderStatus}
  </div>;
}
