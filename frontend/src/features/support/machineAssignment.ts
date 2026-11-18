/**
 * Determine whether an operator is assigned to the selected machine family.
 *
 * Machine assignments are stored as individual machine IDs. The support dock
 * is shared by related machines, so it compares the stable prefix as well.
 */
export function isOperatorAssignedToMachine(
  user: { role?: string; machineIds?: string[] } | null | undefined,
  machineId: string,
): boolean {
  if (user?.role !== 'OPERATOR') return false;
  const prefix = machineId.trim().toUpperCase().split('-', 1)[0];
  return (user.machineIds ?? []).some((assignedId) =>
    assignedId.trim().toUpperCase().startsWith(`${prefix}-`),
  );
}
