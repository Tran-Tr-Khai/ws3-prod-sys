import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { normalizeShift } from '../../components/hmi/ShiftSelect';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { createBuffingCheck, deleteBuffingCheck, getBuffingChecks, getBuffingChecksForOrder, getMachineOrderProgress, saveMachineOrderProgress, uploadBuffingImages, type BuffingCheck, type BuffingImage } from './scouringApi';
import { getWS3ProductionOrderContext, type WS3ProductionOrderReport } from '../orders/ws3OrderApi';
import { useLanguage } from '../../i18n/LanguageContext';

const currentFactoryDateTime = () => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
const factoryToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const toCheckRow = (row: BuffingCheck) => ({ id: row.id, time: new Date(row.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), operator: row.operatorName ?? '', operatorIdentifier: row.operatorIdentifier ?? '', shift: row.shift ?? '', orderNumber: row.orderNumber ?? '', orderProgress: row.orderProgress, checks: row.checks, remark: row.remark ?? '', images: row.images });
type CheckRow = ReturnType<typeof toCheckRow>;
const BUFFING_CAMERA_STORAGE_KEY = 'ws3.buffing.camera-id';
const BUFFING_CAMERA_SKIP_STORAGE_KEY = 'ws3.buffing.camera-skipped';

export function BuffingPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const canViewHistory = user?.role !== 'OPERATOR';
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
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [remark, setRemark] = useState('');
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ images: BuffingImage[]; index: number } | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => window.localStorage.getItem(BUFFING_CAMERA_STORAGE_KEY) ?? '');
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cameraSkipped, setCameraSkipped] = useState(() => window.localStorage.getItem(BUFFING_CAMERA_SKIP_STORAGE_KEY) === 'true');
  const [cameraConnecting, setCameraConnecting] = useState(false);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const connectedCameraLabel = cameras.find((camera) => camera.deviceId === selectedCameraId)?.label || t('cameraConnected');
  const cameraText = language === 'vi' ? {
    beforeChecklist: 'Kết nối camera trước khi thực hiện checklist, hoặc tiếp tục nếu máy này không có camera.',
    continueWithout: 'TIẾP TỤC KHÔNG DÙNG CAMERA',
    skippedNotice: 'Đang thao tác không dùng camera. Có thể thêm ảnh thủ công tại ô hình ảnh sau khi lưu.',
    operatorRequired: 'Chọn đơn sản xuất và nhập tên, ID nhân viên, ca làm trước khi xác nhận.',
    saveFailed: 'Không thể lưu kiểm tra Buffing.',
    noImage: 'Không có ảnh',
    waitingPermission: 'Đang chờ bạn cấp quyền camera trong Chrome...',
  } : {
    beforeChecklist: 'Connect a camera before completing the checklist, or continue if this station has no camera.',
    continueWithout: 'CONTINUE WITHOUT CAMERA',
    skippedNotice: 'Working without a camera. You can add a photo manually from the image cell after saving.',
    operatorRequired: 'Select an order and enter operator name, employee ID, and shift before confirming.',
    saveFailed: 'Unable to save Buffing check.',
    noImage: 'No image',
    waitingPermission: 'Waiting for camera permission in Chrome...',
  };
  const historyLoadFailed = language === 'vi' ? 'Không thể tải lịch sử Buffing.' : 'Unable to load Buffing history.';
  const canPerformChecklist = cameraConnected || cameraSkipped;

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraConnected(false);
  }, []);

  const cameraErrorMessage = (reason?: unknown) => {
    const prefix = language === 'vi' ? 'Không thể kết nối camera' : 'Unable to connect camera';
    if (!window.isSecureContext) return `${prefix}: ${language === 'vi' ? 'trang này không ở secure context (HTTPS/localhost).' : 'this page is not in a secure context (HTTPS/localhost).'}`;
    if (reason instanceof DOMException) {
      if (reason.name === 'NotAllowedError') return `${prefix}: ${language === 'vi' ? 'quyền camera bị chặn trong Chrome hoặc Windows.' : 'camera permission is blocked in Chrome or Windows.'}`;
      if (reason.name === 'NotFoundError') return `${prefix}: ${language === 'vi' ? 'Chrome không tìm thấy thiết bị camera.' : 'Chrome cannot find a camera device.'}`;
      if (reason.name === 'NotReadableError') return `${prefix}: ${language === 'vi' ? 'camera đang được ứng dụng khác sử dụng hoặc driver không gửi được hình ảnh.' : 'the camera is in use by another application or its driver is not providing video.'}`;
      if (reason.name === 'OverconstrainedError') return `${prefix}: ${language === 'vi' ? 'camera đã lưu không còn tồn tại. Hãy chọn lại camera.' : 'the saved camera is no longer available. Select it again.'}`;
      return `${prefix}: ${reason.name}.`;
    }
    return `${prefix}: ${language === 'vi' ? 'Camera API không khả dụng trong trình duyệt này.' : 'the Camera API is unavailable in this browser.'}`;
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!gallery) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGallery(null);
      if (event.key === 'ArrowLeft') setGallery((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current);
      if (event.key === 'ArrowRight') setGallery((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current);
      if (event.key === 'Home') setGallery((current) => current ? { ...current, index: 0 } : current);
      if (event.key === 'End') setGallery((current) => current ? { ...current, index: current.images.length - 1 } : current);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gallery]);

  const loadRows = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError(null);
    try { setRows((await getBuffingChecks(selectedDate)).map(toCheckRow)); }
    catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : historyLoadFailed); }
    finally { setLoading(false); }
  }, [historyLoadFailed]);

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
      setOrderProduction(null); setOrderLookupLoading(false);
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
      const canonicalProgress = progressResult.status === 'fulfilled' ? progressResult.value?.orderProgress : null;
      const latest = savedChecks[0];
      setOrderProduction(production);
      setOperator((current) => current || latest?.operatorName || '');
      setOperatorIdentifier((current) => current || latest?.operatorIdentifier || '');
      setShift((current) => current || normalizeShift(latest?.shift));
      setOrderProgress(canonicalProgress ?? latest?.orderProgress ?? 'IN_PROGRESS');
      setOrderLookupLoading(false);
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
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
      setRows((current) => current.map((row) => row.orderNumber.trim().toUpperCase() === selectedOrder.toUpperCase() ? { ...row, orderProgress: nextProgress } : row));
    } catch (reason) {
      setOrderProgress(previousProgress);
      setProgressError(reason instanceof Error ? reason.message : (language === 'vi' ? 'Không lưu được tiến độ đơn.' : 'Unable to save order progress.'));
    } finally { setProgressSaving(false); }
  };

  const toggleCheck = (index: number) => setChecks((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));

  const connectCamera = async (cameraId: string) => {
    if (!navigator.mediaDevices?.getUserMedia) { setError(cameraErrorMessage()); return; }
    setError(null);
    setCameraConnecting(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cameraId } }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
      setCameras(devices);
      setSelectedCameraId(cameraId);
      window.localStorage.setItem(BUFFING_CAMERA_STORAGE_KEY, cameraId);
      setCameraConnected(true);
      setCameraSkipped(false);
      window.localStorage.removeItem(BUFFING_CAMERA_SKIP_STORAGE_KEY);
      setCameraPickerOpen(false);
    } catch (reason) {
      stopCamera();
      setError(cameraErrorMessage(reason));
    } finally {
      setCameraConnecting(false);
    }
  };

  const openCameraPicker = async () => {
    setCameraPickerOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) { setError(cameraErrorMessage()); return; }
    setError(null);
    setCameraConnecting(true);
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach((track) => track.stop());
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
      setCameras(devices);
    } catch (reason) {
      setError(cameraErrorMessage(reason));
    } finally {
      setCameraConnecting(false);
    }
  };

  useEffect(() => {
    if (selectedCameraId) void connectCamera(selectedCameraId);
  // Restore the user's previously approved camera once per page visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureCameraPhoto = async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!cameraConnected || !video) return null;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          video.removeEventListener('loadeddata', finish);
          video.removeEventListener('canplay', finish);
          window.clearTimeout(timeoutId);
          resolve();
        };
        const timeoutId = window.setTimeout(finish, 2_000);
        video.addEventListener('loadeddata', finish, { once: true });
        video.addEventListener('canplay', finish, { once: true });
      });
    }
    // Give the decoded stream one paint cycle after it becomes ready.  Without this,
    // a camera that has just opened can occasionally yield an all-black canvas frame.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return blob ? new File([blob], `buffing-check-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: 'image/jpeg' }) : null;
  };

  const addCheck = async () => {
    if (!operator.trim() || !operatorIdentifier.trim() || !shift.trim() || !orderNumber) { setError(cameraText.operatorRequired); return; }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      let photo: File | null = null;
      try { photo = await captureCameraPhoto(); }
      catch { setError(t('cameraCaptureFailed')); }
      const saved = await createBuffingCheck({ checkDate: factoryToday(), orderNumber, orderProgress, operatorName: operator.trim(), operatorIdentifier: operatorIdentifier.trim(), shift: shift.trim(), checks, remark: remark.trim() || null });
      let images: BuffingImage[] = [];
      if (photo) {
        try { images = await uploadBuffingImages(saved.id, [photo]); }
        catch { setError(t('cameraCaptureFailed')); }
      } else if (!cameraSkipped) {
        setError(t('cameraUnavailable'));
      }
      setRows((current) => [toCheckRow({ ...saved, images }), ...current]);
      setChecks([false, false, false, false, false]);
      setRemark('');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(message.includes('Không tìm thấy mã đơn trong dữ liệu MES')
        ? (language === 'vi' ? 'Không tìm thấy mã đơn trong dữ liệu MES. Vui lòng kiểm tra mã PKP và thử lại.' : 'Production order was not found in MES. Check the PKP number and try again.')
        : message || cameraText.saveFailed);
    } finally { setSaving(false); }
  };

  const addManualImage = async (checkId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError(t('buffingImageFormat')); return; }
    setError(null);
    try {
      const images = await uploadBuffingImages(checkId, [file]);
      setRows((current) => current.map((row) => row.id === checkId ? { ...row, images: [...row.images, ...images] } : row));
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
    <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title={`WS3 / ${t('buffingDailyCheck')}`} subtitle={`${t('periodicChecklist')} · Buffing`} machineId="BU-01" machineLabel="Buffing" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="buffing-page-shell flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="BU-01" machineLabel="Buffing" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('home')}</HMIButton>} />
        <div className="buffing-page-content min-h-0 flex-1 p-2">
          <div className="buffing-card mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
            <header className="flex shrink-0 items-center justify-between gap-3 bg-industrialDark px-3 py-2 text-white"><h1 className="text-sm font-bold uppercase tracking-wider">{t('periodicChecklist')}</h1><HMIButton size="compact" className="max-w-[360px] truncate" variant={cameraConnected ? 'primary' : undefined} onClick={() => void openCameraPicker()} disabled={saving}>{cameraConnected ? `${connectedCameraLabel} · ${t('cameraConnected')}` : t('connectCamera')}</HMIButton></header>

            <div className="buffing-layout grid min-h-0 flex-1 gap-2 bg-hmiConsole p-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,3.15fr)]">
            <aside className="buffing-no-print flex min-w-0 flex-col border-2 border-industrialDark bg-white">
              <header className="border-b-2 border-industrialDark bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-industrialDark">{language === 'vi' ? 'THÔNG TIN VẬN HÀNH' : 'OPERATION DETAILS'}</header>
              <OperationInfoFields orderNumber={orderNumber} onOrderNumberChange={(value) => { setOrderNumber(value); setOrderProduction(null); setOperator(''); setOperatorIdentifier(''); setShift(''); setOrderProgress('IN_PROGRESS'); setProgressError(null); }} operatorName={operator} onOperatorNameChange={setOperator} employeeId={operatorIdentifier} onEmployeeIdChange={setOperatorIdentifier} shift={shift} onShiftChange={setShift} orderStatus={<label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-9 w-full min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark disabled:bg-hmiSection disabled:text-slate-400" value={orderProgress} disabled={!orderProduction || orderLookupLoading || progressSaving} onChange={(event) => void changeOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}><option value="IN_PROGRESS">{language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option><option value="COMPLETED">{language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option></select>{orderLookupLoading && <span className="text-[9px] normal-case text-info">{language === 'vi' ? 'Đang tra đơn…' : 'Looking up order…'}</span>}{progressSaving && <span className="text-[9px] normal-case text-info">{language === 'vi' ? 'Đang lưu…' : 'Saving…'}</span>}{progressError && <span role="alert" className="text-[9px] normal-case text-alarm">{progressError}</span>}</label>} />
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-2 border-industrialDark bg-white">
            <video ref={videoRef} className="sr-only" muted playsInline />
            {!canPerformChecklist && <section className="flex min-h-0 flex-1 items-center justify-center bg-white p-6"><div className="w-full max-w-md border-2 border-industrialDark border-t-4 border-t-industrialDark bg-white p-6 text-center shadow-[6px_6px_0_rgba(36,59,74,0.14)]"><h2 className="text-sm font-bold uppercase tracking-wider text-industrialDark">{t('camera')}</h2><p className="mt-2 text-xs leading-relaxed text-slate-600">{cameraText.beforeChecklist}</p>{error && <p className="mt-3 text-xs font-semibold text-alarm">{error}</p>}<div className="mx-auto mt-5 grid w-full max-w-xs gap-2"><HMIButton size="large" className="w-full justify-center" variant="primary" onClick={() => void openCameraPicker()}>{t('connectCamera')}</HMIButton><HMIButton size="large" className="w-full justify-center" onClick={() => { window.localStorage.setItem(BUFFING_CAMERA_SKIP_STORAGE_KEY, 'true'); setCameraSkipped(true); setError(null); }}>{cameraText.continueWithout}</HMIButton></div></div></section>}
            {canPerformChecklist && <>
            {error && <div className="buffing-no-print shrink-0 border-b border-alarm bg-white px-3 py-2 text-[10px] font-semibold text-alarm">{error}</div>}
            {cameraSkipped && !cameraConnected && <div className="buffing-no-print shrink-0 border-b border-line bg-hmiHover px-3 py-2 text-[10px] font-semibold text-industrialDark">{cameraText.skippedNotice}</div>}

            <section className="buffing-no-print shrink-0 border-b-2 border-white bg-white p-3">
              <div className="grid items-stretch gap-3 lg:grid-cols-[1.15fr_1fr]">
                <div className="box-border flex h-20 min-h-20 flex-col"><div className="mb-1 flex shrink-0 items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-600"><span>{t('currentCheck')}</span><time className="font-mono normal-case tracking-normal text-industrial">{currentFactoryDateTime()}</time></div><div className="grid min-h-0 flex-1 grid-cols-5 gap-1">{checks.map((checked, index) => <button key={index} type="button" className={`min-h-0 border-2 text-sm font-bold ${checked ? 'border-success bg-success text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => toggleCheck(index)}>{index + 1}<span className="block text-[8px]">{checked ? t('ok') : t('check')}</span></button>)}</div></div>
                <label className="box-border flex h-20 min-h-20 flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600"><span className="block h-4 shrink-0 leading-4">{t('remark')}</span><textarea className="box-border min-h-0 flex-1 resize-none border-2 border-line bg-white px-2 py-1 text-xs font-semibold" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={t('note')} /></label>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 bg-white">
                <div className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('checkInterval')}: <span className="ml-1 font-mono text-industrialDark">15 min</span></div>
                <div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void addCheck()} disabled={saving || loading || !orderNumber.trim() || !operator.trim() || !operatorIdentifier.trim() || !shift.trim()}>{saving ? t('saving') : t('confirmCheck')}</HMIButton></div>
              </div>
            </section>

            {canViewHistory && <section className="buffing-history flex min-h-0 flex-1 flex-col bg-white">
              <div className="flex shrink-0 items-center border-b border-line bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white"><span>{language === 'vi' ? 'HÔM NAY' : 'TODAY'}</span></div>
              <div className="buffing-history-scroll min-h-0 flex-1 overflow-auto bg-white p-2">
                <table className="w-full min-w-[1320px] border-collapse text-left text-[10px]">
                  <thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark">
                    <tr><th className="px-3 py-2">{t('time')}</th><th className="px-3 py-2">{t('orderNumber')}</th><th className="px-3 py-2">{t('operator')}</th><th className="px-3 py-2">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</th><th className="px-3 py-2">{language === 'vi' ? 'Ca làm' : 'Shift'}</th>{[1, 2, 3, 4, 5].map((point) => <th key={point} className="px-3 py-2 text-center">{point}</th>)}<th className="px-3 py-2">{t('remark')}</th><th className="px-3 py-2">{t('buffingImages')}</th><th className="w-12 px-2 py-2 text-center" aria-label={t('deleteCheck')}></th></tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={13} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('loadingHistory')}</td></tr> : rows.length === 0 ? <tr><td colSpan={13} className="px-3 py-8 text-center text-xs uppercase tracking-wide text-slate-500">{t('noChecksToday')}</td></tr> : rows.map((row) => <tr key={row.id} className="border-b border-line"><td className="px-3 py-2 font-mono font-bold text-industrial">{row.time}</td><td className="px-3 py-2 font-mono font-semibold text-industrialDark">{row.orderNumber || '—'}</td><td className="px-3 py-2 font-semibold text-industrialDark">{row.operator || '—'}</td><td className="px-3 py-2 font-mono">{row.operatorIdentifier || '—'}</td><td className="px-3 py-2">{row.shift || '—'}</td>{row.checks.map((checked, index) => <td key={index} className={`px-3 py-2 text-center text-lg font-bold ${checked ? 'text-success' : 'text-alarm'}`}>{checked ? '✓' : '×'}</td>)}<td className="px-3 py-2 text-slate-600">{row.remark || '—'}</td><td className="px-3 py-2">{row.images.length > 0 ? <button type="button" className="flex items-center gap-2 text-industrial underline" onClick={() => setGallery({ images: row.images, index: row.images.findIndex((image) => image.isPrimary) >= 0 ? row.images.findIndex((image) => image.isPrimary) : 0 })}><img src={row.images.find((image) => image.isPrimary)?.url ?? row.images[0].url} alt={t('primaryImage')} className="h-10 w-14 object-cover" /><span>{row.images.length} {t('imageCount')}</span></button> : <label className="inline-flex min-h-7 cursor-pointer items-center border border-industrial px-2 text-[9px] font-bold text-industrial hover:bg-hmiHover"><span>{t('addImage')}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void addManualImage(row.id, event)} /></label>}</td><td className="px-2 py-2 text-center"><button type="button" className="inline-flex h-7 w-7 items-center justify-center border border-alarm text-alarm hover:bg-red-50 disabled:cursor-wait disabled:opacity-50" title={t('deleteCheck')} aria-label={t('deleteCheck')} disabled={deletingId === row.id} onClick={() => void removeCheck(row.id)}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13" /></svg></button></td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>}
            </>}
            </section>
            </div>
          </div>
        </div>
      </div>
      {cameraPickerOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6" role="dialog" aria-modal="true" aria-label={t('camera')} onClick={() => !cameraConnecting && setCameraPickerOpen(false)}><div className="w-full max-w-md border-2 border-industrialDark bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between bg-industrialDark px-3 py-2 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">{t('camera')}</h2><button type="button" className="text-lg leading-none disabled:opacity-40" aria-label={t('cancel')} onClick={() => setCameraPickerOpen(false)} disabled={cameraConnecting}>×</button></header><div className="p-2">{cameraConnecting ? <div className="flex items-center justify-center gap-2 px-2 py-8 text-xs font-semibold text-slate-600"><span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-industrial" aria-hidden="true" />{cameraText.waitingPermission}</div> : cameras.length > 0 ? cameras.map((camera, index) => <button key={camera.deviceId} type="button" className={`mb-1 flex w-full items-center justify-between border px-3 py-2 text-left text-xs font-semibold ${camera.deviceId === selectedCameraId ? 'border-industrial bg-hmiSelected text-industrialDark' : 'border-line bg-white hover:bg-hmiHover'}`} onClick={() => void connectCamera(camera.deviceId)}><span>{camera.label || `${t('camera')} ${index + 1}`}</span>{camera.deviceId === selectedCameraId && <span className="text-[9px] uppercase tracking-wide">{t('cameraConnected')}</span>}</button>) : <p className="px-2 py-4 text-xs leading-relaxed text-alarm">{error || t('cameraUnavailable')}</p>}</div></div></div>}
      {gallery && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={t('buffingImages')} onClick={() => setGallery(null)}><div className="relative flex max-h-full max-w-full flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={t('closeGallery')} className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center bg-industrial text-lg text-white shadow-lg" onClick={() => setGallery(null)}>×</button><img src={gallery.images[gallery.index].url} alt={`${t('buffingImages')} ${gallery.index + 1}`} className="block w-[min(92vw,1440px)] max-h-[calc(100vh-7rem)] aspect-[4/3] object-contain shadow-2xl" /><div className="flex w-full items-center justify-between gap-3 text-white"><button type="button" aria-label={t('previousImage')} className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40" disabled={gallery.index === 0} onClick={() => setGallery((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}>‹</button><span className="text-xs font-bold">{gallery.index + 1} / {gallery.images.length}</span><button type="button" aria-label={t('nextImage')} className="h-9 w-12 border border-white/60 bg-industrial/90 text-xl disabled:opacity-40" disabled={gallery.index === gallery.images.length - 1} onClick={() => setGallery((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current)}>›</button></div></div></div>}
    </WS3Shell>
  );
}
