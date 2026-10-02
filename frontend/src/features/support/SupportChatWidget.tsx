import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { createSupportMessage, createSupportTicket, deleteSupportTicket, getSupportMessages, getSupportTickets, markSupportTicketRead, type SupportMessage, type SupportTicket } from './supportApi';

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const SUPPORT_WIDGET_HIDDEN_KEY = 'ws3.support-widget-hidden';

const machineNames: Record<string, { vi: string; en: string }> = {
  'UN-01': { vi: 'Unrolling', en: 'Unrolling' }, 'BU-01': { vi: 'Buffing', en: 'Buffing' },
  'SC-01': { vi: 'Scouring', en: 'Scouring' }, 'DY-01': { vi: 'Dyeing', en: 'Dyeing' },
  'WA-01': { vi: 'Washing', en: 'Washing' }, 'SK-01': { vi: 'Skachar', en: 'Skachar' },
  'TE-01': { vi: 'Tentering', en: 'Tentering' }, 'CA-01': { vi: 'Calendaring', en: 'Calendaring' },
  'RA-01': { vi: 'Raising', en: 'Raising' }, 'SU-01': { vi: 'Sueding', en: 'Sueding' },
};

const machineGroups: Record<string, { vi: string; en: string }> = {
  UNROLLING: { vi: 'UNROLLING', en: 'UNROLLING' }, BUFFING: { vi: 'BUFFING', en: 'BUFFING' },
  SCOURING: { vi: 'SCOURING', en: 'SCOURING' }, DYEING: { vi: 'DYEING', en: 'DYEING' },
  WASHING: { vi: 'WASHING', en: 'WASHING' }, SKACHAR: { vi: 'SKACHAR', en: 'SKACHAR' },
  TENTERING: { vi: 'TENTERING', en: 'TENTERING' }, CALENDARING: { vi: 'CALENDARING', en: 'CALENDARING' },
  RAISING: { vi: 'RAISING', en: 'RAISING' }, SUEDING: { vi: 'SUEDING', en: 'SUEDING' },
};

const machineGroupForId = (machineId: string) => {
  const prefix = machineId.trim().toUpperCase().split('-', 1)[0];
  return Object.keys(machineGroups).find((group) => group.startsWith(prefix)) ?? machineId;
};

