import type { TenteringOrder, TenteringOrderInput, TenteringOrderSource } from './tenteringApi';
import type { HeaderDraft, RollDraft, TenteringDashboardOrder } from './tenteringRecordTypes';
import { formatDateOnly } from '../../shared/formatters/date';
import { formatNumber } from '../../shared/formatters/number';

export const emptyHeader: HeaderDraft = {
  operatorName: '',
  operatorIdentifier: '',
  shift: '',
  customer: '',
  itemDescription: '',
  warpYarn: '',
  weftYarn: '',
  greigeDensityPick: '',
  finishDensityPick: '',
  shrinkPercent: '',
  greigeWidthInch: '',
  finishWidthInch: '',
};

/** Create blank roll rows for a new or partially known Tentering order. */
export function emptyRolls(count = 0): RollDraft[] {
  return Array.from({ length: count }, (_, index) => ({
    rollNumber: index + 1,
    savedEntryId: undefined,
    rollId: '',
    tenterDate: '',
    weavingDate: '',
    plannedQuantity: '',
    actualQuantity: '',
    note: '',
  }));
}

/** Convert an optional numeric form value to the API representation. */
export function numeric(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

/** Format a date-only form value using the active application language. */
export function displayDate(value: string, language: string): string {
  return formatDateOnly(value, language);
}

/** Show a width entered in inches as centimeters for operator reference. */
export function toCentimeters(value: string): string {
  const inches = numeric(value);
  return inches === null || !Number.isFinite(inches)
    ? '—'
    : `${formatNumber(inches * 2.54, 'vi', 1)} cm`;
}

/** Map a persisted Tentering order into the editable header draft. */
export function headerFromOrder(order: TenteringOrder): HeaderDraft {
  return {
    operatorName: order.operator_name ?? '',
    operatorIdentifier: order.operator_identifier ?? '',
    shift: order.shift ?? '',
    customer: order.customer ?? '',
    itemDescription: order.item_description ?? '',
    warpYarn: order.warp_yarn ?? '',
    weftYarn: order.weft_yarn ?? '',
    greigeDensityPick: order.greige_density_pick?.toString() ?? '',
    finishDensityPick: order.finish_density_pick?.toString() ?? '',
    shrinkPercent: order.shrink_percent?.toString() ?? '',
    greigeWidthInch: order.greige_width_inch?.toString() ?? '',
    finishWidthInch: order.finish_width_inch?.toString() ?? '',
  };
}

/** Map persisted roll entries into the editable roll draft. */
export function rollsFromOrder(order: TenteringOrder): RollDraft[] {
  const lastSavedRoll = Math.max(0, ...order.entries.map((entry) => entry.roll_number));
  const result = emptyRolls(lastSavedRoll);
  for (const entry of order.entries) {
    result[entry.roll_number - 1] = {
      rollNumber: entry.roll_number,
      savedEntryId: entry.id,
      rollId: entry.roll_id ?? '',
      tenterDate: entry.tenter_date ?? '',
      weavingDate: entry.weaving_date ?? '',
      plannedQuantity: entry.planned_quantity?.toString() ?? '',
      actualQuantity: entry.actual_quantity?.toString() ?? '',
      note: entry.note ?? '',
    };
  }
  return result;
}

/** Merge MES source-roll values into the current editable draft. */
export function applySourceRolls(
  rolls: RollDraft[],
  source: TenteringOrderSource | null,
): RollDraft[] {
  if (!source) return rolls;
  const rollCount = Math.max(
    rolls.length,
    source.total_rolls,
    ...source.rolls.map((roll) => roll.roll_number),
  );
  const expanded =
    rollCount > rolls.length ? [...rolls, ...emptyRolls(rollCount).slice(rolls.length)] : rolls;
  return source.rolls.reduce(
    (current, sourceRoll) =>
      current.map((row) =>
        row.rollNumber === sourceRoll.roll_number
          ? {
              ...row,
              rollId: sourceRoll.roll_id ?? row.rollId,
              weavingDate: sourceRoll.weaving_date ?? row.weavingDate,
              plannedQuantity: sourceRoll.length_meters?.toString() ?? row.plannedQuantity,
            }
          : row,
      ),
    expanded,
  );
}

/** Build the API payload from the current Tentering form drafts. */
export function inputFromDraft(
  header: HeaderDraft,
  rolls: RollDraft[],
  orderProgress: TenteringOrderInput['order_progress'],
): TenteringOrderInput {
  return {
    operator_name: header.operatorName.trim() || null,
    operator_identifier: header.operatorIdentifier.trim() || null,
    shift: header.shift || null,
    order_progress: orderProgress,
    customer: header.customer.trim() || null,
    item_description: header.itemDescription.trim() || null,
    warp_yarn: header.warpYarn.trim() || null,
    weft_yarn: header.weftYarn.trim() || null,
    greige_density_pick: numeric(header.greigeDensityPick),
    finish_density_pick: numeric(header.finishDensityPick),
    shrink_percent: numeric(header.shrinkPercent),
    greige_width_inch: numeric(header.greigeWidthInch),
    finish_width_inch: numeric(header.finishWidthInch),
    fabric_received_date: null,
    entries: rolls
      .filter(
        (row) =>
          row.rollId ||
          row.tenterDate ||
          row.weavingDate ||
          row.plannedQuantity ||
          row.actualQuantity ||
          row.note.trim(),
      )
      .map((row) => ({
        roll_number: row.rollNumber,
        roll_id: row.rollId || null,
        tenter_date: row.tenterDate || null,
        weaving_date: row.weavingDate || null,
        planned_quantity: numeric(row.plannedQuantity),
        actual_quantity: numeric(row.actualQuantity),
        note: row.note.trim() || null,
      })),
  };
}

/** Convert a saved order into the compact row used by the live dashboard. */
export function dashboardOrderFromOrder(order: TenteringOrder): TenteringDashboardOrder {
  const plannedValues = order.entries
    .map((entry) => entry.planned_quantity)
    .filter((value): value is number => value !== null);
  const actualValues = order.entries
    .map((entry) => entry.actual_quantity)
    .filter((value): value is number => value !== null);
  return {
    sopNo: order.sop_no,
    customer: order.customer ?? '',
    itemDescription: order.item_description ?? '',
    operatorName: order.operator_name ?? '',
    shift: order.shift ?? '',
    plannedQuantity: plannedValues.length
      ? plannedValues.reduce((sum, value) => sum + value, 0)
      : null,
    actualQuantity: actualValues.length
      ? actualValues.reduce((sum, value) => sum + value, 0)
      : null,
    rollCount: order.entries.length,
    progress: order.order_progress,
  };
}
