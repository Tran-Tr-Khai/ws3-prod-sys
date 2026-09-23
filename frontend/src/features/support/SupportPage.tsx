import { useCallback, useEffect, useMemo, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { createSupportMessage, createSupportTicket, getSupportMessages, getSupportTickets, updateSupportStatus, type SupportMessage, type SupportTicket } from './supportApi';

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [machineId, setMachineId] = useState(user?.machineIds[0] ?? 'SC-01');
  const [priority, setPriority] = useState('NORMAL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    try { setTickets(await getSupportTickets(user.username, user.role)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải yêu cầu hỗ trợ.'); }
    finally { setLoading(false); }
  }, [user]);

  const loadMessages = useCallback(async () => {
    if (!selectedId) { setMessages([]); return; }
    try { setMessages(await getSupportMessages(selectedId)); } catch { setMessages([]); }
  }, [selectedId]);

  useEffect(() => { void loadTickets(); const timer = window.setInterval(() => void loadTickets(), 5000); return () => window.clearInterval(timer); }, [loadTickets]);
  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const submitTicket = async () => {
    if (!user || !subject.trim() || !message.trim()) return;
    try { const ticket = await createSupportTicket({ machineId, subject: subject.trim(), priority, message: message.trim() }); setSubject(''); setMessage(''); setSelectedId(ticket.id); await loadTickets(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tạo yêu cầu.'); }
  };

  const sendMessage = async () => {
    if (!user || !selectedId || !message.trim()) return;
    try { await createSupportMessage(selectedId, { message: message.trim() }); setMessage(''); await loadMessages(); await loadTickets(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể gửi tin nhắn.'); }
  };

  const closeTicket = async () => { if (!selectedId) return; await updateSupportStatus(selectedId, 'RESOLVED'); await loadTickets(); };

  const isOwnMessage = (sender: string) => sender.trim().toLowerCase() === user?.username.trim().toLowerCase();
  return <WS3Shell title="WS3 / SUPPORT" subtitle="Internal support chat" status="info" time={new Date().toLocaleTimeString('vi-VN')} showGlobalNavigation><div className="flex h-full min-h-0 flex-col bg-hmiConsole p-2 text-slate-800"><div className="mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col border-2 border-industrialDark bg-white"><header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><div><h1 className="text-sm font-bold uppercase tracking-wider">HỖ TRỢ VẬN HÀNH</h1><p className="mt-1 text-[10px] text-slate-300">Trao đổi trực tiếp với Admin</p></div><span className="text-[10px] font-bold uppercase text-slate-300">{user?.role} · {user?.username}</span></header><div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="flex min-h-0 flex-col border-b-2 border-industrialDark bg-hmiSection lg:border-b-0 lg:border-r-2"><div className="flex items-center justify-between border-b border-line px-3 py-2 text-[10px] font-bold uppercase text-industrialDark"><span>YÊU CẦU</span><span>{tickets.length}</span></div><div className="min-h-0 flex-1 overflow-auto">{loading ? <div className="p-4 text-xs text-slate-500">Đang tải...</div> : tickets.length === 0 ? <div className="p-4 text-xs text-slate-500">Chưa có yêu cầu.</div> : tickets.map((ticket) => <button key={ticket.id} type="button" className={`block w-full border-b border-line px-3 py-2 text-left ${selectedId === ticket.id ? 'bg-hmiSelected' : 'bg-white hover:bg-hmiHover'}`} onClick={() => { setSelectedId(ticket.id); setMessage(''); }}><div className="flex justify-between gap-2 text-[10px] font-bold"><span className="truncate">{ticket.subject}</span><span className={ticket.status === 'RESOLVED' ? 'text-success' : 'text-warning'}>{ticket.status}</span></div><div className="mt-1 text-[9px] text-slate-500">{ticket.machineId} · {ticket.createdBy} · {formatTime(ticket.updatedAt)}</div></button>)}</div></aside><section className="flex min-h-0 flex-col bg-white">{selected ? <><header className="flex shrink-0 items-center justify-between border-b border-line bg-white px-3 py-2"><div><h2 className="text-xs font-bold uppercase text-industrialDark">{selected.subject}</h2><div className="mt-1 text-[10px] text-slate-500">{selected.machineId} · {selected.createdBy} · {selected.priority}</div></div>{canManage && selected.status !== 'RESOLVED' && <HMIButton size="compact" onClick={() => void closeTicket()}>ĐÃ GIẢI QUYẾT</HMIButton>}</header><div className="min-h-0 flex-1 space-y-2 overflow-auto bg-hmiConsole p-3">{messages.map((item) => <div key={item.id} className={`max-w-[80%] border border-line px-3 py-2 text-xs ${isOwnMessage(item.sender) ? 'ml-auto bg-industrial text-white' : 'bg-white text-slate-800'}`}><div className="mb-1 text-[9px] font-bold uppercase opacity-70">{item.sender} · {formatTime(item.sentAt)}</div><div className="whitespace-pre-wrap">{item.message}</div></div>)}</div><div className="flex shrink-0 gap-2 border-t border-line bg-hmiSection p-2"><textarea className="min-h-12 flex-1 resize-none border-2 border-line bg-white px-2 py-2 text-xs" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Nhập phản hồi..." onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} /><HMIButton variant="primary" size="compact" onClick={() => void sendMessage()} disabled={!message.trim()}>GỬI</HMIButton></div></> : <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-xs text-slate-500">Chọn một yêu cầu hoặc tạo yêu cầu mới.</div>}</section></div>{!canManage && <section className="shrink-0 border-t-2 border-industrialDark bg-hmiSection p-3"><div className="mb-2 text-[10px] font-bold uppercase text-industrialDark">TẠO YÊU CẦU MỚI</div><div className="grid gap-2 lg:grid-cols-[180px_130px_1fr]"><select className="min-h-9 border-2 border-line bg-white px-2 text-xs" value={machineId} onChange={(event) => setMachineId(event.target.value)}>{user?.machineIds.map((id) => <option key={id} value={id}>{id}</option>)}</select><select className="min-h-9 border-2 border-line bg-white px-2 text-xs" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="NORMAL">Bình thường</option><option value="WARNING">Cảnh báo</option><option value="URGENT">Khẩn cấp</option></select><input className="min-h-9 border-2 border-line bg-white px-2 text-xs" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Tiêu đề yêu cầu" /></div><div className="mt-2 flex gap-2"><textarea className="min-h-12 flex-1 resize-none border-2 border-line bg-white px-2 py-2 text-xs" value={selected ? message : message} onChange={(event) => setMessage(event.target.value)} placeholder="Mô tả vấn đề cần hỗ trợ..." /><HMIButton variant="primary" onClick={() => void submitTicket()} disabled={!subject.trim() || !message.trim()}>GỬI YÊU CẦU</HMIButton></div></section>}{error && <div className="shrink-0 border-t border-alarm bg-white px-3 py-2 text-[10px] text-alarm">{error}</div>}</div></div></WS3Shell>;
}
