import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'vi' | 'en';

type TranslationKey =
  | 'home' | 'recordEntry' | 'overview' | 'history' | 'operatorTerminal'
  | 'scouring' | 'scouringOverview' | 'scouringRecord' | 'scouringHistory'
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
  | 'enterBatch' | 'enterOperator' | 'expected' | 'manualEntry' | 'scouringParameters' | 'fields' | 'machineReferenceReserved' | 'back';

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    home: 'HOME', recordEntry: 'RECORD ENTRY', overview: 'OVERVIEW', history: 'HISTORY', operatorTerminal: 'Operator terminal',
    scouring: 'SCOURING', scouringOverview: 'Scouring Overview', scouringRecord: 'Scouring Record', scouringHistory: 'Scouring History',
    chemicalInput: 'CHEMICAL INPUT', processConditions: 'PROCESS CONDITIONS', production: 'PRODUCTION', recordContext: 'RECORD CONTEXT',
    machine: 'MACHINE', batch: 'BATCH', batchId: 'BATCH ID', orderNumber: 'ORDER NO.', item: 'ITEM', lotYarn: 'LOT YARN', lotNumber: 'LOT NO.', operator: 'OPERATOR', recordedTime: 'RECORDED TIME', status: 'STATUS',
    complete: 'COMPLETE', incomplete: 'INCOMPLETE', warning: 'WARNING', dataWarning: 'DATA / PROCESS WARNING', noSelection: 'NO SELECTION',
    latestRecord: 'LATEST RECORD', inputMeters: 'INPUT METERS', outputMeters: 'OUTPUT METERS', speed: 'SPEED', temperature: 'TEMPERATURE',
    cylinderTemperature: 'CYLINDER TEMPERATURE', fabricInput: 'FABRIC INPUT', fabricOutput: 'FABRIC OUTPUT', productionQuantity: 'PRODUCTION QUANTITY', optional: 'optional',
    saveRecord: 'SAVE RECORD', saving: 'SAVING...', cancel: 'CANCEL', retry: 'RETRY', clearFilters: 'CLEAR FILTERS',
    recordFilters: 'RECORD FILTERS', allStatuses: 'All statuses', searchWhenAvailable: 'Search when available', newestFirst: 'Newest first',
    recordDetail: 'RECORD DETAIL', noRecords: 'No Scouring records yet.', noMatchingRecords: 'No records match the current filters.', loadingRecords: 'Loading Scouring records...',
    unableToLoadRecords: 'Unable to load Scouring records.', backendUnavailable: 'Scouring backend unavailable.', notImplemented: 'NOT IMPLEMENTED',
    openScouring: 'OPEN SCOURING', recordSaved: 'RECORD SAVED · Returning to Scouring overview...', saveError: 'SAVE ERROR', completeRequired: 'ERROR · Complete all required values before saving.',
    enterBatch: 'Enter batch', enterOperator: 'Enter operator', expected: 'Expected', manualEntry: 'MANUAL ENTRY', scouringParameters: 'SCOURING PARAMETERS', fields: 'FIELDS', machineReferenceReserved: 'MACHINE REFERENCE RESERVED', back: 'BACK',
  },
  vi: {
    home: 'TRANG CHỦ', recordEntry: 'NHẬP BẢN GHI', overview: 'TỔNG QUAN', history: 'LỊCH SỬ', operatorTerminal: 'Thiết bị vận hành',
    scouring: 'SCOURING', scouringOverview: 'Tổng quan Scouring', scouringRecord: 'Nhập bản ghi Scouring', scouringHistory: 'Lịch sử Scouring',
    chemicalInput: 'HÓA CHẤT', processConditions: 'ĐIỀU KIỆN QUY TRÌNH', production: 'SẢN XUẤT', recordContext: 'THÔNG TIN BẢN GHI',
    machine: 'MÁY', batch: 'MẺ', batchId: 'MÃ MẺ', orderNumber: 'SỐ ORDER', item: 'MẶT HÀNG', lotYarn: 'LOT SỢI', lotNumber: 'SỐ LOT', operator: 'NGƯỜI VẬN HÀNH', recordedTime: 'THỜI GIAN GHI', status: 'TRẠNG THÁI',
    complete: 'ĐẦY ĐỦ', incomplete: 'CHƯA ĐẦY ĐỦ', warning: 'CẢNH BÁO', dataWarning: 'CẢNH BÁO DỮ LIỆU / QUY TRÌNH', noSelection: 'CHƯA CHỌN',
    latestRecord: 'BẢN GHI MỚI NHẤT', inputMeters: 'MÉT VẢI VÀO', outputMeters: 'MÉT VẢI RA', speed: 'TỐC ĐỘ', temperature: 'NHIỆT ĐỘ',
    cylinderTemperature: 'NHIỆT ĐỘ XI LANH', fabricInput: 'VẢI ĐẦU VÀO', fabricOutput: 'VẢI ĐẦU RA', productionQuantity: 'SẢN LƯỢNG', optional: 'không bắt buộc',
    saveRecord: 'LƯU BẢN GHI', saving: 'ĐANG LƯU...', cancel: 'HỦY', retry: 'THỬ LẠI', clearFilters: 'XÓA BỘ LỌC',
    recordFilters: 'BỘ LỌC BẢN GHI', allStatuses: 'Tất cả trạng thái', searchWhenAvailable: 'Tìm theo dữ liệu', newestFirst: 'Mới nhất trước',
    recordDetail: 'CHI TIẾT BẢN GHI', noRecords: 'Chưa có bản ghi Scouring.', noMatchingRecords: 'Không có bản ghi phù hợp bộ lọc.', loadingRecords: 'Đang tải bản ghi Scouring...',
    unableToLoadRecords: 'Không thể tải bản ghi Scouring.', backendUnavailable: 'Không kết nối được máy chủ Scouring.', notImplemented: 'CHƯA TRIỂN KHAI',
    openScouring: 'MỞ SCOURING', recordSaved: 'ĐÃ LƯU BẢN GHI · Đang quay lại tổng quan Scouring...', saveError: 'LỖI LƯU', completeRequired: 'LỖI · Hãy nhập đủ các giá trị bắt buộc trước khi lưu.',
    enterBatch: 'Nhập mã mẻ', enterOperator: 'Nhập người vận hành', expected: 'Khoảng chuẩn', manualEntry: 'NHẬP THỦ CÔNG', scouringParameters: 'THÔNG SỐ SCOURING', fields: 'TRƯỜNG', machineReferenceReserved: 'THAM CHIẾU MÁY DỰ PHÒNG', back: 'QUAY LẠI',
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
