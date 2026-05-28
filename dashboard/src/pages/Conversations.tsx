import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare, Loader2, ArrowDown, ArrowUp, Check, CheckCheck, Clock, XCircle } from 'lucide-react';
import { messageApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useMessagesQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import type { Message } from '../services/api';
import './Conversations.css';

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(ts: string | number | null | undefined): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string | number | null | undefined): string {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(chatId: string): string {
  if (chatId.endsWith('@g.us')) return 'G';
  const digits = chatId.replace(/[^0-9]/g, '');
  return digits.slice(-2) || '?';
}

function getChatDisplayName(chatId: string): string {
  if (chatId.endsWith('@g.us')) {
    return chatId.replace('@g.us', '');
  }
  const phone = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
  return '+' + phone;
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

  const messages: Message[] = messagesData?.messages || [];

  // Build chat list from messages
  const chatMap = new Map<string, ChatSummary>();
  for (const msg of messages) {
    const existing = chatMap.get(msg.chatId);
    const msgTime = msg.timestamp || msg.createdAt;
    if (!existing) {
      chatMap.set(msg.chatId, {
        chatId: msg.chatId,
        lastMessage: msg.body || `[${msg.type}]`,
        lastTime: msgTime,
        direction: msg.direction,
        unread: msg.direction === 'incoming' ? 1 : 0,
        messageCount: 1,
      });
    } else {
      existing.messageCount++;
      if (msg.direction === 'incoming') existing.unread++;
      const existingTs = typeof existing.lastTime === 'number' ? existing.lastTime : new Date(existing.lastTime).getTime();
      const msgTs = typeof msgTime === 'number' ? (msgTime > 1e12 ? msgTime : msgTime * 1000) : new Date(msgTime).getTime();
      if (msgTs > existingTs) {
        existing.lastMessage = msg.body || `[${msg.type}]`;
        existing.lastTime = msgTime;
        existing.direction = msg.direction;
      }
    }
  }

  let chats = Array.from(chatMap.values()).sort((a, b) => {
    const ta = typeof a.lastTime === 'number' ? (a.lastTime > 1e12 ? a.lastTime : a.lastTime * 1000) : new Date(a.lastTime).getTime();
    const tb = typeof b.lastTime === 'number' ? (b.lastTime > 1e12 ? b.lastTime : b.lastTime * 1000) : new Date(b.lastTime).getTime();
    return tb - ta;
  });

  // Filter chats by search
  if (search) {
    const q = search.toLowerCase();
    chats = chats.filter(c =>
      getChatDisplayName(c.chatId).toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  }

  // Messages for the active chat
  const chatMessages = messages
    .filter(m => m.chatId === activeChatId)
    .sort((a, b) => {
      const ta = a.timestamp || new Date(a.createdAt).getTime() / 1000;
      const tb = b.timestamp || new Date(b.createdAt).getTime() / 1000;
      return (ta as number) - (tb as number);
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
      // Refetch to show the sent message
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

  const selectedSession = allSessions.find(s => s.id === sessionId);

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
              placeholder={t('conversations.searchPlaceholder', 'Search conversations...')}
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
              chats.map(chat => (
                <li
                  key={chat.chatId}
                  className={`chat-item ${activeChatId === chat.chatId ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.chatId)}
                >
                  <div className="chat-avatar">{getInitials(chat.chatId)}</div>
                  <div className="chat-info">
                    <div className="chat-info-top">
                      <span className="chat-name">{getChatDisplayName(chat.chatId)}</span>
                      <span className="chat-time">{formatTime(chat.lastTime)}</span>
                    </div>
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
                  {chat.messageCount > 0 && (
                    <span className="chat-badge">{chat.messageCount}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* ── Right: Message Thread ──────────────── */}
        <div className="message-thread-panel">
          {activeChatId ? (
            <>
              <div className="thread-header">
                <div className="chat-avatar">{getInitials(activeChatId)}</div>
                <div className="thread-header-info">
                  <h3>{getChatDisplayName(activeChatId)}</h3>
                  <span>{chatMessages.length} messages</span>
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
