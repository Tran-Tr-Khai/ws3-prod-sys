const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const ticketsPath = `${apiBaseUrl}/api/support/tickets`;

export type SupportTicket = {
  id: number;
  machineId: string;
  createdBy: string;
  createdByName: string;
  creatorRole: string;
  recipientRole: string;
  recipientGroup: string | null;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageSenderName: string;
  lastMessage: string;
  unreadCount: number;
};

export type SupportMessage = {
  id: number;
  ticketId: number;
  sender: string;
  senderName: string;
  senderRole: string;
  message: string;
  sentAt: string;
};

export type MachineNotice = {
  recipientGroup: string;
  subject: string;
  message: string;
  senderName: string;
  sentAt: string;
  priority: string;
};

type TicketApi = { id: number; machine_id: string; created_by: string; created_by_name: string; creator_role: string; recipient_role: string; recipient_group?: string | null; subject: string; priority: string; status: string; created_at: string; updated_at: string; last_message_sender_name: string; last_message: string; unread_count?: number };
type MessageApi = { id: number; ticket_id: number; sender: string; sender_name: string; sender_role: string; message: string; sent_at: string };
type MachineNoticeApi = { recipient_group: string; subject: string; message: string; sender_name: string; sent_at: string; priority: string };

const fromTicket = (item: TicketApi): SupportTicket => ({ id: item.id, machineId: item.machine_id, createdBy: item.created_by, createdByName: item.created_by_name, creatorRole: item.creator_role, recipientRole: item.recipient_role, recipientGroup: item.recipient_group ?? null, subject: item.subject, priority: item.priority, status: item.status, createdAt: item.created_at, updatedAt: item.updated_at, lastMessageSenderName: item.last_message_sender_name, lastMessage: item.last_message, unreadCount: item.unread_count ?? 0 });
const fromMessage = (item: MessageApi): SupportMessage => ({ id: item.id, ticketId: item.ticket_id, sender: item.sender, senderName: item.sender_name, senderRole: item.sender_role, message: item.message, sentAt: item.sent_at });

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (response.status === 401) {
    throw new Error('SUPPORT_SESSION_EXPIRED');
  }
  if (!response.ok) throw new Error(`Support API returned HTTP ${response.status}`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export async function getSupportTickets(viewer: string, role: string): Promise<SupportTicket[]> {
  const items = await request<TicketApi[]>(`${ticketsPath}?viewer=${encodeURIComponent(viewer)}&role=${encodeURIComponent(role)}`);
  return items.map(fromTicket);
}

export async function getMachineNotices(): Promise<MachineNotice[]> {
  const items = await request<MachineNoticeApi[]>(`${apiBaseUrl}/api/support/machine-notices`);
  return items.map((item) => ({ recipientGroup: item.recipient_group, subject: item.subject, message: item.message, senderName: item.sender_name, sentAt: item.sent_at, priority: item.priority }));
}

export async function createSupportTicket(payload: { machineId: string; recipientRole: string; recipientGroup?: string; subject: string; priority: string; message: string }): Promise<SupportTicket> {
  const item = await request<TicketApi>(ticketsPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machine_id: payload.machineId, recipient_role: payload.recipientRole, recipient_group: payload.recipientGroup, subject: payload.subject, priority: payload.priority, message: payload.message }) });
  return fromTicket(item);
}

export async function getSupportMessages(ticketId: number): Promise<SupportMessage[]> {
  const items = await request<MessageApi[]>(`${ticketsPath}/${ticketId}/messages`);
  return items.map(fromMessage);
}

export async function createSupportMessage(ticketId: number, payload: { message: string }): Promise<SupportMessage> {
  const item = await request<MessageApi>(`${ticketsPath}/${ticketId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: payload.message }) });
  return fromMessage(item);
}

export async function updateSupportStatus(ticketId: number, status: string): Promise<SupportTicket> {
  const item = await request<TicketApi>(`${ticketsPath}/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  return fromTicket(item);
}

export async function markSupportTicketRead(ticketId: number): Promise<void> {
  await request<void>(`${ticketsPath}/${ticketId}/read`, { method: 'POST' });
}

export async function deleteSupportTicket(ticketId: number): Promise<void> {
  await request<void>(`${ticketsPath}/${ticketId}`, { method: 'DELETE' });
}
