import { ApiRequestError, requestJson } from '../../shared/api/http';

const ticketsPath = '/api/support/tickets';

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

export type OperationalNotice = MachineNotice & {
  id: number;
  ticketId: number;
  sender: string;
  senderRole: string;
};

type TicketApi = {
  id: number;
  machine_id: string;
  created_by: string;
  created_by_name: string;
  creator_role: string;
  recipient_role: string;
  recipient_group?: string | null;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_sender_name: string;
  last_message: string;
  unread_count?: number;
};
type MessageApi = {
  id: number;
  ticket_id: number;
  sender: string;
  sender_name: string;
  sender_role: string;
  message: string;
  sent_at: string;
};
type MachineNoticeApi = {
  recipient_group: string;
  subject: string;
  message: string;
  sender_name: string;
  sent_at: string;
  priority: string;
};
type OperationalNoticeApi = MachineNoticeApi & {
  id: number;
  ticket_id: number;
  sender: string;
  sender_role: string;
};

const fromTicket = (item: TicketApi): SupportTicket => ({
  id: item.id,
  machineId: item.machine_id,
  createdBy: item.created_by,
  createdByName: item.created_by_name,
  creatorRole: item.creator_role,
  recipientRole: item.recipient_role,
  recipientGroup: item.recipient_group ?? null,
  subject: item.subject,
  priority: item.priority,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  lastMessageSenderName: item.last_message_sender_name,
  lastMessage: item.last_message,
  unreadCount: item.unread_count ?? 0,
});
const fromMessage = (item: MessageApi): SupportMessage => ({
  id: item.id,
  ticketId: item.ticket_id,
  sender: item.sender,
  senderName: item.sender_name,
  senderRole: item.sender_role,
  message: item.message,
  sentAt: item.sent_at,
});

/** Convert a generic API session error into the UI's explicit support-session state. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    return await requestJson<T>(url, init, 'Support API');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw new Error('SUPPORT_SESSION_EXPIRED');
    }
    throw error;
  }
}

/** List support conversations visible to the current user role. */
export async function getSupportTickets(viewer: string, role: string): Promise<SupportTicket[]> {
  const items = await request<TicketApi[]>(
    `${ticketsPath}?viewer=${encodeURIComponent(viewer)}&role=${encodeURIComponent(role)}`,
  );
  return items.map(fromTicket);
}

/** List notices sent to all operators of the current browser session. */
export async function getMachineNotices(): Promise<MachineNotice[]> {
  const items = await request<MachineNoticeApi[]>('/api/support/machine-notices');
  return items.map((item) => ({
    recipientGroup: item.recipient_group,
    subject: item.subject,
    message: item.message,
    senderName: item.sender_name,
    sentAt: item.sent_at,
    priority: item.priority,
  }));
}

/** List operational notices that belong in the machine workspace. */
export async function getOperationalNotices(): Promise<OperationalNotice[]> {
  const items = await request<OperationalNoticeApi[]>('/api/support/operational-notices');
  return items.map((item) => ({
    id: item.id,
    ticketId: item.ticket_id,
    recipientGroup: item.recipient_group,
    sender: item.sender,
    senderRole: item.sender_role,
    subject: item.subject,
    message: item.message,
    senderName: item.sender_name,
    sentAt: item.sent_at,
    priority: item.priority,
  }));
}

/** Create a conversation from a production machine or supervisor workspace. */
export async function createSupportTicket(payload: {
  machineId: string;
  recipientRole: string;
  recipientGroup?: string;
  subject: string;
  priority: string;
  message: string;
}): Promise<SupportTicket> {
  const item = await request<TicketApi>(ticketsPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machine_id: payload.machineId,
      recipient_role: payload.recipientRole,
      recipient_group: payload.recipientGroup,
      subject: payload.subject,
      priority: payload.priority,
      message: payload.message,
    }),
  });
  return fromTicket(item);
}

/** Load messages for one support conversation. */
export async function getSupportMessages(ticketId: number): Promise<SupportMessage[]> {
  const items = await request<MessageApi[]>(`${ticketsPath}/${ticketId}/messages`);
  return items.map(fromMessage);
}

/** Append an operator or supervisor message to an existing conversation. */
export async function createSupportMessage(
  ticketId: number,
  payload: { message: string },
): Promise<SupportMessage> {
  const item = await request<MessageApi>(`${ticketsPath}/${ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: payload.message }),
  });
  return fromMessage(item);
}

/** Permanently remove one support message. */
export async function deleteSupportMessage(ticketId: number, messageId: number): Promise<void> {
  await request<void>(`${ticketsPath}/${ticketId}/messages/${messageId}`, { method: 'DELETE' });
}

/** Update a support ticket workflow state. */
export async function updateSupportStatus(
  ticketId: number,
  status: string,
): Promise<SupportTicket> {
  const item = await request<TicketApi>(`${ticketsPath}/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return fromTicket(item);
}

/** Mark a support conversation as read for the active session. */
export async function markSupportTicketRead(ticketId: number): Promise<void> {
  await request<void>(`${ticketsPath}/${ticketId}/read`, { method: 'POST' });
}

/** Permanently remove a support ticket and its messages. */
export async function deleteSupportTicket(ticketId: number): Promise<void> {
  await request<void>(`${ticketsPath}/${ticketId}`, { method: 'DELETE' });
}
