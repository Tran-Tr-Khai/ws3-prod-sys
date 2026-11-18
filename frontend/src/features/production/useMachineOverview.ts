import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { getWS3ProductionReport } from '../orders/ws3OrderApi';
import type {
  MachineOverviewSummary,
  OverviewField,
  OverviewMessage,
  OverviewTone,
} from './MachineOverviewCard';
import { useMachineCoreData } from './useMachineCoreData';
import { useProgressiveMachineOverview } from './useProgressiveMachineOverview';

function factoryToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function outputTone(
  output: number | null,
  input: number | null,
  progress: string | null,
): OverviewTone {
  if (output === null || input === null) return 'info';
  if (output >= input) return 'success';
  return progress === 'COMPLETED' ? 'warning' : 'info';
}

// Descriptors define only which fields a machine presents, never how it loads.
const productionFields: Record<string, string[]> = {
  'BU-01': ['sop', 'item', 'lot', 'rolls', 'checks'],
  'TE-01': ['sop', 'item', 'lot', 'rolls', 'input', 'output'],
  'TE-02': ['sop', 'item', 'lot', 'rolls', 'input', 'output'],
};

export function useMachineOverview() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const buffing = useProgressiveMachineOverview('BU-01');
  const tentering01 = useProgressiveMachineOverview('TE-01');
  const tentering02 = useProgressiveMachineOverview('TE-02');
  const canViewMesOrders = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const today = factoryToday();
  const unrolling = useMachineCoreData(
    `${user?.username}:UN-01:${today}`,
    canViewMesOrders,
    (signal) => getWS3ProductionReport(today, { signal }),
  );

  const tx = (vi: string, en: string) => (language === 'vi' ? vi : en);
  const field = (
    key: string,
    label: string,
    value: OverviewField['value'],
    tone: OverviewTone = 'normal',
    fullWidth = false,
  ): OverviewField => ({ key, label, value, tone, fullWidth });
  const message = (text: string, tone: OverviewTone = 'muted'): OverviewMessage => ({ text, tone });
  const loading = message(tx('Đang tải dữ liệu máy…', 'Loading machine data…'));
  const failed = message(
    tx('Không tải được dữ liệu máy.', 'Unable to load machine data.'),
    'warning',
  );
  const empty = message(tx('Chưa có thông tin vận hành.', 'No operation information yet.'));
  const time = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    const options = { timeZone: 'Asia/Ho_Chi_Minh' };
    const locale = language === 'vi' ? 'vi-VN' : 'en-GB';
    return `${new Intl.DateTimeFormat(locale, { ...options, day: '2-digit', month: '2-digit', year: '2-digit' }).format(date)} ${new Intl.DateTimeFormat(locale, { ...options, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}`;
  };
  const quantity = (value: number | null | undefined, unit = 'm') =>
    value == null
      ? null
      : `${value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 3 })} ${unit}`;

  function summarize(
    machineId: string,
    state: ReturnType<typeof useProgressiveMachineOverview>,
  ): MachineOverviewSummary {
    const { core, details, mes } = state;
    const record = core.data;
    const operation = [field('machine', t('machine'), machineId)];
    if (!record) {
      const status = core.loading ? loading : core.failed ? failed : empty;
      return {
        operation,
        operationMessage: status,
        production: [],
        productionMessage: status,
        statuses: [],
      };
    }
    operation.push(
      field('shift', tx('Ca', 'Shift'), record.shift),
      field('operator', t('operator'), record.operator),
      field('employee', tx('ID nhân viên', 'Employee ID'), record.employee),
      field(
        'started',
        tx('Bắt đầu đơn', 'Order started'),
        time(details.data?.started ?? record.started),
      ),
      field('recorded', t('lastRecorded'), time(record.recorded)),
    );
    const output = details.data?.output !== undefined ? details.data.output : record.output;
    const input = mes.data?.input ?? null;
    const checks = details.data?.checks;
    const errors = details.data?.failed_checks;
    const fields: Record<string, OverviewField> = {
      sop: field('sop', 'SOP', record.sop),
      item: field('item', t('item'), mes.data?.item || record.item),
      lot: field('lot', t('lotNumber'), mes.data?.lot || record.lot),
      rolls: field('rolls', tx('Số cuộn', 'Roll count'), details.data?.rolls ?? mes.data?.rolls),
      input: field('input', 'Input', quantity(input)),
      output: field(
        'output',
        'Output',
        quantity(output),
        outputTone(output, input, record.progress),
      ),
      temperature: field('temperature', t('temperature'), quantity(record.temperature, '°C')),
      speed: field('speed', t('speed'), quantity(record.speed, 'm/min')),
      checks: field(
        'checks',
        tx('Lỗi / tổng lượt kiểm tra', 'Failed / total checks'),
        checks === undefined ? null : `${errors ?? 0}/${checks}`,
        errors ? 'alarm' : checks === undefined ? 'muted' : 'success',
      ),
    };
    const inspection = details.data?.inspection ?? record.inspection;
    const statuses: OverviewField[] = [];
    if (machineId === 'BU-01') {
      statuses.push(
        field(
          'inspection',
          tx('Kết quả kiểm tra', 'Inspection result'),
          inspection === 'PASS'
            ? tx('ĐẠT', 'PASS')
            : inspection === 'WARNING'
              ? tx('CẢNH BÁO', 'WARNING')
              : null,
          inspection === 'PASS' ? 'success' : inspection === 'WARNING' ? 'warning' : 'muted',
        ),
      );
    }
    statuses.push(
      field(
        'progress',
        tx('Tiến độ đơn', 'Order progress'),
        record.progress === 'COMPLETED'
          ? tx('ĐÃ HOÀN THÀNH', 'COMPLETED')
          : record.progress === 'IN_PROGRESS'
            ? tx('ĐANG XỬ LÝ', 'IN PROGRESS')
            : tx('CHƯA CẬP NHẬT', 'NOT SET'),
        record.progress === 'COMPLETED'
          ? 'success'
          : record.progress === 'IN_PROGRESS'
            ? 'info'
            : 'muted',
      ),
    );
    const supplementalMessage =
      details.failed || mes.failed
        ? message(
            tx(
              'Chưa tải được một phần dữ liệu bổ sung.',
              'Some additional data could not be loaded.',
            ),
            'warning',
          )
        : details.loading || mes.loading
          ? message(tx('Đang bổ sung dữ liệu…', 'Loading additional data…'))
          : record.sop && !mes.data
            ? message(
                tx(
                  'Không tìm thấy đơn trong snapshot MES hiện tại.',
                  'Order not found in the current MES snapshot.',
                ),
              )
            : undefined;
    return {
      operation,
      production: (productionFields[machineId] ?? []).map((key) => fields[key]),
      statuses,
      productionMessage: supplementalMessage,
    };
  }

  const summaries: Record<string, MachineOverviewSummary> = {
    'BU-01': summarize('BU-01', buffing),
    'TE-01': summarize('TE-01', tentering01),
    'TE-02': summarize('TE-02', tentering02),
    'UN-01': {
      operation: [field('machine', t('machine'), 'UN-01')],
      operationMessage: message(
        tx(
          'Đơn và danh sách cuộn lấy trực tiếp từ MES.',
          'Orders and rolls are supplied directly from MES.',
        ),
      ),
      production:
        canViewMesOrders && unrolling.data
          ? [
              field('orders', tx('Đơn hôm nay', 'Today’s orders'), unrolling.data.summary.orders),
              field(
                'review',
                tx('Cần kiểm tra', 'Needs review'),
                unrolling.data.summary.check,
                unrolling.data.summary.check ? 'warning' : 'success',
              ),
            ]
          : [],
      productionMessage: !canViewMesOrders
        ? message(tx('Supervisor xem dữ liệu đơn MES.', 'MES order information for supervisors.'))
        : unrolling.loading
          ? loading
          : unrolling.failed
            ? failed
            : undefined,
    },
  };
  return { summaries, error: null };
}
