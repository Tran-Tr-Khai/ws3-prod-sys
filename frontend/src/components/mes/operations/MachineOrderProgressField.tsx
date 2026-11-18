type MachineOrderProgressFieldProps = {
  value: 'IN_PROGRESS' | 'COMPLETED';
  language: string;
  automatic: boolean;
  disabled?: boolean;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onChange?: (value: 'IN_PROGRESS' | 'COMPLETED') => void;
};

/**
 * Show or edit the current production-order progress for a machine.
 *
 * In automatic mode the MES owns the value; in manual mode the operator can
 * select the next state and the parent persists that decision.
 */
export function MachineOrderProgressField({
  value,
  language,
  automatic,
  disabled = false,
  loading = false,
  saving = false,
  error,
  onChange,
}: MachineOrderProgressFieldProps) {
  const vi = language === 'vi';
  const label = vi ? 'Tiến độ đơn' : 'Order progress';
  const valueLabel =
    value === 'COMPLETED'
      ? vi
        ? 'ĐÃ HOÀN THÀNH'
        : 'COMPLETED'
      : vi
        ? 'ĐANG XỬ LÝ'
        : 'IN PROGRESS';

  if (automatic) {
    return (
      <div className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
        <span>{label}</span>
        <div className="flex min-h-9 items-center border-2 border-line bg-surfaceMuted px-2 text-xs font-bold text-industrialDark">
          {valueLabel}
        </div>
        <span className="text-[9px] font-normal normal-case text-slate-500">
          {vi
            ? 'Hệ thống tự cập nhật sau khi lưu SOP mới.'
            : 'Updated automatically after saving the new SOP.'}
        </span>
      </div>
    );
  }

  return (
    <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
      {label}
      <select
        className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark disabled:bg-surfaceMuted disabled:text-slate-400"
        value={value}
        disabled={disabled || loading || saving}
        onChange={(event) => onChange?.(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}
      >
        <option value="IN_PROGRESS">{vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option>
        <option value="COMPLETED">{vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option>
      </select>
      {loading && (
        <span className="text-[9px] normal-case text-info">
          {vi ? 'Đang tra đơn…' : 'Looking up order…'}
        </span>
      )}
      {saving && (
        <span className="text-[9px] normal-case text-info">{vi ? 'Đang lưu…' : 'Saving…'}</span>
      )}
      {error && (
        <span role="alert" className="text-[9px] normal-case text-alarm">
          {error}
        </span>
      )}
    </label>
  );
}
