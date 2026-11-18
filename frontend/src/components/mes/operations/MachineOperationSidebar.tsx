import type { ReactNode } from 'react';
import { OperationInfoFields, type OperationInfoFieldsProps } from './OperationInfoFields';
import './MachineOperationSidebar.css';

export type MachineOperationSidebarProps = Omit<OperationInfoFieldsProps, 'beforeFields'> & {
  beforeFields?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Shared MES operation rail used by every machine. Machine-specific fields stay as slots. */
export function MachineOperationSidebar({
  beforeFields,
  children,
  className,
  ...operationFields
}: MachineOperationSidebarProps) {
  return (
    <aside
      className={`buffing-no-print buffing-mes__operation machine-operation-sidebar${className ? ` ${className}` : ''}`}
    >
      <OperationInfoFields {...operationFields} beforeFields={beforeFields} />
      {children}
    </aside>
  );
}