export function SupportChatWidget() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(SUPPORT_WIDGET_HIDDEN_KEY) === 'true');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [newTicket, setNewTicket] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const newestSeenMessage = useRef<Record<number, number>>({});
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets]);
  const unreadCount = tickets.reduce((total, ticket) => total + ticket.unreadCount, 0);

  const refreshTickets = useCallback(async () => {
    if (!user) return;
    try { setTickets(await getSupportTickets(user.username, user.role)); setTicketsLoaded(true); setError(''); }
    catch (reason) { setError(reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED' ? t('supportSessionExpired') : reason instanceof Error ? reason.message : t('supportLoadError')); }
  }, [t, user]);
  const refreshMessages = useCallback(async () => {
    if (!selectedId) { setMessages([]); return; }
    try {
      const latestMessages = await getSupportMessages(selectedId);
      setMessages(latestMessages);
      const latest = latestMessages[latestMessages.length - 1];
      const previousId = newestSeenMessage.current[selectedId] ?? 0;
      newestSeenMessage.current[selectedId] = Math.max(previousId, latest?.id ?? 0);
      if (latest && latest.id > previousId && latest.sender.toLowerCase() !== user?.username.toLowerCase()) {
        await markSupportTicketRead(selectedId);
        await refreshTickets();
      }
    } catch (reason) { setMessages([]); if (reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED') setError(t('supportSessionExpired')); }
  }, [refreshTickets, selectedId, t, user?.username]);
  useEffect(() => {
    if (!user) return;
    void refreshTickets();
    const timer = window.setInterval(() => { void refreshTickets(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshTickets, user]);
  useEffect(() => {
    if (!open) return;
    void refreshMessages();
    const timer = window.setInterval(() => { void refreshMessages(); }, 3000);
    return () => window.clearInterval(timer);
  }, [open, refreshMessages]);
  const recipientOptions = useMemo(() => {
    const machines = [...new Set(user?.machineIds ?? [])].map((machineId) => ({
      value: `SUPERVISOR|${machineId}`,
      label: `Supervisor · ${machineNames[machineId]?.[language] ?? machineId}`,
    }));
    if (!canManage) return machines;
    return [
      { value: 'ADMIN|WS3', label: 'Admin' },
      { value: 'SUPERVISOR|WS3', label: 'Supervisor' },
      { value: 'ALL|WS3', label: language === 'vi' ? 'Tất cả' : 'All' },
      ...Object.keys(machineGroups).map((group) => ({
        value: `MACHINE|${group}`,
        label: machineGroups[group][language],
      })),
    ];
  }, [canManage, language, user?.machineIds]);
  useEffect(() => {
    if (!open || !ticketsLoaded || selectedId !== null || newTicket) return;
    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      setSelectedId(firstTicket.id);
      void markSupportTicketRead(firstTicket.id).then(refreshTickets);
    } else {
      setSubject(canManage ? 'ALL|WS3' : recipientOptions[0]?.value ?? '');
      setNewTicket(true);
    }
  }, [canManage, newTicket, open, recipientOptions, refreshTickets, selectedId, tickets, ticketsLoaded]);

  const submitNewTicket = async () => {
    if (!user || !subject.trim() || !draft.trim()) return;
    setLoading(true);
    try { const [recipientRole, recipientTarget] = subject.split('|'); const recipientGroup = recipientRole === 'MACHINE' ? recipientTarget : undefined; const ticket = await createSupportTicket({ machineId: recipientGroup ?? recipientTarget, recipientRole, recipientGroup, subject: recipientOptions.find((option) => option.value === subject)?.label ?? subject, priority: 'NORMAL', message: draft.trim() }); setSubject(''); setDraft(''); setNewTicket(false); setSelectedId(ticket.id); await refreshTickets(); }
    catch (reason) { setError(reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED' ? t('supportSessionExpired') : reason instanceof Error ? reason.message : t('supportCreateError')); }
    finally { setLoading(false); }
  };
  const sendReply = async () => {
    if (!user || !selectedId || !draft.trim()) return;
    setLoading(true);
    try { await createSupportMessage(selectedId, { message: draft.trim() }); setDraft(''); await refreshMessages(); await refreshTickets(); }
    catch (reason) { setError(reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED' ? t('supportSessionExpired') : reason instanceof Error ? reason.message : t('supportMessageError')); }
    finally { setLoading(false); }
  };
  if (!user) return null;

  const selectTicket = async (ticketId: number) => { setSelectedId(ticketId); setNewTicket(false); setDraft(''); await markSupportTicketRead(ticketId); await refreshTickets(); };
  const removeTicket = async () => { if (!selectedId || !window.confirm('Xóa yêu cầu này và toàn bộ tin nhắn?')) return; await deleteSupportTicket(selectedId); setSelectedId(null); setMessages([]); await refreshTickets(); };
  const conversationName = (ticket: SupportTicket) => {
    const group = ticket.recipientGroup ?? machineGroupForId(ticket.machineId);
    return machineGroups[group]?.[language] ?? (ticket.createdBy.toLowerCase() === user.username.toLowerCase() ? ticket.subject : ticket.createdByName);
  };
  const requestList = <div className="shrink-0 border-b border-line bg-hmiSection"><div className="flex items-center justify-between px-2 pt-1.5 text-[9px] font-bold uppercase text-industrialDark"><span>{t('requestList')}</span><button type="button" className="text-industrial underline" onClick={() => { setSelectedId(null); setDraft(''); setSubject(recipientOptions[0]?.value ?? ''); setNewTicket(true); }}>{t('createRequest')}</button></div><div className="flex gap-1 overflow-x-auto p-2">{tickets.length === 0 ? <span className="px-1 text-[10px] text-slate-500">{t('noRequests')}</span> : tickets.map((ticket) => <button key={ticket.id} type="button" title={`${ticket.lastMessageSenderName}: ${ticket.lastMessage}`} className={`relative min-w-[130px] border px-2 py-2 pr-7 text-left text-[9px] ${selectedId === ticket.id ? 'border-industrialDark bg-industrialDark text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => void selectTicket(ticket.id)}><span className="block truncate font-bold">{conversationName(ticket)}</span>{ticket.unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alarm px-1 text-[9px] font-bold text-white">{ticket.unreadCount}</span>}</button>)}</div></div>;
  const isOwnMessage = (sender: string) => sender.trim().toLowerCase() === user.username.trim().toLowerCase();
  const messageArea = selected ? <><div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-2 py-1 text-[9px] font-bold uppercase text-industrialDark"><span>{conversationName(selected)}</span>{canManage && <button type="button" className="text-alarm" onClick={() => void removeTicket()}>×</button>}</div><div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-hmiConsole p-2">{messages.map((item) => <div key={item.id} className={`max-w-[88%] whitespace-pre-wrap break-words border border-line px-2 py-1.5 text-[10px] ${isOwnMessage(item.sender) ? 'ml-auto bg-industrial text-white' : 'bg-white'}`}><div className="mb-1 text-[8px] font-bold uppercase opacity-70">{item.senderName} · {formatTime(item.sentAt)}</div>{item.message}</div>)}</div><div className="flex shrink-0 gap-1 border-t border-line bg-hmiSection p-2"><textarea className="min-h-9 flex-1 resize-none border border-line bg-white px-2 py-1 text-[10px]" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('messagePlaceholder')} /><HMIButton size="compact" variant="primary" onClick={() => void sendReply()} disabled={loading || !draft.trim()}>{t('send')}</HMIButton></div></> : <div className="flex flex-1 items-center justify-center p-4 text-center text-[10px] text-slate-500">{t('chooseRequest')}</div>;
  const body = <>{requestList}{newTicket ? <div className="flex min-h-0 flex-1 flex-col gap-2 bg-hmiConsole p-3"><label className="grid gap-1 text-[9px] font-bold uppercase text-slate-600">{t('subject')}<select className="min-h-8 border-2 border-line bg-white px-2 text-xs" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">{t('subjectPlaceholder')}</option>{recipientOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><textarea className="min-h-0 flex-1 resize-none border-2 border-line bg-white p-2 text-xs" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('requestPlaceholder')} /><div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => setNewTicket(false)}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void submitNewTicket()} disabled={loading || !subject.trim() || !draft.trim()}>{t('send')}</HMIButton></div></div> : messageArea}</>;

  if (hidden) return <button type="button" aria-label={t('support')} title={t('support')} className="fixed bottom-3 right-0 z-50 rounded-l border-2 border-r-0 border-industrialDark bg-industrial px-1.5 py-3 text-[9px] font-bold uppercase text-white shadow sm:bottom-4" onClick={() => { setHidden(false); window.localStorage.removeItem(SUPPORT_WIDGET_HIDDEN_KEY); }}>?</button>;
  return <div className="fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4"><div className="relative inline-flex"><button type="button" aria-expanded={open} aria-label={t('support')} className="relative flex min-h-10 items-center gap-1.5 border-2 border-industrialDark bg-industrial px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg max-[640px]:min-h-9 max-[640px]:px-2 max-[640px]:text-[9px]" onClick={() => { const nextOpen = !open; setOpen(nextOpen); if (nextOpen) { setSelectedId(null); setNewTicket(false); setDraft(''); } }}><span>✉</span>{t('support')}{unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-alarm px-1 text-[10px] text-white">{unreadCount}</span>}</button><button type="button" aria-label={t('cancel')} title={t('cancel')} className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-industrialDark bg-white text-xs font-bold text-industrialDark shadow" onClick={() => { setHidden(true); setOpen(false); window.localStorage.setItem(SUPPORT_WIDGET_HIDDEN_KEY, 'true'); }}>×</button></div>{open && <section className="absolute bottom-12 right-0 flex h-[min(460px,calc(100vh-6rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col border-2 border-industrialDark bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><div><div className="text-xs font-bold uppercase">{t('supportOperations')}</div><div className="text-[9px] text-slate-300">{canManage ? t('requestList') : t('messageAdmin')}</div></div><button type="button" aria-label={t('cancel')} onClick={() => setOpen(false)}>×</button></header><div className="flex min-h-0 flex-1 flex-col">{body}{error && <div className="shrink-0 border-t border-alarm px-2 py-1 text-[9px] text-alarm">{error}</div>}</div></section>}</div>;
}
