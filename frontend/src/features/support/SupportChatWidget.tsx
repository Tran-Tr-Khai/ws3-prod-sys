import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { createSupportMessage, createSupportTicket, deleteSupportMessage, deleteSupportTicket, getOperationalNotices, getSupportMessages, getSupportTickets, markSupportTicketRead, type OperationalNotice, type SupportMessage, type SupportTicket } from './supportApi';

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

export function SupportChatWidget({ embedded = false }: { embedded?: boolean }) {
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
  const [operationalNotices, setOperationalNotices] = useState<OperationalNotice[]>([]);
  const [operationalReply, setOperationalReply] = useState('');
  const [sendingOperationalReply, setSendingOperationalReply] = useState(false);
  const [operationalReplySent, setOperationalReplySent] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [seenOperationalMessageIds, setSeenOperationalMessageIds] = useState<Set<number>>(() => new Set());
  const newestSeenMessage = useRef<Record<number, number>>({});
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const isMachineOperator = user?.role === 'OPERATOR' && user.machineIds.length > 0;
  const operatorMachineGroups = new Set((user?.machineIds ?? []).map(machineGroupForId));
  const operationalSeenStorageKey = user ? `ws3.operational-notices-seen:${user.username.toLowerCase()}` : null;
  const operationalReplyTicketId = [...operationalNotices].reverse().find((notice) => operatorMachineGroups.has(notice.recipientGroup))?.ticketId ?? null;
  const noticeListRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets]);
  const unreadCount = tickets.reduce((total, ticket) => total + ticket.unreadCount, 0);

  const refreshOperationalNotices = useCallback(async () => {
    try { setOperationalNotices(await getOperationalNotices()); }
    catch (reason) { if (reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED') setError(t('supportSessionExpired')); }
  }, [t]);

  useEffect(() => {
    if (!operationalSeenStorageKey) return;
    try {
      const savedIds: unknown = JSON.parse(window.localStorage.getItem(operationalSeenStorageKey) ?? '[]');
      setSeenOperationalMessageIds(new Set(Array.isArray(savedIds) ? savedIds.filter((id): id is number => Number.isInteger(id)) : []));
    } catch {
      setSeenOperationalMessageIds(new Set());
    }
  }, [operationalSeenStorageKey]);

  const markOperationalNoticeSeen = (messageId: number) => {
    setSeenOperationalMessageIds((current) => {
      const next = new Set(current);
      next.add(messageId);
      while (next.size > 1000) next.delete(next.values().next().value as number);
      if (operationalSeenStorageKey) window.localStorage.setItem(operationalSeenStorageKey, JSON.stringify([...next]));
      return next;
    });
  };

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
    if (!isMachineOperator) return;
    setOpen(true);
    void refreshOperationalNotices();
    const timer = window.setInterval(() => { void refreshOperationalNotices(); }, 10000);
    return () => window.clearInterval(timer);
  }, [isMachineOperator, refreshOperationalNotices]);
  useEffect(() => {
    if (isMachineOperator && open && noticeListRef.current) noticeListRef.current.scrollTo({ top: noticeListRef.current.scrollHeight, behavior: 'smooth' });
  }, [isMachineOperator, operationalNotices, open]);
  useEffect(() => {
    if (!user || (isMachineOperator && user.role === 'OPERATOR')) return;
    void refreshTickets();
    const timer = window.setInterval(() => { void refreshTickets(); }, 5000);
    return () => window.clearInterval(timer);
  }, [isMachineOperator, refreshTickets, user]);
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
    if (!open || isMachineOperator || !ticketsLoaded || selectedId !== null || newTicket) return;
    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      setSelectedId(firstTicket.id);
      void markSupportTicketRead(firstTicket.id).then(refreshTickets);
    } else {
      setSubject(canManage ? 'ALL|WS3' : recipientOptions[0]?.value ?? '');
      setNewTicket(true);
    }
  }, [canManage, isMachineOperator, newTicket, open, recipientOptions, refreshTickets, selectedId, tickets, ticketsLoaded]);

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
  const sendOperationalReply = async () => {
    if (!operationalReplyTicketId || !operationalReply.trim() || sendingOperationalReply) return;
    setSendingOperationalReply(true);
    setOperationalReplySent(false);
    setError('');
    try {
      await createSupportMessage(operationalReplyTicketId, { message: operationalReply.trim() });
      setOperationalReply('');
      setOperationalReplySent(true);
      await refreshOperationalNotices();
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED' ? t('supportSessionExpired') : reason instanceof Error ? reason.message : t('supportMessageError'));
    } finally {
      setSendingOperationalReply(false);
    }
  };
  const removeOwnMessage = async (ticketId: number, messageId: number) => {
    if (deletingMessageId !== null) return;
    setDeletingMessageId(messageId);
    setError('');
    try {
      await deleteSupportMessage(ticketId, messageId);
      await Promise.all([refreshOperationalNotices(), refreshTickets()]);
      if (selectedId === ticketId) await refreshMessages();
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'SUPPORT_SESSION_EXPIRED' ? t('supportSessionExpired') : reason instanceof Error ? reason.message : t('supportMessageError'));
    } finally {
      setDeletingMessageId(null);
    }
  };
  if (!user) return null;

  const selectTicket = async (ticketId: number) => { setSelectedId(ticketId); setNewTicket(false); setDraft(''); await markSupportTicketRead(ticketId); await refreshTickets(); };
  const removeTicket = async () => { if (!selectedId || !window.confirm('Xóa yêu cầu này và toàn bộ tin nhắn?')) return; await deleteSupportTicket(selectedId); setSelectedId(null); setMessages([]); await refreshTickets(); };
  const conversationName = (ticket: SupportTicket) => {
    const group = ticket.recipientGroup ?? machineGroupForId(ticket.machineId);
    return machineGroups[group]?.[language] ?? (ticket.createdBy.toLowerCase() === user.username.toLowerCase() ? ticket.subject : ticket.createdByName);
  };
  if (isMachineOperator) {
    const machineNotices = operationalNotices.filter((notice) => operatorMachineGroups.has(notice.recipientGroup));
    const machineNamesForNotice = [...operatorMachineGroups].map((group) => machineGroups[group]?.[language] ?? group).join(' · ');
    return <section aria-label={language === 'vi' ? 'Thông báo vận hành' : 'Operational notices'} className={`${embedded ? 'operational-notice-dock relative flex h-[min(420px,60vh)] min-h-[280px] w-full min-w-0 flex-col' : 'fixed bottom-3 right-3 z-50 flex h-[min(460px,calc(100vh-1.5rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col sm:bottom-4 sm:right-4'} border-2 border-industrialDark bg-white shadow-2xl`}>
        <header className="flex h-12 min-h-12 shrink-0 items-center bg-industrialDark px-3 text-white"><div><h2 className="text-xs font-bold uppercase">{language === 'vi' ? 'Thông báo vận hành' : 'Operational notices'}</h2><p className="text-[9px] text-slate-300">{machineNamesForNotice} · {language === 'vi' ? 'Thông báo từ Admin' : 'Admin announcements'}</p></div></header>
        <div ref={noticeListRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-white p-2">
          {machineNotices.length === 0 && <p className="py-4 text-center text-[10px] text-slate-500">{language === 'vi' ? 'Chưa có thông báo vận hành.' : 'No operational notices yet.'}</p>}
          {machineNotices.map((notice) => { const ownMessage = notice.sender.toLowerCase() === user.username.toLowerCase(); const fromManager = ['ADMIN', 'SUPERVISOR'].includes(notice.senderRole.toUpperCase()); const highlighted = fromManager && !seenOperationalMessageIds.has(notice.id); return <article key={`${notice.id}-${notice.ticketId}`} className={`max-w-[92%] border px-2 py-2 ${ownMessage ? 'ml-auto bg-industrial text-white' : 'bg-white'} ${highlighted ? 'border-warning bg-hmiWarning ring-2 ring-warning/40' : 'border-line'}`}><div className="mb-1 flex items-center justify-between gap-2 text-[8px] font-bold uppercase opacity-80"><button type="button" onClick={() => markOperationalNoticeSeen(notice.id)} className="flex min-w-0 items-center gap-2 text-left"><span className="truncate">{notice.senderName} · {formatTime(notice.sentAt)}</span>{highlighted && <span className="shrink-0 bg-warning px-1 py-0.5 text-white">{language === 'vi' ? 'MỚI' : 'NEW'}</span>}</button>{ownMessage && <button type="button" title={language === 'vi' ? 'Gỡ tin nhắn của bạn' : 'Remove your message'} aria-label={language === 'vi' ? 'Gỡ tin nhắn của bạn' : 'Remove your message'} disabled={deletingMessageId === notice.id} onClick={() => void removeOwnMessage(notice.ticketId, notice.id)} className="px-1 text-sm leading-none opacity-90 hover:opacity-100 disabled:opacity-40">×</button>}</div><button type="button" onClick={() => markOperationalNoticeSeen(notice.id)} className="block w-full text-left"><span className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">{notice.message}</span></button></article>; })}
        </div>
        <form className="shrink-0 border-t border-line bg-hmiSection p-2" onSubmit={(event) => { event.preventDefault(); void sendOperationalReply(); }}><label htmlFor="operational-reply" className="sr-only">{language === 'vi' ? 'Soạn báo cáo vận hành' : 'Compose operational report'}</label><div className="flex items-end gap-1"><textarea id="operational-reply" rows={2} className="min-h-10 min-w-0 flex-1 resize-y border border-line bg-white px-2 py-1.5 text-[10px]" value={operationalReply} onChange={(event) => { setOperationalReply(event.target.value); setOperationalReplySent(false); }} placeholder={language === 'vi' ? 'Nhập tin nhắn hoặc báo cáo...' : 'Write a message or report...'} /><button type="submit" disabled={!operationalReplyTicketId || sendingOperationalReply || !operationalReply.trim()} className="min-h-10 border-2 border-industrialDark bg-industrial px-3 text-[9px] font-bold uppercase text-white disabled:opacity-50">{sendingOperationalReply ? '…' : language === 'vi' ? 'Gửi' : 'Send'}</button></div>{operationalReplySent && <p role="status" className="mt-1 text-[9px] font-bold text-success">{language === 'vi' ? 'Đã gửi báo cáo.' : 'Report sent.'}</p>}</form>
        {error && <p role="status" className="border-t border-alarm px-2 py-1 text-[9px] text-alarm">{error}</p>}
      </section>;
  }
  const requestList = <div className="shrink-0 border-b border-line bg-hmiSection"><div className="flex items-center justify-between px-2 pt-1.5 text-[9px] font-bold uppercase text-industrialDark"><span>{t('requestList')}</span><button type="button" className="text-industrial underline" onClick={() => { setSelectedId(null); setDraft(''); setSubject(recipientOptions[0]?.value ?? ''); setNewTicket(true); }}>{t('createRequest')}</button></div><div className="flex gap-1 overflow-x-auto p-2">{tickets.length === 0 ? <span className="px-1 text-[10px] text-slate-500">{t('noRequests')}</span> : tickets.map((ticket) => <button key={ticket.id} type="button" title={`${ticket.lastMessageSenderName}: ${ticket.lastMessage}`} className={`relative min-w-[130px] border px-2 py-2 pr-7 text-left text-[9px] ${selectedId === ticket.id ? 'border-industrialDark bg-industrialDark text-white' : 'border-line bg-white text-industrialDark'}`} onClick={() => void selectTicket(ticket.id)}><span className="block truncate font-bold">{conversationName(ticket)}</span>{ticket.unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alarm px-1 text-[9px] font-bold text-white">{ticket.unreadCount}</span>}</button>)}</div></div>;
  const isOwnMessage = (sender: string) => sender.trim().toLowerCase() === user.username.trim().toLowerCase();
  const messageArea = selected ? <><div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-2 py-1 text-[9px] font-bold uppercase text-industrialDark"><span>{conversationName(selected)}</span>{user.role === 'ADMIN' && <button type="button" className="text-alarm" onClick={() => void removeTicket()}>×</button>}</div><div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-hmiConsole p-2">{messages.map((item) => { const ownMessage = isOwnMessage(item.sender); return <div key={item.id} className={`max-w-[88%] border border-line px-2 py-1.5 text-[10px] ${ownMessage ? 'ml-auto bg-industrial text-white' : 'bg-white'}`}><div className="mb-1 flex items-center justify-between gap-2 text-[8px] font-bold uppercase opacity-70"><span>{item.senderName} · {formatTime(item.sentAt)}</span>{ownMessage && <button type="button" title={language === 'vi' ? 'Gỡ tin nhắn của bạn' : 'Remove your message'} aria-label={language === 'vi' ? 'Gỡ tin nhắn của bạn' : 'Remove your message'} disabled={deletingMessageId === item.id} onClick={() => void removeOwnMessage(item.ticketId, item.id)} className="px-1 text-sm leading-none opacity-90 hover:opacity-100 disabled:opacity-40">×</button>}</div><p className="whitespace-pre-wrap break-words">{item.message}</p></div>; })}</div><div className="flex shrink-0 gap-1 border-t border-line bg-hmiSection p-2"><textarea className="min-h-9 flex-1 resize-none border border-line bg-white px-2 py-1 text-[10px]" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('messagePlaceholder')} /><HMIButton size="compact" variant="primary" onClick={() => void sendReply()} disabled={loading || !draft.trim()}>{t('send')}</HMIButton></div></> : <div className="flex flex-1 items-center justify-center p-4 text-center text-[10px] text-slate-500">{t('chooseRequest')}</div>;
  const body = <>{requestList}{newTicket ? <div className="flex min-h-0 flex-1 flex-col gap-2 bg-hmiConsole p-3"><label className="grid gap-1 text-[9px] font-bold uppercase text-slate-600">{t('subject')}<select className="min-h-8 border-2 border-line bg-white px-2 text-xs" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">{t('subjectPlaceholder')}</option>{recipientOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><textarea className="min-h-0 flex-1 resize-none border-2 border-line bg-white p-2 text-xs" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('requestPlaceholder')} /><div className="flex justify-end gap-2"><HMIButton size="compact" onClick={() => setNewTicket(false)}>{t('cancel')}</HMIButton><HMIButton size="compact" variant="primary" onClick={() => void submitNewTicket()} disabled={loading || !subject.trim() || !draft.trim()}>{t('send')}</HMIButton></div></div> : messageArea}</>;

  if (hidden) return <button type="button" aria-label={t('support')} title={t('support')} className="fixed bottom-3 right-0 z-50 rounded-l border-2 border-r-0 border-industrialDark bg-industrial px-1.5 py-3 text-[9px] font-bold uppercase text-white shadow sm:bottom-4" onClick={() => { setHidden(false); window.localStorage.removeItem(SUPPORT_WIDGET_HIDDEN_KEY); }}>?</button>;
  return <div className="fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4"><div className="relative inline-flex"><button type="button" aria-expanded={open} aria-label={t('support')} className="relative flex min-h-10 items-center gap-1.5 border-2 border-industrialDark bg-industrial px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg max-[640px]:min-h-9 max-[640px]:px-2 max-[640px]:text-[9px]" onClick={() => { const nextOpen = !open; setOpen(nextOpen); if (nextOpen) { setSelectedId(null); setNewTicket(false); setDraft(''); } }}><span>✉</span>{t('support')}{unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-alarm px-1 text-[10px] text-white">{unreadCount}</span>}</button><button type="button" aria-label={t('cancel')} title={t('cancel')} className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-industrialDark bg-white text-xs font-bold text-industrialDark shadow" onClick={() => { setHidden(true); setOpen(false); window.localStorage.setItem(SUPPORT_WIDGET_HIDDEN_KEY, 'true'); }}>×</button></div>{open && <section className="absolute bottom-12 right-0 flex h-[min(460px,calc(100vh-6rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col border-2 border-industrialDark bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between bg-industrialDark px-3 py-2 text-white"><div><div className="text-xs font-bold uppercase">{t('supportOperations')}</div><div className="text-[9px] text-slate-300">{canManage ? t('requestList') : t('messageAdmin')}</div></div><button type="button" aria-label={t('cancel')} onClick={() => setOpen(false)}>×</button></header><div className="flex min-h-0 flex-1 flex-col">{body}{error && <div className="shrink-0 border-t border-alarm px-2 py-1 text-[9px] text-alarm">{error}</div>}</div></section>}</div>;
}
