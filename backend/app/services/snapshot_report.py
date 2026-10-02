"""Join snapshots at invoice/roll grain, without positional assignments."""
import json
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from collections.abc import Sequence

from app.models.ws3_production import WS3ProductionOrder, WS3MachineWS2Record, WS3WorkerRecord

from app.services.snapshot_sources import key


def raw_value(record: WS3ProductionOrder, name: str) -> str:
    data = json.loads(record.raw_data_json or '{}')
    return next((value for label, value in zip(data.get('columns', []), data.get('row', [])) if key(label) == key(name)), '')


def roll_date(roll_id: str | None, machine_no: str | None) -> str | None:
    """Match the explicit machine prefix so machine digits cannot eat the date."""
    match = re.fullmatch(r'P' + re.escape(key(machine_no)) + r'(\d{6})-\d+', key(roll_id)) if machine_no else None
    if not match:
        return None
    try:
        return datetime.strptime(match[1], '%y%m%d').date().isoformat()
    except ValueError:
        return None


def build_report(
    orders: Sequence[WS3ProductionOrder],
    machines: Sequence[WS3MachineWS2Record],
    workers: Sequence[WS3WorkerRecord],
    production_date: str,
) -> dict[str, object]:
    machine_index = defaultdict(list)
    worker_index = defaultdict(list)
    grouped = defaultdict(list)
    for machine in machines:
        if key(machine.out_dyeing_sop):
            machine_index[key(machine.out_dyeing_sop)].append(machine)
    for worker in workers:
        join = (key(worker.sop_no), worker.weaving_date, key(worker.machine_no))
        if all(join):
            worker_index[join].append(worker)
    for order in orders:
        grouped[order.pk_no].append(order)
    result = []
    for pk_no, lines in sorted(grouped.items()):
        warnings = []
        rolls = []
        invoices = {key(line.invoice_no) for line in lines if key(line.invoice_no)}
        if any(not key(line.invoice_no) for line in lines):
            warnings.append('Thiếu INVOICE NO / Missing INVOICE NO.')
        candidates = {}
        for invoice in sorted(invoices):
            for machine in machine_index[invoice]:
                # Verify business identity without multiplying duplicate order rows.
                related = [line for line in lines if key(line.invoice_no) == invoice]
                if not any(all(key(getattr(machine, f)) == key(getattr(line, f)) for f in ('po_no', 'source_order_no', 'item_code', 'lot_no')) for line in related):
                    warnings.append(f'{machine.roll_id}: thông tin đơn không khớp / business fields differ.')
                    continue
                previous = candidates.get(machine.roll_id)
                if previous and any(getattr(previous, f) != getattr(machine, f) for f in ('machine_no', 'weaving_date', 'sop_no', 'length_meters')):
                    warnings.append(f'{machine.roll_id}: dữ liệu cuộn mâu thuẫn / conflicting roll data.')
                    candidates[machine.roll_id] = previous
                    continue
                candidates[machine.roll_id] = machine
        for roll_id, machine in sorted(candidates.items()):
            weaving_date = roll_date(roll_id, machine.machine_no)
            join = (key(machine.sop_no), weaving_date, key(machine.machine_no))
            if not weaving_date:
                warnings.append(f'{roll_id}: ngày dệt không hợp lệ / invalid roll date.')
            matches = worker_index.get(join, []) if all(join) else []
            pairs = sorted({(w.shift or '', w.worker or '') for w in matches})
            resolved = len(pairs) == 1 and all(pairs[0])
            if not resolved:
                warnings.append(f'{roll_id}: chưa xác định duy nhất ca/công nhân / shift-worker missing or ambiguous.')
            rolls.append({
                'out_no': None, 'roll_id': roll_id, 'machine_no': machine.machine_no,
                'weaving_date': weaving_date, 'source_date': machine.weaving_date, 'length_meters': float(machine.length_meters) if machine.length_meters is not None else None,
                'shift': pairs[0][0] if resolved else None, 'worker': pairs[0][1] if resolved else None,
                'worker_candidates': [{'shift': shift, 'worker': worker} for shift, worker in pairs],
                'remarks': machine.source_order_no, 'item_code': machine.item_code,
                'item_name': machine.item_name, 'lot_no': machine.lot_no,
            })
        expected = sum(int(Decimal(line.quantity or '1')) for line in lines)
        if len(rolls) != expected:
            warnings.append(f'Số cuộn / Roll count: {len(rolls)}/{expected}.')
        expected_mts = sum((Decimal(raw_value(line, 'QTY / MTS').replace(',', '') or '0') for line in lines), Decimal(0))
        actual_mts = sum((m.length_meters or Decimal(0) for m in candidates.values()), Decimal(0))
        if abs(expected_mts - actual_mts) > Decimal('0.05'):
            warnings.append(f'Chiều dài / Length: {actual_mts}/{expected_mts} MTS.')
        sample = lines[0]
        result.append({
            'pk_no': pk_no, 'production_date': production_date,
            'item_code': sample.item_code, 'item_name': sample.item_name, 'lot_no': sample.lot_no,
            'sop_no': ', '.join(sorted({line.invoice_no for line in lines if line.invoice_no})),
            'machine_no': ', '.join(sorted({m.machine_no for m in candidates.values() if m.machine_no})),
            'expected_rolls': expected, 'matched_rolls': len(rolls),
            'status': 'CHECK' if warnings else 'READY', 'warnings': list(dict.fromkeys(warnings)), 'rolls': rolls,
        })
    return {'production_date': production_date, 'summary': {'orders': len(result), 'ready': sum(o['status'] == 'READY' for o in result), 'check': sum(o['status'] == 'CHECK' for o in result)}, 'orders': result}
