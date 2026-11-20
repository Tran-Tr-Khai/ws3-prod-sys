import type { BuffingCheck, BuffingImage } from './buffingApi';

/** Identify the active browser or industrial camera source. */
export type SelectedCamera = { source: 'browser' | 'mvs'; id: string };

/** View-model row used by the Buffing history table. */
export type BuffingCheckRow = {
  id: number;
  time: string;
  operator: string;
  operatorIdentifier: string;
  shift: string;
  orderNumber: string;
  orderProgress: BuffingCheck['orderProgress'];
  checks: boolean[];
  remark: string;
  images: BuffingImage[];
};
