import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { MachineOperationSidebar } from '../../components/mes/operations/MachineOperationSidebar';
import { MachineOrderProgressField } from '../../components/mes/operations/MachineOrderProgressField';
import { normalizeShift } from '../../components/mes/operations/shiftLabels';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { useAuth } from '../../auth/useAuth';
import {
  createBuffingCheck,
  deleteBuffingCheck,
  getBuffingChecks,
  getBuffingChecksForOrder,
  uploadBuffingImages,
  type BuffingCheck,
  type BuffingImage,
} from './buffingApi';
import { getMachineOrderProgress, saveMachineOrderProgress } from './machineOrderProgressApi';
import { getWS3ProductionOrderContext, type WS3ProductionOrderReport } from '../orders/ws3OrderApi';
import { useLanguage } from '../../i18n/useLanguage';
import { MachineOperationalNoticeDock } from '../support/MachineOperationalNoticeDock';
import { isOperatorAssignedToMachine } from '../support/machineAssignment';
import { useOperationPanelResize } from './useOperationPanelResize';
import { currentFactoryDateTime, factoryToday } from '../../shared/formatters/date';
import { BuffingCameraPickerModal } from './BuffingCameraPickerModal';
import type { BuffingCheckRow } from './buffingTypes';
import { BuffingImageGallery } from './BuffingImageGallery';
import { BuffingHistoryTable } from './BuffingHistoryTable';
import { captureHikrobotPhoto } from './hikrobotCameraAgent';
import { useBuffingCamera } from './useBuffingCamera';
import './BuffingPage.css';

