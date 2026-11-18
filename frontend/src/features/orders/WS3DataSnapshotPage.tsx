import { useState } from 'react';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { replaceWS3Snapshot } from './ws3OrderApi';
import { ws3DataSourceLabels, type WS3DataSource } from './ws3DataSourceLabels';
import { WS3DataFlowNav } from './WS3DataFlowNav';
import './WS3DataSnapshotPage.css';

type SourceKey = WS3DataSource;

/** Upload the current MES source snapshots for WS3 data synchronization. */
export function WS3DataSnapshotPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => (language === 'vi' ? vi : en);
  const [files, setFiles] = useState<Partial<Record<SourceKey, File>>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [selectionVersion, setSelectionVersion] = useState(0);
  const ready = Object.values(files).some(Boolean);
  const selectedCount = Object.values(files).filter(Boolean).length;
  const allowed = Boolean(
    user && ['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role),
  );

  const clear = () => {
    setFiles({});
    setSelectionVersion((value) => value + 1);
    setMessage('');
  };

  const upload = async () => {
    if (!ready) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await replaceWS3Snapshot(files);
      const counts: Record<SourceKey, keyof typeof result.updated> = {
        order: 'orders',
        machine: 'machines',
        worker: 'workers',
      };
      const updated = (Object.keys(files) as SourceKey[])
        .filter((key) => files[key])
        .map(
          (key) =>
            `${language === 'vi' ? ws3DataSourceLabels[key].vi : ws3DataSourceLabels[key].en}: ${result.updated[counts[key]]?.toLocaleString() ?? 0}`,
        )
        .join(' · ');
      setMessageTone('success');
      setMessage(
        tx(
          `Đã cập nhật ${updated}. Các nguồn chưa chọn được giữ nguyên.`,
          `Updated ${updated}. Sources not selected were kept unchanged.`,
        ),
      );
    } catch (error) {
      setMessageTone('error');
      setMessage(
        error instanceof Error
          ? error.message
          : tx('Không thể cập nhật dữ liệu.', 'Unable to update the data.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <WS3MesShell
      module={tx('Nạp dữ liệu', 'Data intake')}
      breadcrumbs={[]}
      navigation={<WS3DataFlowNav />}
    >
      <div className="data-intake-mes">
        {!allowed ? (
          <section className="data-intake-mes__empty" role="alert">
            {tx(
              'Chỉ Supervisor, Production Manager hoặc Admin được nạp dữ liệu.',
              'Only Supervisors, Production Managers or Admins can load data.',
            )}
          </section>
        ) : (
          <div className="data-intake-mes__content">
            <section
              className="data-intake-mes__controlbar"
              aria-label={tx('Điều khiển nạp dữ liệu', 'Data-intake controls')}
            >
              <div className="data-intake-mes__overview">
                <span className="data-intake-mes__view-label">
                  {tx('Đồng bộ báo cáo', 'Report sync')}
                </span>
                <span>
                  <small>{tx('Đã chọn', 'Selected')}</small>
                  <strong>{selectedCount}/3</strong>
                </span>
              </div>
              <div className="data-intake-mes__command-actions">
                <button type="button" onClick={clear} disabled={loading || !ready}>
                  {tx('Xóa lựa chọn', 'Clear selection')}
                </button>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => void upload()}
                  disabled={!ready || loading}
                >
                  {loading
                    ? tx('Đang cập nhật…', 'Updating…')
                    : tx('Cập nhật dữ liệu', 'Update data')}
                </button>
              </div>
            </section>

            <section
              className="data-intake-mes__workspace"
              aria-label={tx('Nguồn dữ liệu Excel', 'Excel data sources')}
            >
              <table>
                <caption>
                  {tx('Chọn các báo cáo Excel cần cập nhật', 'Select Excel reports to update')}
                </caption>
                <thead>
                  <tr>
                    <th>{tx('Nguồn dữ liệu', 'Data source')}</th>
                    <th>{tx('Tệp nguồn', 'Source file')}</th>
                    <th>{tx('Trạng thái', 'Status')}</th>
                    <th aria-label={tx('Chọn file', 'Choose file')} />
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(ws3DataSourceLabels) as SourceKey[]).map((key) => {
                    const label = ws3DataSourceLabels[key];
                    const file = files[key];
                    return (
                      <tr key={key} data-selected={file ? 'true' : undefined}>
                        <td>
                          <strong>{language === 'vi' ? label.vi : label.en}</strong>
                          <small>
                            {tx('Báo cáo Excel (.xls, .xlsx)', 'Excel report (.xls, .xlsx)')}
                          </small>
                        </td>
                        <td className="data-intake-mes__file-name">
                          {file?.name ?? tx('Chưa chọn file', 'No file selected')}
                        </td>
                        <td>
                          <span
                            className="data-intake-mes__status"
                            data-tone={file ? 'ready' : 'idle'}
                          >
                            {file ? tx('Sẵn sàng', 'Ready') : tx('Chờ file', 'Awaiting file')}
                          </span>
                        </td>
                        <td className="data-intake-mes__file-action">
                          <label className="data-intake-mes__choose-file">
                            <span>
                              {file ? tx('Thay file', 'Replace') : tx('Chọn file', 'Choose file')}
                            </span>
                            <input
                              key={`${key}-${selectionVersion}`}
                              disabled={loading}
                              type="file"
                              accept=".xls,.xlsx"
                              onChange={(event) => {
                                const selectedFile = event.target.files?.[0];
                                setFiles((current) => ({ ...current, [key]: selectedFile }));
                              }}
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {message && (
              <p className="data-intake-mes__message" data-tone={messageTone} role="status">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </WS3MesShell>
  );
}
