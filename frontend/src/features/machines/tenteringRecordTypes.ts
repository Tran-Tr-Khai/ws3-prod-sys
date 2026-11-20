import type { TenteringOrder } from './tenteringApi';

export type RollDraft = {
  rollNumber: number;
  savedEntryId?: number;
  rollId: string;
  tenterDate: string;
  weavingDate: string;
  plannedQuantity: string;
  actualQuantity: string;
  note: string;
};

export type HeaderDraft = {
  operatorName: string;
  operatorIdentifier: string;
  shift: string;
  customer: string;
  itemDescription: string;
  warpYarn: string;
  weftYarn: string;
  greigeDensityPick: string;
  finishDensityPick: string;
  shrinkPercent: string;
  greigeWidthInch: string;
  finishWidthInch: string;
};

export type TenteringDashboardOrder = {
  sopNo: string;
  customer: string;
  itemDescription: string;
  operatorName: string;
  shift: string;
  plannedQuantity: number | null;
  actualQuantity: number | null;
  rollCount: number;
  progress: TenteringOrder['order_progress'];
};
