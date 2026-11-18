import { useAuth } from '../../auth/useAuth';
import { getOverview, getOverviewDetails, getOverviewMes } from './machineOverviewApi';
import { useMachineCoreData } from './useMachineCoreData';

/** Every production card uses the same stages; each stage can succeed independently. */
export function useProgressiveMachineOverview(machineId: string) {
  const { user, canAccessMachine } = useAuth();
  const key = `${user?.username ?? ''}:${machineId}`;
  const enabled = canAccessMachine(machineId);
  const core = useMachineCoreData(key, enabled, (signal) => getOverview(machineId, signal));
  const record = core.data;
  const detailKey = `${key}:${record?.id ?? ''}:${record?.recorded ?? ''}`;
  const details = useMachineCoreData(detailKey, enabled && record !== null, (signal) =>
    record ? getOverviewDetails(record, signal) : Promise.resolve(null),
  );
  const mes = useMachineCoreData(detailKey, enabled && Boolean(record?.sop), (signal) =>
    record ? getOverviewMes(record, signal) : Promise.resolve(null),
  );
  return { core, details, mes };
}
