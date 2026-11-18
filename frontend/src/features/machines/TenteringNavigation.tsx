import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';

export const TENTERING_MACHINES = [
  { id: 'TE-01', label: 'TENTER 1' },
  { id: 'TE-02', label: 'TENTER 2' },
] as const;

export function TenteringMachineSelect({
  machineId,
  history = false,
  visibleLabel = false,
  className,
}: {
  machineId: string;
  history?: boolean;
  visibleLabel?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';
  const availableMachines = isOperator
    ? TENTERING_MACHINES.filter((item) => user.machineIds.includes(item.id))
    : TENTERING_MACHINES;
  const selectedMachine =
    availableMachines.find((item) => item.id === machineId) ?? availableMachines[0];
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const selectId = `tentering-machine-select-${history ? 'history' : 'record'}`;

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [open]);

  const chooseMachine = (nextMachineId: string) => {
    setOpen(false);
    if (selectedMachine && nextMachineId !== selectedMachine.id)
      navigate(`/machine/${nextMachineId}/${history ? 'history' : 'record'}`);
  };
  if (!selectedMachine) return null;

  if (availableMachines.length < 2) {
    return visibleLabel ? (
      <div className="tentering-machine-field">
        <span className="tentering-machine-field__label">
          {language === 'vi' ? 'Máy' : 'Machine'}
        </span>
        <span className="tentering-machine-field__value">{selectedMachine.label}</span>
      </div>
    ) : null;
  }

  return (
    <div
      ref={fieldRef}
      className={`tentering-machine-field${visibleLabel ? '' : ' tentering-machine-field--compact'}`}
    >
      {visibleLabel && (
        <span className="tentering-machine-field__label">
          {language === 'vi' ? 'Máy' : 'Machine'}
        </span>
      )}
      <span className="tentering-machine-field__select-wrap">
        <button
          id={selectId}
          type="button"
          className={`tentering-machine-field__select-trigger${className ? ` ${className}` : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${selectId}-menu`}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span>{selectedMachine.label}</span>
          <span aria-hidden="true" className="tentering-machine-field__arrow" />
        </button>
        {open && (
          <span
            id={`${selectId}-menu`}
            className="tentering-machine-field__menu"
            role="listbox"
            aria-label={language === 'vi' ? 'Chọn máy Tentering' : 'Select Tentering machine'}
          >
            {availableMachines.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === selectedMachine.id}
                className="tentering-machine-field__option"
                onClick={() => chooseMachine(item.id)}
              >
                {item.label}
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

export function TenteringNavigation({
  machineId,
  history = false,
  showMachineSelector = true,
}: {
  machineId: string;
  history?: boolean;
  showMachineSelector?: boolean;
}) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';
  const machine = TENTERING_MACHINES.find((item) => item.id === machineId) ?? TENTERING_MACHINES[0];

  const tx = (vi: string, en: string) => (language === 'vi' ? vi : en);
  return (
    <nav className="tentering-mes-nav" aria-label={`${machine.label} navigation`}>
      <NavLink end to="/ws3">
        {tx('Máy móc', 'Machinery')}
      </NavLink>
      <NavLink end to={`/machine/${machine.id}/record`}>
        {tx('Vận hành', 'Operation')}
      </NavLink>
      {!isOperator && (
        <NavLink end to={`/machine/${machine.id}/history`}>
          {tx('Lịch sử', 'History')}
        </NavLink>
      )}
      {showMachineSelector && <TenteringMachineSelect machineId={machineId} history={history} />}
    </nav>
  );
}
