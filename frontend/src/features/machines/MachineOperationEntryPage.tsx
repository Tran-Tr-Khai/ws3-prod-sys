import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { useLanguage } from '../../i18n/LanguageContext';

const machineNames: Record<string, { vi: string; en: string }> = {
  DY: { vi: 'Nhuộm', en: 'Dyeing' }, WA: { vi: 'Giặt', en: 'Washing' }, SK: { vi: 'Skachar', en: 'Skachar' },
  TE: { vi: 'Định hình', en: 'Tentering' }, CA: { vi: 'Cán', en: 'Calendaring' }, RA: { vi: 'Cào lông', en: 'Raising' }, SU: { vi: 'Mài lông', en: 'Sueding' },
};

export function MachineOperationEntryPage() {
  const { machineId = '' } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isMachineOperator = user?.role === 'OPERATOR';
  const [orderNumber, setOrderNumber] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [shift, setShift] = useState('');
  const prefix = machineId.split('-')[0].toUpperCase();
  const machineName = machineNames[prefix]?.[language] ?? prefix;

  return <WS3Shell title={`WS3 / ${machineName}`} subtitle={language === 'vi' ? 'Nhập thông tin vận hành' : 'Operation information'} machineId={machineId} machineLabel={machineName} status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={!isMachineOperator}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <MachineNavigation machineId={machineId} machineLabel={machineName} trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{language === 'vi' ? 'TRANG CHỦ' : 'HOME'}</HMIButton>} />
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="mx-auto grid min-h-full w-full max-w-[1440px] gap-2 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
          <aside className="h-fit border-2 border-industrialDark bg-white">
            <header className="border-b-2 border-industrialDark bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-industrialDark">{language === 'vi' ? 'THÔNG TIN VẬN HÀNH' : 'OPERATION DETAILS'}</header>
            <OperationInfoFields orderNumber={orderNumber} onOrderNumberChange={setOrderNumber} operatorName={operatorName} onOperatorNameChange={setOperatorName} employeeId={employeeId} onEmployeeIdChange={setEmployeeId} shift={shift} onShiftChange={setShift} />
          </aside>
          <section className="min-h-56 border-2 border-industrialDark bg-white">
            <header className="border-b-2 border-industrialDark bg-industrialDark px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">{machineName} · {machineId}</header>
            <div className="p-4 text-xs text-slate-500">{language === 'vi' ? 'Nội dung và chức năng riêng của máy sẽ được bổ sung sau khi thống nhất quy trình.' : 'Machine-specific content and functions will be added after its workflow is defined.'}</div>
            <div className="border-t border-line bg-hmiSection px-4 py-3 text-[10px] font-semibold text-slate-500">{language === 'vi' ? 'Thông tin vận hành hiện là dữ liệu nhập tạm trên trang; chức năng lưu sẽ được nối cùng quy trình riêng của máy.' : 'Operation details are temporary page input; saving will be connected with the machine-specific workflow.'}</div>
          </section>
        </div>
        {isMachineOperator && <div className="mx-auto mt-2 w-full max-w-[1440px]"><SupportChatWidget embedded /></div>}
      </div>
    </div>
  </WS3Shell>;
}
