import { useAuth } from '../../auth/AuthContext';
import { SupportChatWidget } from './SupportChatWidget';

type MachineOperationalNoticeDockProps = { machineId: string };

export function isOperatorAssignedToMachine(user: { role?: string; machineIds?: string[] } | null | undefined, machineId: string): boolean {
  if (user?.role !== 'OPERATOR') return false;
  const prefix = machineId.trim().toUpperCase().split('-', 1)[0];
  return (user.machineIds ?? []).some((assignedId) => assignedId.trim().toUpperCase().startsWith(`${prefix}-`));
}

export function MachineOperationalNoticeDock({ machineId }: MachineOperationalNoticeDockProps) {
  const { user } = useAuth();
  if (!isOperatorAssignedToMachine(user, machineId)) return null;

  return (
    <div className="machine-operational-notice-dock min-w-0">
      <SupportChatWidget embedded />
    </div>
  );
}
