import { describe, expect, it } from 'vitest';
import { dashboardOrderFromOrder, inputFromDraft, toCentimeters } from './tenteringRecordUtils';
import type { TenteringOrder } from './tenteringApi';

describe('tentering record utilities', () => {
  it('converts inches to a readable centimeter value', () => {
    expect(toCentimeters('10')).toBe('25,4 cm');
    expect(toCentimeters('')).toBe('—');
  });

  it('builds an API payload without empty roll rows', () => {
    const payload = inputFromDraft(
      {
        operatorName: ' An ',
        operatorIdentifier: 'P10044',
        shift: 'HÀNH CHÍNH',
        customer: '',
        itemDescription: 'Polyester',
        warpYarn: '',
        weftYarn: '',
        greigeDensityPick: '28',
        finishDensityPick: '',
        shrinkPercent: '',
        greigeWidthInch: '65',
        finishWidthInch: '',
      },
      [
        {
          rollNumber: 1,
          savedEntryId: undefined,
          rollId: 'R-01',
          tenterDate: '',
          weavingDate: '',
          plannedQuantity: '100',
          actualQuantity: '',
          note: 'ok',
        },
        {
          rollNumber: 2,
          savedEntryId: undefined,
          rollId: '',
          tenterDate: '',
          weavingDate: '',
          plannedQuantity: '',
          actualQuantity: '',
          note: '',
        },
      ],
      'IN_PROGRESS',
    );

    expect(payload.operator_name).toBe('An');
    expect(payload.greige_density_pick).toBe(28);
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].roll_id).toBe('R-01');
  });

  it('summarizes planned and actual quantities for the dashboard', () => {
    const order = {
      sop_no: 'PD-01',
      customer: 'Customer',
      item_description: 'Fabric',
      operator_name: 'An',
      shift: 'A',
      order_progress: 'IN_PROGRESS',
      entries: [
        { id: 1, roll_number: 1, planned_quantity: 100, actual_quantity: 98 },
        { id: 2, roll_number: 2, planned_quantity: 50, actual_quantity: null },
      ],
    } as TenteringOrder;

    expect(dashboardOrderFromOrder(order)).toMatchObject({
      sopNo: 'PD-01',
      plannedQuantity: 150,
      actualQuantity: 98,
      rollCount: 2,
    });
  });
});
