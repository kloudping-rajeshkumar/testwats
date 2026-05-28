import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare, Loader2, ArrowDown, ArrowUp, Check, CheckCheck, Clock, XCircle, Users, Pencil, UserPlus, Save } from 'lucide-react';
import { messageApi, contactApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useMessagesQuery, useContactMapQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import type { Message, Contact } from '../services/api';
import './Conversations.css';

// ── Helpers ──────────────────────────────────────────────────────────

function toMs(ts: string | number | null | undefined): number {
  if (!ts) return 0;
  const n = typeof ts === 'string' ? Number(ts) : ts;
  if (isNaN(n)) {
    const parsed = new Date(ts as string).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return n > 1e12 ? n : n * 1000;
}

function formatTime(ts: string | number | null | undefined): string {
  const ms = toMs(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string | number | null | undefined): string {
  const ms = toMs(ts);
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a phone number extracted from a WhatsApp chatId.
 *
 * WhatsApp chatIds are always <country_code><local_number>@c.us
 *   - India:  91 + 10 digits = 12 digits  → +91 93423 18857
 *   - US/CA:   1 + 10 digits = 11 digits  → +1 93423 18857
 *   - UK:     44 + 10 digits = 12 digits  → +44 93423 18857
 *
 * When the number has only 10 digits the country code is missing
 * (old data or edge case), so we show without "+" prefix.
 */
function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 4) return digits;

  // 10 digits → local number (no country code)
  // Example: 9342318857 → 93423 18857
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // 11+ digits → international: last 10 = local, rest = country code
  // Example: 919342318857 → +91 93423 18857
  if (digits.length >= 11) {
    const cc = digits.slice(0, digits.length - 10);
    const local = digits.slice(-10);
    return `+${cc} ${local.slice(0, 5)} ${local.slice(5)}`;
  }

  // 7-9 digits → short number, just group nicely
  return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/**
 * Normalize chatId:
 *  1. Replace @s.whatsapp.net → @c.us
 *  2. If a 10-digit number has a matching 12-digit (with 91 prefix) in the
 *     same session, merge them. We do this by detecting the session country
 *     code from the selectedSession.phone and prepending it to short chatIds.
 */
function normalizeChatId(chatId: string, sessionPhone?: string): string {
  let id = chatId.replace('@s.whatsapp.net', '@c.us');

  // If the phone part is exactly 10 digits and we know the session country code,
  // prepend the country code to eliminate duplicates.
  if (sessionPhone && id.endsWith('@c.us')) {
    const phonePart = id.replace('@c.us', '');
    if (phonePart.length === 10 && /^\d{10}$/.test(phonePart)) {
      // Extract country code from session phone (e.g. "919791823103" → "91")
      const sessionDigits = sessionPhone.replace(/[^0-9]/g, '');
      if (sessionDigits.length >= 12) {
        const cc = sessionDigits.slice(0, sessionDigits.length - 10);
        id = `${cc}${phonePart}@c.us`;
      }
    }
  }

  return id;
}

function extractPhone(chatId: string): string {
  // Strip suffix only — don't normalize here (caller passes already-normalized id)
  return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function getContactDisplayName(chatId: string, contactMap: Record<string, Contact>): string {
  const contact = contactMap[chatId];
  if (contact?.name) return contact.name;
  if (contact?.pushName) return contact.pushName;
  if (chatId.endsWith('@g.us')) return chatId.replace('@g.us', '');
  return formatPhone(extractPhone(chatId));
}

function getInitials(chatId: string, contactMap: Record<string, Contact>): string {
  const contact = contactMap[chatId];
  if (contact?.name) {
    const parts = contact.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return contact.name.slice(0, 2).toUpperCase();
  }
  if (contact?.pushName) {
    const parts = contact.pushName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return contact.pushName.slice(0, 2).toUpperCase();
  }
  if (chatId.endsWith('@g.us')) return 'G';
  const digits = chatId.replace(/[^0-9]/g, '');
  return digits.slice(-2) || '?';
}

interface ChatSummary {
  chatId: string;
  lastMessage: string;
  lastTime: string | number;
  direction: string;
  unread: number;
  messageCount: number;
}

function statusIcon(status: string) {
  switch (status) {
    case 'pending': return <Clock size={12} />;
    case 'sent': return <Check size={12} />;
    case 'delivered': return <CheckCheck size={12} />;
    case 'read': return <CheckCheck size={12} style={{ color: '#34B7F1' }} />;
    case 'failed': return <XCircle size={12} style={{ color: '#DC2626' }} />;
    default: return null;
  }
}

// ── Main Component ───────────────────────────────────────────────────

export function Conversations() {
  const { t } = useTranslation();
  useDocumentTitle(t('conversations.title', 'Conversations'));
  const { canWrite } = useRole();

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const [sessionId, setSessionId] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editingContact, setEditingContact] = useState('');
  const [editName, setEditName] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first session
  useEffect(() => {
    if (allSessions.length > 0 && !sessionId) {
      setSessionId(allSessions[0].id);
    }
  }, [allSessions, sessionId]);

  // Fetch all messages for the session
  const { data: messagesData, isLoading: loadingMessages, refetch: refetchMessages } = useMessagesQuery(
    sessionId,
    undefined,
    500,
  );

  // Fetch contacts map for the session
  const { data: contactMap = {}, refetch: refetchContacts } = useContactMapQuery(sessionId);

  const selectedSession = allSessions.find(s => s.id === sessionId);
  const sessionPhone = selectedSession?.phone || '';

  // Helper: normalize chatId with session country code to merge duplicates
  const normalize = (chatId: string) => normalizeChatId(chatId, sessionPhone);

  const messages: Message[] = messagesData?.messages || [];

  // Build chat list from messages (normalize chatId to prevent duplicates)
  const chatMap = new Map<string, ChatSummary>();
  for (const msg of messages) {
    const chatId = normalize(msg.chatId);
    const existing = chatMap.get(chatId);
    const msgMs = toMs(msg.timestamp) || toMs(msg.createdAt);
    if (!existing) {
      chatMap.set(chatId, {
        chatId,
        lastMessage: msg.body || `[${msg.type}]`,
        lastTime: msgMs,
        direction: msg.direction,
        unread: msg.direction === 'incoming' ? 1 : 0,
        messageCount: 1,
      });
    } else {
      existing.messageCount++;
      if (msg.direction === 'incoming') existing.unread++;
      if (msgMs > (existing.lastTime as number)) {
        existing.lastMessage = msg.body || `[${msg.type}]`;
        existing.lastTime = msgMs;
        existing.direction = msg.direction;
      }
    }
  }

  let chats = Array.from(chatMap.values()).sort((a, b) => {
    return (b.lastTime as number) - (a.lastTime as number);
  });

  // Filter chats by search
  if (search) {
    const q = search.toLowerCase();
    chats = chats.filter(c => {
      const displayName = getContactDisplayName(c.chatId, contactMap);
      const phone = extractPhone(c.chatId);
      return displayName.toLowerCase().includes(q) ||
        phone.includes(q) ||
        c.lastMessage.toLowerCase().includes(q);
    });
  }

  // Messages for the active chat (normalize to merge @c.us / @s.whatsapp.net + country code)
  const chatMessages = messages
    .filter(m => normalize(m.chatId) === activeChatId)
    .sort((a, b) => {
      const ta = toMs(a.timestamp) || toMs(a.createdAt);
      const tb = toMs(b.timestamp) || toMs(b.createdAt);
      return ta - tb;
    });

  // Auto-scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, activeChatId]);

  // Auto-select first chat
  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].chatId);
    }
  }, [chats, activeChatId]);

  // Reset chat when session changes
  useEffect(() => {
    setActiveChatId('');
  }, [sessionId]);

  // Auto-refresh messages every 5 seconds
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      void refetchMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, refetchMessages]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !sessionId || !activeChatId || sending) return;
    setSending(true);
    try {
      await messageApi.sendText(sessionId, activeChatId, newMessage.trim());
      setNewMessage('');
      setTimeout(() => void refetchMessages(), 500);
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [newMessage, sessionId, activeChatId, sending, refetchMessages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSaveContactName = async (chatId: string) => {
    if (!editName.trim() || !sessionId) return;
    setSavingContact(true);
    try {
      const existingContact = contactMap[chatId];
      if (existingContact) {
        // Update existing contact
        await contactApi.updateName(sessionId, chatId, editName.trim());
      } else {
        // Save new contact
        const phone = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
        await contactApi.save(sessionId, chatId, editName.trim(), phone);
      }
      setEditingContact('');
      setEditName('');
      void refetchContacts();
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setSavingContact(false);
    }
  };

  // Group messages by date for separators
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of chatMessages) {
    const d = formatDate(msg.timestamp || msg.createdAt);
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: d, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  const activeContact = contactMap[activeChatId];
  const isGroup = activeChatId.endsWith('@g.us');

  if (loadingSessions) {
    return (
      <div className="conversations-page">
        <div className="loading-center"><Loader2 className="animate-spin" size={32} /></div>
      </div>
    );
  }

  return (
    <div className="conversations-page">
      <PageHeader
        title={t('conversations.title', 'Conversations')}
        subtitle={t('conversations.subtitle', 'View incoming and outgoing messages')}
      />

      {/* Session selector */}
      <div className="session-bar">
        <select value={sessionId} onChange={e => setSessionId(e.target.value)}>
          {allSessions.length === 0 && <option value="">No sessions</option>}
          {allSessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.status} {s.phone ? `(${s.phone})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="conversations-container">
        {/* ── Left: Chat List ────────────────────── */}
        <div className="chat-list-panel">
          <div className="chat-search">
            <input
              type="text"
              placeholder={t('conversations.searchPlaceholder', 'Search by name, number, or message...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <ul className="chat-list">
            {loadingMessages && chats.length === 0 ? (
              <div className="loading-center" style={{ padding: '2rem' }}>
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : chats.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <MessageSquare size={32} className="empty-icon" />
                <p>{selectedSession?.status !== 'ready'
                  ? t('conversations.sessionNotReady', 'Session is not connected. Start the session and scan QR code first.')
                  : t('conversations.noChats', 'No conversations yet. Send or receive a message to get started.')
                }</p>
              </div>
            ) : (
              chats.map(chat => {
                const displayName = getContactDisplayName(chat.chatId, contactMap);
                const contact = contactMap[chat.chatId];
                const phone = extractPhone(chat.chatId);
                const chatIsGroup = chat.chatId.endsWith('@g.us');

                return (
                  <li
                    key={chat.chatId}
                    className={`chat-item ${activeChatId === chat.chatId ? 'active' : ''}`}
                    onClick={() => setActiveChatId(chat.chatId)}
                  >
                    <div className={`chat-avatar ${chatIsGroup ? 'group' : ''}`}>
                      {chatIsGroup ? <Users size={18} /> : getInitials(chat.chatId, contactMap)}
                    </div>
                    <div className="chat-info">
                      <div className="chat-info-top">
                        <span className="chat-name">{displayName}</span>
                        <span className="chat-time">{formatTime(chat.lastTime)}</span>
                      </div>
                      {!chatIsGroup && contact?.name && (
                        <div className="chat-phone-sub">{formatPhone(phone)}</div>
                      )}
                      <div className="chat-preview">
                        {chat.direction === 'outgoing' && (
                          <span style={{ marginRight: 4 }}>
                            <ArrowUp size={10} style={{ display: 'inline' }} />
                          </span>
                        )}
                        {chat.direction === 'incoming' && (
                          <span style={{ marginRight: 4 }}>
                            <ArrowDown size={10} style={{ display: 'inline' }} />
                          </span>
                        )}
                        {chat.lastMessage}
                      </div>
                    </div>
                    <div className="chat-right">
                      {!chatIsGroup && !contact && (
                        <span className="chat-unsaved-badge" title="Unsaved contact">
                          <UserPlus size={12} />
                        </span>
                      )}
                      {chat.messageCount > 0 && (
                        <span className="chat-badge">{chat.messageCount}</span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* ── Right: Message Thread ──────────────── */}
        <div className="message-thread-panel">
          {activeChatId ? (
            <>
              <div className="thread-header">
                <div className={`chat-avatar ${isGroup ? 'group' : ''}`}>
                  {isGroup ? <Users size={18} /> : getInitials(activeChatId, contactMap)}
                </div>
                <div className="thread-header-info">
                  <div className="thread-header-name-row">
                    {editingContact === activeChatId ? (
                      <div className="contact-edit-inline">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void handleSaveContactName(activeChatId);
                            if (e.key === 'Escape') setEditingContact('');
                          }}
                          placeholder="Enter contact name..."
                          autoFocus
                        />
                        <button
                          className="contact-edit-save"
                          onClick={() => void handleSaveContactName(activeChatId)}
                          disabled={savingContact}
                        >
                          {savingContact ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button
                          className="contact-edit-cancel"
                          onClick={() => setEditingContact('')}
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3>{getContactDisplayName(activeChatId, contactMap)}</h3>
                        {!isGroup && activeContact ? (
                          <button
                            className="contact-edit-btn"
                            onClick={() => {
                              setEditingContact(activeChatId);
                              setEditName(activeContact?.name || activeContact?.pushName || '');
                            }}
                            title="Edit contact name"
                          >
                            <Pencil size={12} />
                          </button>
                        ) : !isGroup ? (
                          <button
                            className="contact-save-btn"
                            onClick={() => {
                              setEditingContact(activeChatId);
                              setEditName('');
                            }}
                            title="Save contact"
                          >
                            <UserPlus size={14} />
                            <span>Save Contact</span>
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="thread-header-details">
                    {!isGroup && (
                      <span className="thread-phone">{formatPhone(extractPhone(activeChatId))}</span>
                    )}
                    <span className="thread-msg-count">{chatMessages.length} messages</span>
                    {activeContact?.pushName && activeContact.pushName !== activeContact.name && (
                      <span className="thread-pushname">~{activeContact.pushName}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="message-list">
                {chatMessages.length === 0 ? (
                  <div className="empty-state">
                    <MessageSquare size={32} className="empty-icon" />
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="date-separator">
                        <span>{group.date}</span>
                      </div>
                      {group.messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`message-bubble ${msg.direction === 'incoming' ? 'incoming' : 'outgoing'}`}
                        >
                          {msg.type !== 'text' && (
                            <div className="message-type-badge">
                              [{msg.type}]
                            </div>
                          )}
                          <p className="message-body">{msg.body || `[${msg.type}]`}</p>
                          <div className="message-meta">
                            <span className="message-time">
                              {formatTime(msg.timestamp || msg.createdAt)}
                            </span>
                            {msg.direction === 'outgoing' && (
                              <span className="message-status">
                                {statusIcon(msg.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Message input */}
              <div className="message-input-bar">
                <input
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    !canWrite
                      ? t('conversations.viewOnly', 'View only mode')
                      : selectedSession?.status !== 'ready'
                        ? t('conversations.connectFirst', 'Connect session to send messages')
                        : t('conversations.typePlaceholder', 'Type a message...')
                  }
                  disabled={!canWrite || selectedSession?.status !== 'ready'}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!canWrite || sending || !newMessage.trim() || selectedSession?.status !== 'ready'}
                >
                  {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <MessageSquare size={48} className="empty-icon" />
              <p>{t('conversations.selectChat', 'Select a conversation to view messages')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Conversations;
