import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { createSupportMessage, createSupportTicket, deleteSupportTicket, getSupportMessages, getSupportTickets, markSupportTicketRead, type SupportMessage, type SupportTicket } from './supportApi';

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const SUPPORT_WIDGET_HIDDEN_KEY = 'ws3.support-widget-hidden';

export function SupportChatWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(SUPPORT_WIDGET_HIDDEN_KEY) === 'true');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [newTicket, setNewTicket] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets]);
  const unreadCount = tickets.reduce((total, ticket) => total + ticket.unreadCount, 0);

  const refreshTickets = useCallback(async () => {
    if (!user) return;
    try { setTickets(await getSupportTickets(user.username, user.role)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('supportLoadError')); }
  }, [t, user]);
  const refreshMessages = useCallback(async () => {
    if (!selectedId) { setMessages([]); return; }
    try { setMessages(await getSupportMessages(selectedId)); } catch { setMessages([]); }
  }, [selectedId]);
  useEffect(() => { if (open) void refreshTickets(); }, [open, refreshTickets]);
  useEffect(() => { if (open) void refreshMessages(); }, [open, refreshMessages]);

  const submitNewTicket = async () => {
    if (!user || !subject.trim() || !draft.trim()) return;
    setLoading(true);
    try { const ticket = await createSupportTicket({ machineId: user.machineIds[0] ?? 'WS3', subject: subject.trim(), priority: 'NORMAL', message: draft.trim() }); setSubject(''); setDraft(''); setNewTicket(false); setSelectedId(ticket.id); await refreshTickets(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('supportCreateError')); }
    finally { setLoading(false); }
  };
  const sendReply = async () => {
    if (!user || !selectedId || !draft.trim()) return;
    setLoading(true);
    try { await createSupportMessage(selectedId, { message: draft.trim() }); setDraft(''); await refreshMessages(); await refreshTickets(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('supportMessageError')); }
    finally { setLoading(false); }
  };
  if (!user) return null;

  const selectTicket = async (ticketId: number) => { setSelectedId(ticketId); setDraft(''); await markSupportTicketRead(ticketId); await refreshTickets(); };
  const removeTicket = async () => { if (!selectedId || !window.confirm('Xóa yêu cầu này và toàn bộ tin nhắn?')) return; await deleteSupportTicket(selectedId); setSelectedId(null); setMessages([]); await refreshTickets(); };
  const requestList = <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-hmiSection p-2">{tickets.length === 0 ? <span className="px-1 text-[10px] text-slate-500">{t('noRequests')}</span> : tickets.map((ticket) => <button key={ticket.id} type="button" className={`min-w-[130px] border px-2 py-1 text-left text-[9px] ${selectedId === ticket.id ? 'border-industrialDark bg-industrialDark text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => void selectTicket(ticket.id)}>{ticket.subject}<span className="mt-0.5 block opacity-70">{ticket.machineId} · {ticket.status}{ticket.unreadCount > 0 ? ` · ${ticket.unreadCount}` : ''}</span></button>)}</div>;
  const isOwnMessage = (sender: string) => sender.trim().toLowerCase() === user.username.trim().toLowerCase();
  const messageArea = selected ? <><div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-2 py-1 text-[9px] font-bold uppercase text-industrialDark"><span>{selected.subject}</span>{canManage && <button type="button" className="text-alarm" onClick={() => void removeTicket()}>×</button>}</div><div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-hmiConsole p-2">{messages.map((item) => <div key={item.id} className={`max-w-[88%] border border-line px-2 py-1.5 text-[10px] ${isOwnMessage(item.sender) ? 'ml-auto bg-industrial text-white' : 'bg-white'}`}><div className="mb-1 text-[8px] font-bold uppercase opacity-70">{item.sender} · {formatTime(item.sentAt)}</div>{item.message}</div>)}</div><div className="flex shrink-0 gap-1 border-t border-line bg-hmiSection p-2"><textarea className="min-h-9 flex-1 resize-none border border-line bg-white px-2 py-1 text-[10px]" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('messagePlaceholder')} /><HMIButton size="compact" variant="primary" onClick={() => void sendReply()} disabled={loading || !draft.trim()}>{t('send')}</HMIButton></div></> : <div className="flex flex-1 items-center justify-center p-4 text-center text-[10px] text-slate-500">{t('chooseRequest')}</div>;
  const body = newTicket ? <div className="flex min-h-0 flex-1 flex-col gap-2 bg-hmiConsole p-3"><label className="grid gap-1 text-[9px] font-bold uppercase text-slate-600">{t('subject')}<input className="min-h-8 border-2 border-line bg-white px-2 text-xs" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t('subjectPlaceholder')} /></label><textarea className="min-h-0 flex-1 resize-none border-2 border-line bg-white p-2 text-xs" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('requestPlaceholder')} /><div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => setNewTicket(false)}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void submitNewTicket()} disabled={loading || !subject.trim() || !draft.trim()}>{t('send')}</HMIButton></div></div> : <>{requestList}{messageArea}<button type="button" className="shrink-0 border-t border-line bg-white px-3 py-2 text-left text-[10px] font-bold uppercase text-industrialDark" onClick={() => { setNewTicket(true); setSelectedId(null); }}>+ {t('createRequest')}</button></>;

  if (hidden) return <button type="button" aria-label={t('support')} title={t('support')} className="fixed bottom-3 right-0 z-50 rounded-l border-2 border-r-0 border-industrialDark bg-industrial px-1.5 py-3 text-[9px] font-bold uppercase text-white shadow sm:bottom-4" onClick={() => { setHidden(false); window.localStorage.removeItem(SUPPORT_WIDGET_HIDDEN_KEY); }}>?</button>;
  return <div className="fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4"><div className="relative inline-flex"><button type="button" aria-expanded={open} aria-label={t('support')} className="relative flex min-h-10 items-center gap-1.5 border-2 border-industrialDark bg-industrial px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg max-[640px]:min-h-9 max-[640px]:px-2 max-[640px]:text-[9px]" onClick={() => setOpen((value) => !value)}><span>✉</span>{t('support')}{unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-alarm px-1 text-[10px] text-white">{unreadCount}</span>}</button><button type="button" aria-label={t('cancel')} title={t('cancel')} className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-industrialDark bg-white text-xs font-bold text-industrialDark shadow" onClick={() => { setHidden(true); setOpen(false); window.localStorage.setItem(SUPPORT_WIDGET_HIDDEN_KEY, 'true'); }}>×</button></div>{open && <section className="absolute bottom-12 right-0 flex h-[min(460px,calc(100vh-6rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col border-2 border-industrialDark bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><div><div className="text-xs font-bold uppercase">{t('supportOperations')}</div><div className="text-[9px] text-slate-300">{canManage ? t('requestList') : t('messageAdmin')}</div></div><button type="button" aria-label={t('cancel')} onClick={() => setOpen(false)}>×</button></header><div className="flex min-h-0 flex-1 flex-col">{body}{error && <div className="shrink-0 border-t border-alarm px-2 py-1 text-[9px] text-alarm">{error}</div>}</div></section>}</div>;
}