const toCheckRow = (row: BuffingCheck): BuffingCheckRow => ({
  id: row.id,
  time: new Date(row.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  operator: row.operatorName ?? '',
  operatorIdentifier: row.operatorIdentifier ?? '',
  shift: row.shift ?? '',
  orderNumber: row.orderNumber ?? '',
  orderProgress: row.orderProgress,
  checks: row.checks,
  remark: row.remark ?? '',
  images: row.images,
});

function BuffingNavigation({
  canViewHistory,
  language,
}: {
  canViewHistory: boolean;
  language: string;
}) {
  const tx = (vi: string, en: string) => (language === 'vi' ? vi : en);

  return (
    <nav className="buffing-mes-nav" aria-label={tx('Điều hướng Buffing', 'Buffing navigation')}>
      <NavLink end to="/ws3">
        {tx('Máy móc', 'Machinery')}
      </NavLink>
      <NavLink end to="/machine/buffing/record">
        {tx('Vận hành', 'Operation')}
      </NavLink>
      {canViewHistory && (
        <NavLink to="/machine/buffing/history">{tx('Lịch sử', 'History')}</NavLink>
      )}
    </nav>
  );
}

export function BuffingPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const canViewHistory = user?.role !== 'OPERATOR';
  const isOperator = user?.role === 'OPERATOR';
  const isBuffingOperator = isOperatorAssignedToMachine(user, 'BU-01');
  const [operator, setOperator] = useState('');
  const [operatorIdentifier, setOperatorIdentifier] = useState('');
  const [shift, setShift] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderProgress, setOrderProgress] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [orderProduction, setOrderProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [orderLookupLoading, setOrderLookupLoading] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const date = factoryToday();
  const [rows, setRows] = useState<BuffingCheckRow[]>([]);
  const [remark, setRemark] = useState('');
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ images: BuffingImage[]; index: number } | null>(null);
  const {
    cameras,
    mvsCameras,
    mvsAgentError,
    selectedCamera,
    cameraConnected,
    cameraSkipped,
    cameraConnecting,
    cameraPickerOpen,
    videoRef,
    connectedCameraLabel,
    mvsStreamUrl,
    canPerformChecklist,
    setCameraPickerOpen,
    connectBrowserCamera,
    connectMvsCamera,
    openCameraPicker,
    captureCameraPhoto,
    skipCamera,
  } = useBuffingCamera({ language, onError: setError });
  const {
    operationCollapsed,
    operationWidth,
    workspaceStyle,
    handleDividerPointerDown,
    handleDividerPointerMove,
    handleDividerPointerUp,
    handleDividerPointerCancel,
    handleDividerKeyDown,
  } = useOperationPanelResize({ cssVariableName: '--buffing-operation-width' });
  const cameraText =
    language === 'vi'
      ? {
          beforeChecklist:
            'Kết nối camera trước khi thực hiện checklist, hoặc tiếp tục nếu máy này không có camera.',
          continueWithout: 'TIẾP TỤC KHÔNG DÙNG CAMERA',
          operatorRequired:
            'Chọn đơn sản xuất và nhập tên, ID nhân viên, ca làm trước khi xác nhận.',
          saveFailed: 'Không thể lưu kiểm tra Buffing.',
          noImage: 'Không có ảnh',
          waitingPermission: 'Đang chờ bạn cấp quyền camera trong Chrome...',
        }
      : {
          beforeChecklist:
            'Connect a camera before completing the checklist, or continue if this station has no camera.',
          continueWithout: 'CONTINUE WITHOUT CAMERA',
          operatorRequired:
            'Select an order and enter operator name, employee ID, and shift before confirming.',
          saveFailed: 'Unable to save Buffing check.',
          noImage: 'No image',
          waitingPermission: 'Waiting for camera permission in Chrome...',
        };
  const historyLoadFailed =
    language === 'vi' ? 'Không thể tải lịch sử Buffing.' : 'Unable to load Buffing history.';
  const loadRows = useCallback(
    async (selectedDate: string) => {
      setLoading(true);
      setError(null);
      try {
        setRows((await getBuffingChecks(selectedDate)).map(toCheckRow));
      } catch (reason) {
        setRows([]);
        setError(reason instanceof Error ? reason.message : historyLoadFailed);
      } finally {
        setLoading(false);
      }
    },
    [historyLoadFailed],
  );

  useEffect(() => {
    if (!canViewHistory) {
      setRows([]);
      setLoading(false);
      return;
    }
    void loadRows(date);
  }, [canViewHistory, date, loadRows]);

  useEffect(() => {
    const normalizedOrder = orderNumber.trim();
    if (!normalizedOrder) {
      setOrderProduction(null);
      setOrderLookupLoading(false);
      return;
    }
    let active = true;
    setOrderLookupLoading(true);
    const timer = window.setTimeout(async () => {
      const [productionResult, checksResult, progressResult] = await Promise.allSettled([
        getWS3ProductionOrderContext(normalizedOrder, 'BU-01'),
        getBuffingChecksForOrder(normalizedOrder),
        getMachineOrderProgress('BU-01', normalizedOrder),
      ]);
      if (!active) return;
      const production = productionResult.status === 'fulfilled' ? productionResult.value : null;
      const savedChecks = checksResult.status === 'fulfilled' ? checksResult.value : [];
      const canonicalProgress =
        progressResult.status === 'fulfilled' ? progressResult.value?.orderProgress : null;
      const latest = savedChecks[0];
      setOrderProduction(production);
      setOperator((current) => current || latest?.operatorName || '');
      setOperatorIdentifier((current) => current || latest?.operatorIdentifier || '');
      setShift((current) => current || normalizeShift(latest?.shift));
      setOrderProgress(canonicalProgress ?? latest?.orderProgress ?? 'IN_PROGRESS');
      setOrderLookupLoading(false);
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [orderNumber]);

  const changeOrderProgress = async (nextProgress: 'IN_PROGRESS' | 'COMPLETED') => {
    const selectedOrder = orderNumber.trim();
    if (!selectedOrder || !orderProduction || progressSaving || orderLookupLoading) return;
    const previousProgress = orderProgress;
    setOrderProgress(nextProgress);
    setProgressSaving(true);
    setProgressError(null);
    try {
      await saveMachineOrderProgress('BU-01', selectedOrder, nextProgress);
      setRows((current) =>
        current.map((row) =>
          row.orderNumber.trim().toUpperCase() === selectedOrder.toUpperCase()
            ? { ...row, orderProgress: nextProgress }
            : row,
        ),
      );
    } catch (reason) {
      setOrderProgress(previousProgress);
      setProgressError(
        reason instanceof Error
          ? reason.message
          : language === 'vi'
            ? 'Không lưu được tiến độ đơn.'
            : 'Unable to save order progress.',
      );
    } finally {
      setProgressSaving(false);
    }
  };

  const toggleCheck = (index: number) =>
    setChecks((current) =>
      current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
    );

  const addCheck = async () => {
    if (!operator.trim() || !operatorIdentifier.trim() || !shift.trim() || !orderNumber) {
      setError(cameraText.operatorRequired);
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      let photo: File | null = null;
      try {
        photo =
          selectedCamera?.source === 'mvs'
            ? await captureHikrobotPhoto(selectedCamera.id)
            : await captureCameraPhoto();
      } catch {
        setError(t('cameraCaptureFailed'));
      }
      const saved = await createBuffingCheck({
        checkDate: factoryToday(),
        orderNumber,
        orderProgress,
        operatorName: operator.trim(),
        operatorIdentifier: operatorIdentifier.trim(),
        shift: shift.trim(),
        checks,
        remark: remark.trim() || null,
      });
      setOrderProgress(saved.orderProgress ?? 'IN_PROGRESS');
      let images: BuffingImage[] = [];
      if (photo) {
        try {
          images = await uploadBuffingImages(saved.id, [photo]);
        } catch {
          setError(t('cameraCaptureFailed'));
        }
      } else if (!cameraSkipped) {
        setError(t('cameraUnavailable'));
      }
      setRows((current) => [toCheckRow({ ...saved, images }), ...current]);
      setChecks([false, false, false, false, false]);
      setRemark('');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(
        message.includes('Không tìm thấy mã đơn trong dữ liệu MES')
          ? language === 'vi'
            ? 'Không tìm thấy mã đơn trong dữ liệu MES. Vui lòng kiểm tra mã SOP và thử lại.'
            : 'Production order was not found in MES. Check the SOP number and try again.'
          : message || cameraText.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  const addManualImage = async (checkId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(t('buffingImageFormat'));
      return;
    }
    setError(null);
    try {
      const images = await uploadBuffingImages(checkId, [file]);
      setRows((current) =>
        current.map((row) =>
          row.id === checkId ? { ...row, images: [...row.images, ...images] } : row,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('buffingImageFormat'));
    }
  };

  const removeCheck = async (checkId: number) => {
    if (!window.confirm(t('confirmDeleteCheck'))) return;
    setDeletingId(checkId);
    setError(null);
    try {
      await deleteBuffingCheck(checkId);
      setRows((current) => current.filter((row) => row.id !== checkId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('deleteCheck'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <WS3MesShell
      module="Buffing"
      breadcrumbs={[]}
      navigation={<BuffingNavigation canViewHistory={canViewHistory} language={language} />}
      showSupportWidget={!isBuffingOperator}
    >
      <div className="buffing-mes">
        <div
          className={`buffing-mes__workspace ${isBuffingOperator ? 'buffing-mes__workspace--with-notices' : ''} ${operationCollapsed ? 'buffing-mes__workspace--operation-collapsed' : ''}`}
          style={workspaceStyle}
        >
          <MachineOperationSidebar
            className={operationCollapsed ? 'is-collapsed' : ''}
            orderNumber={orderNumber}
            onOrderNumberChange={(value) => {
              setOrderNumber(value);
              setOrderProduction(null);
              setOperator('');
              setOperatorIdentifier('');
              setShift('');
              setOrderProgress('IN_PROGRESS');
              setProgressError(null);
            }}
            operatorName={operator}
            onOperatorNameChange={setOperator}
            employeeId={operatorIdentifier}
            onEmployeeIdChange={setOperatorIdentifier}
            shift={shift}
            onShiftChange={setShift}
            orderStatus={
              <MachineOrderProgressField
                value={orderProgress}
                language={language}
                automatic={isOperator}
                disabled={!orderProduction || orderLookupLoading}
                saving={progressSaving}
                error={progressError}
                onChange={(progress) => void changeOrderProgress(progress)}
              />
            }
          >
            <div
              className="buffing-mes__operation-divider"
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={420}
              aria-valuenow={operationCollapsed ? 0 : operationWidth}
              aria-label={
                language === 'vi'
                  ? 'Thu gọn hoặc thay đổi độ rộng thông tin vận hành'
                  : 'Collapse or resize operation details'
              }
              onPointerDown={handleDividerPointerDown}
              onPointerMove={handleDividerPointerMove}
              onPointerUp={handleDividerPointerUp}
              onPointerCancel={handleDividerPointerCancel}
              onKeyDown={handleDividerKeyDown}
            />
          </MachineOperationSidebar>

          <section className="buffing-mes__checklist">
            {error && <div className="buffing-no-print buffing-mes__error">{error}</div>}

            <div className="buffing-mes__active-work">
              <section
                className="buffing-mes__camera-panel"
                aria-label={language === 'vi' ? 'Hình ảnh camera' : 'Camera preview'}
              >
                <header className="buffing-mes__camera-header">
                  <strong>
                    {cameraConnected
                      ? connectedCameraLabel
                      : language === 'vi'
                        ? 'Chưa kết nối camera'
                        : 'No camera connected'}
                  </strong>
                  <div className="buffing-mes__camera-header-actions">
                    <span className={cameraConnected ? 'is-connected' : 'is-idle'}>
                      <i aria-hidden="true" />
                      {cameraConnected
                        ? t('cameraConnected')
                        : language === 'vi'
                          ? 'Chờ kết nối'
                          : 'Awaiting connection'}
                    </span>
                    <button
                      type="button"
                      className="buffing-mes__camera-button"
                      onClick={() => void openCameraPicker()}
                      disabled={saving}
                    >
                      {language === 'vi' ? 'Đổi' : 'Change'}
                    </button>
                  </div>
                </header>
                <div className="buffing-mes__camera-stage">
                  <video
                    ref={(element) => {
                      videoRef.current = element;
                    }}
                    className={
                      selectedCamera?.source === 'browser' && cameraConnected
                        ? 'buffing-mes__camera-video'
                        : 'sr-only'
                    }
                    muted
                    playsInline
                    autoPlay
                  />
                  {selectedCamera?.source === 'mvs' && mvsStreamUrl ? (
                    <img
                      src={mvsStreamUrl}
                      className="buffing-mes__camera-image"
                      alt={
                        language === 'vi'
                          ? 'Ảnh trực tiếp từ camera MVS'
                          : 'MVS camera live preview'
                      }
                    />
                  ) : (
                    <div className="buffing-mes__camera-placeholder">
                      <span aria-hidden="true">◎</span>
                      <p>
                        {language === 'vi' ? 'Chưa có hình ảnh xem trước' : 'No preview available'}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {!canPerformChecklist && (
                <section className="buffing-mes__camera-guidance">
                  <p>{cameraText.beforeChecklist}</p>
                  <div>
                    <button
                      type="button"
                      className="buffing-mes__primary-button"
                      onClick={() => void openCameraPicker()}
                    >
                      {t('connectCamera')}
                    </button>
                    <button
                      type="button"
                      className="buffing-mes__secondary-button"
                      onClick={() => {
                        skipCamera();
                      }}
                    >
                      {cameraText.continueWithout}
                    </button>
                  </div>
                </section>
              )}

              {canPerformChecklist && (
                <>
                  <section className="buffing-no-print buffing-mes__check-form">
                    <div className="grid items-stretch gap-3 lg:grid-cols-[1.15fr_1fr]">
                      <div className="box-border flex h-20 min-h-20 flex-col">
                        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          <span>{t('currentCheck')}</span>
                          <time className="font-mono normal-case tracking-normal text-industrial">
                            {currentFactoryDateTime()}
                          </time>
                        </div>
                        <div className="grid min-h-0 flex-1 grid-cols-5 gap-1">
                          {checks.map((checked, index) => (
                            <button
                              key={index}
                              type="button"
                              className={`min-h-0 border-2 text-sm font-bold ${checked ? 'border-success bg-success text-white' : 'border-line bg-white text-industrialDark'}`}
                              onClick={() => toggleCheck(index)}
                            >
                              {index + 1}
                              <span className="block text-[8px]">
                                {checked ? t('ok') : t('check')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="box-border flex h-20 min-h-20 flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        <span className="block h-4 shrink-0 leading-4">{t('remark')}</span>
                        <textarea
                          className="box-border min-h-0 flex-1 resize-none border-2 border-line bg-white px-2 py-1 text-xs font-semibold"
                          value={remark}
                          onChange={(event) => setRemark(event.target.value)}
                          placeholder={t('note')}
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {t('checkInterval')}:{' '}
                        <span className="ml-1 font-mono text-industrialDark">15 min</span>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="buffing-mes__secondary-button"
                          onClick={() => navigate('/ws3')}
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          className="buffing-mes__primary-button"
                          onClick={() => void addCheck()}
                          disabled={
                            saving ||
                            loading ||
                            !orderNumber.trim() ||
                            !operator.trim() ||
                            !operatorIdentifier.trim() ||
                            !shift.trim()
                          }
                        >
                          {saving ? t('saving') : t('confirmCheck')}
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>

            {canPerformChecklist && canViewHistory && (
              <BuffingHistoryTable
                language={language}
                translate={t}
                loading={loading}
                rows={rows}
                deletingId={deletingId}
                onOpenGallery={(row) =>
                  setGallery({
                    images: row.images,
                    index:
                      row.images.findIndex((image) => image.isPrimary) >= 0
                        ? row.images.findIndex((image) => image.isPrimary)
                        : 0,
                  })
                }
                onAddManualImage={(checkId, event) => void addManualImage(checkId, event)}
                onRemoveCheck={(checkId) => void removeCheck(checkId)}
              />
            )}
          </section>
          {isBuffingOperator && (
            <div className="machine-operational-notices buffing-mes__notices">
              <MachineOperationalNoticeDock machineId="BU-01" />
            </div>
          )}
        </div>
      </div>
      {cameraPickerOpen && (
        <BuffingCameraPickerModal
          language={language}
          translate={t}
          cameraConnecting={cameraConnecting}
          waitingPermissionMessage={cameraText.waitingPermission}
          mvsCameras={mvsCameras}
          cameras={cameras}
          selectedCamera={selectedCamera}
          mvsAgentError={mvsAgentError}
          error={error}
          onClose={() => setCameraPickerOpen(false)}
          onConnectMvs={(camera) => void connectMvsCamera(camera)}
          onConnectBrowser={(cameraId) => void connectBrowserCamera(cameraId)}
        />
      )}
      {gallery && (
        <BuffingImageGallery
          gallery={gallery}
          translate={t}
          onClose={() => setGallery(null)}
          onIndexChange={(index) =>
            setGallery((current) => (current ? { ...current, index } : current))
          }
        />
      )}
    </WS3MesShell>
  );
}
