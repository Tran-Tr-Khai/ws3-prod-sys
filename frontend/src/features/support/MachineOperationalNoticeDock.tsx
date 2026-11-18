import { useAuth } from '../../auth/useAuth';
import { SupportChatWidget } from './SupportChatWidget';
import { isOperatorAssignedToMachine } from './machineAssignment';

type MachineOperationalNoticeDockProps = { machineId: string };

export function MachineOperationalNoticeDock({ machineId }: MachineOperationalNoticeDockProps) {
  const { user } = useAuth();
  if (!isOperatorAssignedToMachine(user, machineId)) return null;

  return (
    <div className="machine-operational-notice-dock min-w-0">
      <SupportChatWidget embedded />
    </div>
  );
}
