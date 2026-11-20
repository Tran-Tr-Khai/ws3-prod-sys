import type { ChangeEvent } from 'react';
import type { TranslationKey } from '../../i18n/LanguageContext';
import { formatShiftLabel } from '../../components/mes/operations/shiftLabels';
import type { BuffingCheckRow } from './buffingTypes';

type BuffingHistoryTableProps = {
  language: string;
  translate: (key: TranslationKey) => string;
  loading: boolean;
  rows: BuffingCheckRow[];
  deletingId: number | null;
  onOpenGallery: (row: BuffingCheckRow) => void;
  onAddManualImage: (checkId: number, event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveCheck: (checkId: number) => void;
};

/** Render the saved Buffing checklist records and their image actions. */
export function BuffingHistoryTable({
  language,
  translate,
  loading,
  rows,
  deletingId,
  onOpenGallery,
  onAddManualImage,
  onRemoveCheck,
}: BuffingHistoryTableProps) {
  return (
    <section className="buffing-history buffing-mes__history flex min-h-0 flex-1 flex-col bg-white">
      <div className="buffing-history-scroll min-h-0 flex-1 overflow-auto bg-white p-2">
        <table className="w-full min-w-[1320px] border-collapse text-left text-[10px]">
          <thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark">
            <tr>
              <th className="px-3 py-2">{translate('time')}</th>
              <th className="px-3 py-2">SOP</th>
              <th className="px-3 py-2">{translate('operator')}</th>
              <th className="px-3 py-2">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</th>
              <th className="px-3 py-2">{language === 'vi' ? 'Ca làm' : 'Shift'}</th>
              {[1, 2, 3, 4, 5].map((point) => (
                <th key={point} className="px-3 py-2 text-center">
                  {point}
                </th>
              ))}
              <th className="px-3 py-2">{translate('remark')}</th>
              <th className="px-3 py-2">{translate('buffingImages')}</th>
              <th className="w-12 px-2 py-2 text-center" aria-label={translate('deleteCheck')} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500"
                >
                  {translate('loadingHistory')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500"
                >
                  {translate('noChecksToday')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line">
                  <td className="px-3 py-2 font-mono font-bold text-industrial">{row.time}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-industrialDark">
                    {row.orderNumber || '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold text-industrialDark">
                    {row.operator || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.operatorIdentifier || '—'}</td>
                  <td className="px-3 py-2">{formatShiftLabel(row.shift, language) || '—'}</td>
                  {row.checks.map((checked, index) => (
                    <td
                      key={index}
                      className={`px-3 py-2 text-center text-lg font-bold ${checked ? 'text-success' : 'text-alarm'}`}
                    >
                      {checked ? '✓' : '×'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-slate-600">{row.remark || '—'}</td>
                  <td className="px-3 py-2">
                    {row.images.length > 0 ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 text-industrial underline"
                        onClick={() => onOpenGallery(row)}
                      >
                        <img
                          src={
                            row.images.find((image) => image.isPrimary)?.url ?? row.images[0].url
                          }
                          alt={translate('primaryImage')}
                          className="h-10 w-14 object-cover"
                        />
                        <span>
                          {row.images.length} {translate('imageCount')}
                        </span>
                      </button>
                    ) : (
                      <label className="inline-flex min-h-7 cursor-pointer items-center border border-industrial px-2 text-[9px] font-bold text-industrial hover:bg-surfaceHover">
                        <span>{translate('addImage')}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event) => onAddManualImage(row.id, event)}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center border border-alarm text-alarm hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                      title={translate('deleteCheck')}
                      aria-label={translate('deleteCheck')}
                      disabled={deletingId === row.id}
                      onClick={() => onRemoveCheck(row.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
