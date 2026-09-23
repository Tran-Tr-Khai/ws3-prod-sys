import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'vi' | 'en';

type TranslationKey =
  | 'home' | 'recordEntry' | 'overview' | 'history' | 'operatorTerminal'
  | 'scouring' | 'scouringOverview' | 'scouringReport' | 'scouringRecord' | 'scouringHistory'
  | 'chemicalInput' | 'processConditions' | 'production' | 'recordContext'
  | 'machine' | 'batch' | 'batchId' | 'orderNumber' | 'item' | 'lotYarn' | 'lotNumber' | 'operator' | 'recordedTime' | 'status'
  | 'complete' | 'incomplete' | 'warning' | 'dataWarning' | 'noSelection'
  | 'latestRecord' | 'inputMeters' | 'outputMeters' | 'speed' | 'temperature'
  | 'cylinderTemperature' | 'fabricInput' | 'fabricOutput' | 'productionQuantity' | 'optional'
  | 'saveRecord' | 'saving' | 'cancel' | 'retry' | 'clearFilters'
  | 'recordFilters' | 'allStatuses' | 'searchWhenAvailable' | 'newestFirst'
  | 'recordDetail' | 'noRecords' | 'noMatchingRecords' | 'loadingRecords'
  | 'unableToLoadRecords' | 'backendUnavailable' | 'notImplemented'
  | 'openScouring' | 'recordSaved' | 'saveError' | 'completeRequired'
  | 'enterBatch' | 'enterOperator' | 'expected' | 'manualEntry' | 'scouringParameters' | 'fields' | 'machineReferenceReserved' | 'back'
  | 'entryMenu' | 'operationRecord' | 'operationRecordDescription' | 'phInspection' | 'phInspectionDescription' | 'openForm' | 'inspectionContext' | 'inspectionTime' | 'tanks' | 'enterCheckedTanks' | 'note' | 'phStandardsPending' | 'saveCheck'
  | 'operation' | 'lastRecorded' | 'fabricInOut' | 'checkPoints' | 'interval' | 'ready' | 'periodicChecklist' | 'openBuffing' | 'loadingRecorded' | 'noScouringRecords' | 'noBuffingRecords' | 'scouringUnavailable' | 'temperatureWarning' | 'speedWarning' | 'view' | 'manualInspectionEntry' | 'tank' | 'systemTitle' | 'productionOverview' | 'noData' | 'buffingDailyCheck' | 'time' | 'currentCheck' | 'check' | 'ok' | 'loadingHistory' | 'noChecksToday' | 'checkInterval' | 'confirmCheck' | 'remark' | 'buffingCheckWarning' | 'buffingImages' | 'buffingImageRequired' | 'buffingImageLimit' | 'buffingImageFormat' | 'primaryImage' | 'removeImages' | 'imageCount' | 'previousImage' | 'nextImage' | 'closeGallery' | 'chooseImages' | 'noImages'
  | 'loginTitle' | 'loginSubtitle' | 'username' | 'password' | 'login' | 'logout' | 'invalidCredentials'
  | 'support' | 'supportOperations' | 'requestList' | 'messageAdmin' | 'noRequests' | 'createRequest' | 'cancel' | 'send' | 'subject' | 'messagePlaceholder' | 'subjectPlaceholder' | 'requestPlaceholder' | 'chooseRequest' | 'resolved' | 'supportLoadError' | 'supportCreateError' | 'supportMessageError';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    home: 'HOME', recordEntry: 'RECORD ENTRY', overview: 'REPORT', history: 'HISTORY', operatorTerminal: 'Operator terminal',
    scouring: 'SCOURING', scouringOverview: 'Scouring Overview', scouringReport: 'Scouring Report', scouringRecord: 'Scouring Record', scouringHistory: 'Scouring History',
    chemicalInput: 'CHEMICAL INPUT', processConditions: 'PROCESS CONDITIONS', production: 'PRODUCTION', recordContext: 'RECORD CONTEXT',
    machine: 'MACHINE', batch: 'BATCH', batchId: 'BATCH ID', orderNumber: 'ORDER NO.', item: 'ITEM', lotYarn: 'LOT YARN', lotNumber: 'LOT NO.', operator: 'OPERATOR', recordedTime: 'RECORDED TIME', status: 'STATUS',
    complete: 'COMPLETE', incomplete: 'INCOMPLETE', warning: 'WARNING', dataWarning: 'DATA / PROCESS WARNING', noSelection: 'NO SELECTION',
    latestRecord: 'LATEST RECORD', inputMeters: 'INPUT METERS', outputMeters: 'OUTPUT METERS', speed: 'SPEED', temperature: 'TEMPERATURE',
    cylinderTemperature: 'CYLINDER TEMPERATURE', fabricInput: 'FABRIC INPUT', fabricOutput: 'FABRIC OUTPUT', productionQuantity: 'PRODUCTION QUANTITY', optional: 'optional',
    saveRecord: 'SAVE RECORD', saving: 'SAVING...', cancel: 'CANCEL', retry: 'RETRY', clearFilters: 'CLEAR FILTERS',
    loginTitle: 'SYSTEM LOGIN', loginSubtitle: 'Select an account to view its permitted machines.', username: 'USERNAME', password: 'PASSWORD', login: 'LOG IN', logout: 'LOG OUT', invalidCredentials: 'Invalid username or password.',
    support: 'SUPPORT', supportOperations: 'OPERATIONS SUPPORT', requestList: 'REQUESTS', messageAdmin: 'Message Admin', noRequests: 'No requests yet.', createRequest: 'CREATE NEW REQUEST', send: 'SEND', subject: 'SUBJECT', messagePlaceholder: 'Type a message...', subjectPlaceholder: 'Request subject', requestPlaceholder: 'Describe the issue...', chooseRequest: 'Select a request to view messages.', resolved: 'RESOLVED', supportLoadError: 'Unable to load support requests.', supportCreateError: 'Unable to create the request.', supportMessageError: 'Unable to send the message.',
    recordFilters: 'RECORD FILTERS', allStatuses: 'All statuses', searchWhenAvailable: 'Search when available', newestFirst: 'Newest first',
    recordDetail: 'RECORD DETAIL', noRecords: 'No Scouring records yet.', noMatchingRecords: 'No records match the current filters.', loadingRecords: 'Loading Scouring records...',
    unableToLoadRecords: 'Unable to load Scouring records.', backendUnavailable: 'Scouring backend unavailable.', notImplemented: 'NOT IMPLEMENTED',
    openScouring: 'OPEN SCOURING', recordSaved: 'RECORD SAVED · Returning to Scouring overview...', saveError: 'SAVE ERROR', completeRequired: 'ERROR · Complete all required values before saving.',
    enterBatch: 'Enter batch', enterOperator: 'Enter operator', expected: 'Expected', manualEntry: 'MANUAL ENTRY', scouringParameters: 'SCOURING PARAMETERS', fields: 'FIELDS', machineReferenceReserved: 'MACHINE REFERENCE RESERVED', back: 'BACK', entryMenu: 'SELECT RECORD TYPE', operationRecord: 'OPERATION RECORD', operationRecordDescription: 'Machine operation parameters, chemicals, process conditions and production data.', phInspection: 'TEST PH', phInspectionDescription: 'Tank pH checks recorded manually at the time of inspection.', openForm: 'OPEN FORM', inspectionContext: 'INSPECTION CONTEXT', inspectionTime: 'INSPECTION TIME', tanks: 'TANKS', enterCheckedTanks: 'Enter the tanks checked during this inspection', note: 'NOTE', phStandardsPending: 'PH LIMITS PENDING FACTORY CONFIRMATION', saveCheck: 'SAVE CHECK', operation: 'OPERATION', lastRecorded: 'LAST RECORDED', fabricInOut: 'FABRIC IN / OUT', checkPoints: 'CHECK POINTS', interval: 'INTERVAL', ready: 'READY', periodicChecklist: 'PERIODIC MACHINE CHECKLIST', openBuffing: 'OPEN BUFFING', loadingRecorded: 'LOADING RECORDED DATA...', noScouringRecords: 'NO SCOURING RECORDS YET.', noBuffingRecords: 'NO BUFFING RECORDS YET.', scouringUnavailable: 'SCOURING BACKEND UNAVAILABLE.', temperatureWarning: 'WARNING · TEMPERATURE OUTSIDE EXPECTED 90–98 °C', speedWarning: 'WARNING · SPEED OUTSIDE EXPECTED 40–50 M/MIN', view: 'VIEW', manualInspectionEntry: 'MANUAL INSPECTION ENTRY', tank: 'TANK', systemTitle: 'WS3 PRODUCTION SYSTEM', productionOverview: 'Production overview · recorded data', noData: 'NO DATA', buffingDailyCheck: 'BUFFING DAILY CHECK', time: 'TIME', currentCheck: 'CURRENT CHECK', check: 'CHECK', ok: 'OK', loadingHistory: 'LOADING HISTORY...', noChecksToday: 'NO CHECKS RECORDED FOR THIS DAY.', checkInterval: 'CHECK INTERVAL', confirmCheck: 'CONFIRM CHECK', remark: 'REMARK', buffingCheckWarning: 'WARNING · CHECK {points} FAILED', buffingImages: 'IMAGES', buffingImageRequired: 'Add at least one image for a failed check.', buffingImageLimit: 'You can select up to 10 images.', buffingImageFormat: 'Use JPG, PNG or WEBP images up to 5 MB each.', primaryImage: 'PRIMARY', removeImages: 'CLEAR', imageCount: 'images', previousImage: 'Previous image', nextImage: 'Next image', closeGallery: 'Close gallery', chooseImages: 'Choose images', noImages: 'No images selected',
  },
  vi: {
    home: 'TRANG CHỦ', recordEntry: 'NHẬP BẢN GHI', overview: 'BÁO CÁO', history: 'LỊCH SỬ', operatorTerminal: 'Thiết bị vận hành',
    scouring: 'SCOURING', scouringOverview: 'Tổng quan Scouring', scouringReport: 'Báo cáo Scouring', scouringRecord: 'Nhập bản ghi Scouring', scouringHistory: 'Lịch sử Scouring',
    chemicalInput: 'HÓA CHẤT', processConditions: 'ĐIỀU KIỆN QUY TRÌNH', production: 'SẢN XUẤT', recordContext: 'THÔNG TIN BẢN GHI',
    machine: 'MÁY', batch: 'MẺ', batchId: 'MÃ MẺ', orderNumber: 'SỐ ORDER', item: 'MẶT HÀNG', lotYarn: 'LOT SỢI', lotNumber: 'SỐ LOT', operator: 'NGƯỜI VẬN HÀNH', recordedTime: 'THỜI GIAN GHI', status: 'TRẠNG THÁI',
    complete: 'ĐẦY ĐỦ', incomplete: 'CHƯA ĐẦY ĐỦ', warning: 'CẢNH BÁO', dataWarning: 'CẢNH BÁO DỮ LIỆU / QUY TRÌNH', noSelection: 'CHƯA CHỌN',
    latestRecord: 'BẢN GHI MỚI NHẤT', inputMeters: 'MÉT VẢI VÀO', outputMeters: 'MÉT VẢI RA', speed: 'TỐC ĐỘ', temperature: 'NHIỆT ĐỘ',
    cylinderTemperature: 'NHIỆT ĐỘ XI LANH', fabricInput: 'VẢI ĐẦU VÀO', fabricOutput: 'VẢI ĐẦU RA', productionQuantity: 'SẢN LƯỢNG', optional: 'không bắt buộc',
    saveRecord: 'LƯU BẢN GHI', saving: 'ĐANG LƯU...', cancel: 'HỦY', retry: 'THỬ LẠI', clearFilters: 'XÓA BỘ LỌC',
    loginTitle: 'ĐĂNG NHẬP HỆ THỐNG', loginSubtitle: 'Chọn tài khoản để xem các máy được cấp quyền.', username: 'TÊN ĐĂNG NHẬP', password: 'MẬT KHẨU', login: 'ĐĂNG NHẬP', logout: 'ĐĂNG XUẤT', invalidCredentials: 'Tên đăng nhập hoặc mật khẩu không đúng.',
    support: 'HỖ TRỢ', supportOperations: 'HỖ TRỢ VẬN HÀNH', requestList: 'YÊU CẦU', messageAdmin: 'Nhắn tin với Admin', noRequests: 'Chưa có yêu cầu.', createRequest: 'TẠO YÊU CẦU MỚI', send: 'GỬI', subject: 'TIÊU ĐỀ', messagePlaceholder: 'Nhập tin nhắn...', subjectPlaceholder: 'Tiêu đề yêu cầu', requestPlaceholder: 'Mô tả vấn đề cần hỗ trợ...', chooseRequest: 'Chọn yêu cầu để xem tin nhắn.', resolved: 'ĐÃ GIẢI QUYẾT', supportLoadError: 'Không thể tải yêu cầu hỗ trợ.', supportCreateError: 'Không thể tạo yêu cầu.', supportMessageError: 'Không thể gửi tin nhắn.',
    recordFilters: 'BỘ LỌC BẢN GHI', allStatuses: 'Tất cả trạng thái', searchWhenAvailable: 'Tìm theo dữ liệu', newestFirst: 'Mới nhất trước',
    recordDetail: 'CHI TIẾT BẢN GHI', noRecords: 'Chưa có bản ghi Scouring.', noMatchingRecords: 'Không có bản ghi phù hợp bộ lọc.', loadingRecords: 'Đang tải bản ghi Scouring...',
    unableToLoadRecords: 'Không thể tải bản ghi Scouring.', backendUnavailable: 'Không kết nối được máy chủ Scouring.', notImplemented: 'CHƯA TRIỂN KHAI',
    openScouring: 'MỞ SCOURING', recordSaved: 'ĐÃ LƯU BẢN GHI · Đang quay lại tổng quan Scouring...', saveError: 'LỖI LƯU', completeRequired: 'LỖI · Hãy nhập đủ các giá trị bắt buộc trước khi lưu.',
    enterBatch: 'Nhập mã mẻ', enterOperator: 'Nhập người vận hành', expected: 'Khoảng chuẩn', manualEntry: 'NHẬP THỦ CÔNG', scouringParameters: 'THÔNG SỐ SCOURING', fields: 'TRƯỜNG', machineReferenceReserved: 'THAM CHIẾU MÁY DỰ PHÒNG', back: 'QUAY LẠI', entryMenu: 'CHỌN LOẠI BẢN GHI', operationRecord: 'BẢN GHI VẬN HÀNH', operationRecordDescription: 'Thông số máy, hóa chất, điều kiện quy trình và dữ liệu sản xuất.', phInspection: 'TEST PH', phInspectionDescription: 'Ghi nhận thủ công kết quả kiểm tra pH các bồn tại thời điểm kiểm tra.', openForm: 'MỞ BIỂU MẪU', inspectionContext: 'THÔNG TIN KIỂM TRA', inspectionTime: 'THỜI GIAN KIỂM TRA', tanks: 'BỒN', enterCheckedTanks: 'Nhập các bồn đã kiểm tra', note: 'GHI CHÚ', phStandardsPending: 'ĐANG CHỜ XÁC NHẬN GIỚI HẠN PH TỪ NHÀ MÁY', saveCheck: 'LƯU KIỂM TRA', operation: 'VẬN HÀNH', lastRecorded: 'GHI NHẬN GẦN NHẤT', fabricInOut: 'VẢI VÀO / RA', checkPoints: 'ĐIỂM KIỂM TRA', interval: 'CHU KỲ', ready: 'SẴN SÀNG', periodicChecklist: 'CHECKLIST MÁY ĐỊNH KỲ', openBuffing: 'MỞ BUFFING', loadingRecorded: 'ĐANG TẢI DỮ LIỆU ĐÃ GHI...', noScouringRecords: 'CHƯA CÓ BẢN GHI SCOURING.', noBuffingRecords: 'CHƯA CÓ BẢN GHI BUFFING.', scouringUnavailable: 'KHÔNG KẾT NỐI ĐƯỢC MÁY CHỦ SCOURING.', temperatureWarning: 'CẢNH BÁO · NHIỆT ĐỘ NGOÀI KHOẢNG 90–98 °C', speedWarning: 'CẢNH BÁO · TỐC ĐỘ NGOÀI KHOẢNG 40–50 M/PHÚT', view: 'XEM', manualInspectionEntry: 'NHẬP KIỂM TRA THỦ CÔNG', tank: 'BỒN', systemTitle: 'HỆ THỐNG SẢN XUẤT WS3', productionOverview: 'Tổng quan sản xuất · dữ liệu đã ghi', noData: 'CHƯA CÓ DỮ LIỆU', buffingDailyCheck: 'KIỂM TRA BUFFING HẰNG NGÀY', time: 'THỜI GIAN', currentCheck: 'KIỂM TRA HIỆN TẠI', check: 'KIỂM TRA', ok: 'ĐẠT', loadingHistory: 'ĐANG TẢI LỊCH SỬ...', noChecksToday: 'CHƯA CÓ KIỂM TRA TRONG NGÀY NÀY.', checkInterval: 'CHU KỲ KIỂM TRA', confirmCheck: 'XÁC NHẬN KIỂM TRA', remark: 'GHI CHÚ', buffingCheckWarning: 'CẢNH BÁO · KIỂM TRA {points} KHÔNG ĐẠT', buffingImages: 'HÌNH ẢNH', buffingImageRequired: 'Khi kiểm tra không đạt, cần thêm ít nhất một hình ảnh.', buffingImageLimit: 'Có thể chọn tối đa 10 hình ảnh.', buffingImageFormat: 'Chỉ dùng JPG, PNG hoặc WEBP, tối đa 5 MB mỗi ảnh.', primaryImage: 'ĐẠI DIỆN', removeImages: 'XÓA', imageCount: 'ảnh', previousImage: 'Ảnh trước', nextImage: 'Ảnh sau', closeGallery: 'Đóng thư viện ảnh', chooseImages: 'CHỌN ẢNH', noImages: 'Chưa chọn ảnh',
  },
};

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => window.localStorage.getItem('ws3-language') === 'en' ? 'en' : 'vi');
  const changeLanguage = (next: Language) => { setLanguage(next); window.localStorage.setItem('ws3-language', next); };
  const value = useMemo(() => ({ language, setLanguage: changeLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
