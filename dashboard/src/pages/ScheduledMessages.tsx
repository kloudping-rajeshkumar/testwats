import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Clock,
  Plus,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Calendar,
  MessageSquare,
  User,
  Loader2,
  Trash2,
  Edit3,
  Search,
  LayoutTemplate,
  ChevronDown,
} from 'lucide-react';
import {
  useSessionsQuery,
  useContactMapQuery,
  useScheduledMessagesQuery,
  useCreateScheduledMessageMutation,
  useCancelScheduledMessageMutation,
  useTemplatesQuery,
} from '../hooks/queries';
import { templateApi, type ScheduledMessage, type Contact, type MessageTemplate } from '../services/api';
import './ScheduledMessages.css';

// ── Helpers ──────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 4) return digits;
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length >= 11) {
    const cc = digits.slice(0, digits.length - 10);
    const local = digits.slice(-10);
    return `+${cc} ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function chatIdToPhone(chatId: string): string {
  return chatId.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
}

function getContactDisplayName(chatId: string, contactMap: Record<string, Contact> | undefined): string {
  if (!contactMap) return formatPhone(chatIdToPhone(chatId));
  const contact = contactMap[chatId];
  if (contact?.name) return contact.name;
  if (contact?.pushName) return contact.pushName;
  return formatPhone(chatIdToPhone(chatId));
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
      return <Clock size={14} className="status-icon pending" />;
    case 'sent':
      return <CheckCircle2 size={14} className="status-icon sent" />;
    case 'failed':
      return <XCircle size={14} className="status-icon failed" />;
    case 'cancelled':
      return <Ban size={14} className="status-icon cancelled" />;
    default:
      return <Clock size={14} />;
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getMinDateTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// ── Component ────────────────────────────────────────────────────────

export function ScheduledMessages() {
  const location = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formSessionId, setFormSessionId] = useState('');
  const [formChatId, setFormChatId] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formContactSearch, setFormContactSearch] = useState('');
  const [formError, setFormError] = useState('');

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const templatesQuery = useTemplatesQuery();
  const templatesList = templatesQuery.data || [];

  // Handle incoming template body from Templates page navigation
  useEffect(() => {
    const state = location.state as { templateBody?: string } | null;
    if (state?.templateBody) {
      setFormMessage(state.templateBody);
      setShowForm(true);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const sessionsQuery = useSessionsQuery();
  const scheduledQuery = useScheduledMessagesQuery(selectedSessionId || undefined);
  const contactMapQuery = useContactMapQuery(formSessionId || selectedSessionId);
  const createMutation = useCreateScheduledMessageMutation();
  const cancelMutation = useCancelScheduledMessageMutation();

  const sessions = sessionsQuery.data || [];
  const readySessions = sessions.filter(s => s.status === 'ready' || s.phone);
  const contactMap = contactMapQuery.data;

  // Build contact list from contact map for the picker
  const contactList = useMemo(() => {
    if (!contactMap) return [];
    return Object.values(contactMap)
      .filter(c => !c.isGroup)
      .sort((a, b) => {
        const nameA = a.name || a.pushName || a.phone || '';
        const nameB = b.name || b.pushName || b.phone || '';
        return nameA.localeCompare(nameB);
      });
  }, [contactMap]);

  // Filter contacts for the search in form
  const filteredContacts = useMemo(() => {
    if (!formContactSearch.trim()) return contactList;
    const q = formContactSearch.toLowerCase();
    return contactList.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.pushName && c.pushName.toLowerCase().includes(q)) ||
      c.phone.includes(q) ||
      c.chatId.includes(q)
    );
  }, [contactList, formContactSearch]);

  // Filter scheduled messages
  const filteredMessages = useMemo(() => {
    let msgs = scheduledQuery.data || [];
    if (filterStatus !== 'all') {
      msgs = msgs.filter(m => m.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(m =>
        m.message.toLowerCase().includes(q) ||
        m.chatId.toLowerCase().includes(q) ||
        getContactDisplayName(m.chatId, contactMap).toLowerCase().includes(q)
      );
    }
    // Sort: pending first (by scheduledAt ASC), then others by updatedAt DESC
    return msgs.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      if (a.status === 'pending' && b.status === 'pending') {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [scheduledQuery.data, filterStatus, searchQuery, contactMap]);

  const statusCounts = useMemo(() => {
    const msgs = scheduledQuery.data || [];
    return {
      all: msgs.length,
      pending: msgs.filter(m => m.status === 'pending').length,
      sent: msgs.filter(m => m.status === 'sent').length,
      failed: msgs.filter(m => m.status === 'failed').length,
      cancelled: msgs.filter(m => m.status === 'cancelled').length,
    };
  }, [scheduledQuery.data]);

  const handleCreate = async () => {
    setFormError('');
    if (!formSessionId) {
      setFormError('Please select a session');
      return;
    }
    if (!formChatId) {
      setFormError('Please select a contact');
      return;
    }
    if (!formMessage.trim()) {
      setFormError('Please enter a message');
      return;
    }
    if (!formScheduledAt) {
      setFormError('Please pick a date and time');
      return;
    }
    const scheduledDate = new Date(formScheduledAt);
    if (scheduledDate <= new Date()) {
      setFormError('Scheduled time must be in the future');
      return;
    }

    try {
      await createMutation.mutateAsync({
        sessionId: formSessionId,
        chatId: formChatId,
        message: formMessage.trim(),
        scheduledAt: scheduledDate.toISOString(),
      });
      // Reset form
      setFormChatId('');
      setFormMessage('');
      setFormScheduledAt('');
      setFormContactSearch('');
      setFormError('');
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create scheduled message');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch {
      // ignore
    }
  };

  const openForm = () => {
    setFormSessionId(selectedSessionId || (readySessions.length === 1 ? readySessions[0].id : ''));
    setFormChatId('');
    // Preserve message if set from template navigation
    if (!formMessage) setFormMessage('');
    setFormScheduledAt('');
    setFormContactSearch('');
    setFormError('');
    setShowTemplatePicker(false);
    setShowForm(true);
  };

  const applyTemplate = (template: MessageTemplate) => {
    let body = template.body;
    // Replace placeholders if contact is already selected
    if (formChatId && contactMap) {
      const displayName = getContactDisplayName(formChatId, contactMap);
      const phone = formatPhone(chatIdToPhone(formChatId));
      body = body.replace(/\{\{name\}\}/g, displayName);
      body = body.replace(/\{\{phone\}\}/g, phone);
    }
    body = body.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
    setFormMessage(body);
    setShowTemplatePicker(false);
    // Increment usage count in background
    void templateApi.use(template.id);
  };

  return (
    <div className="scheduled-page">
      <div className="page-header">
        <div className="page-header-left">
          <Clock size={28} />
          <div>
            <h1>Scheduled Messages</h1>
            <p>Schedule messages to be sent automatically at a specific time</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openForm}>
          <Plus size={16} />
          Schedule Message
        </button>
      </div>

      {/* Filters bar */}
      <div className="scheduled-filters">
        <div className="filter-session">
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
          >
            <option value="">All Sessions</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.phone ? `(${formatPhone(s.phone)})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-status-tabs">
          {(['all', 'pending', 'sent', 'failed', 'cancelled'] as const).map(status => (
            <button
              key={status}
              className={`status-tab ${filterStatus === status ? 'active' : ''}`}
              onClick={() => setFilterStatus(status)}
            >
              {status !== 'all' && getStatusIcon(status)}
              {getStatusLabel(status)}
              <span className="tab-count">{statusCounts[status]}</span>
            </button>
          ))}
        </div>

        <div className="filter-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Scheduled messages list */}
      <div className="scheduled-list">
        {scheduledQuery.isLoading ? (
          <div className="empty-state">
            <Loader2 size={32} className="animate-spin" />
            <p>Loading scheduled messages...</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="empty-state">
            <Calendar size={48} className="empty-icon" />
            <p>No scheduled messages{filterStatus !== 'all' ? ` with status "${filterStatus}"` : ''}</p>
            <button className="btn-primary" onClick={openForm}>
              <Plus size={16} />
              Schedule your first message
            </button>
          </div>
        ) : (
          filteredMessages.map(msg => (
            <ScheduledMessageCard
              key={msg.id}
              msg={msg}
              contactMap={contactMap}
              sessionName={sessions.find(s => s.id === msg.sessionId)?.name}
              onCancel={handleCancel}
              isCancelling={cancelMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content schedule-form" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Clock size={20} /> Schedule Message</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-body">
              {/* Session select */}
              <div className="form-group">
                <label>
                  <MessageSquare size={14} />
                  Session
                </label>
                <select
                  value={formSessionId}
                  onChange={e => {
                    setFormSessionId(e.target.value);
                    setFormChatId('');
                    setFormContactSearch('');
                  }}
                >
                  <option value="">Select a session...</option>
                  {readySessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${formatPhone(s.phone)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact picker */}
              <div className="form-group">
                <label>
                  <User size={14} />
                  Contact
                </label>
                {formChatId ? (
                  <div className="selected-contact">
                    <span className="selected-contact-name">
                      {getContactDisplayName(formChatId, contactMap)}
                    </span>
                    <span className="selected-contact-phone">
                      {formatPhone(chatIdToPhone(formChatId))}
                    </span>
                    <button
                      className="selected-contact-clear"
                      onClick={() => { setFormChatId(''); setFormContactSearch(''); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="contact-search-input">
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder={formSessionId ? 'Search contacts or type number...' : 'Select a session first'}
                        value={formContactSearch}
                        onChange={e => setFormContactSearch(e.target.value)}
                        disabled={!formSessionId}
                      />
                    </div>
                    {formSessionId && (
                      <div className="contact-picker-list">
                        {/* Manual entry option */}
                        {formContactSearch && /^\d{10,}$/.test(formContactSearch.replace(/[^0-9]/g, '')) && (
                          <button
                            className="contact-picker-item manual"
                            onClick={() => {
                              const digits = formContactSearch.replace(/[^0-9]/g, '');
                              setFormChatId(`${digits}@c.us`);
                              setFormContactSearch('');
                            }}
                          >
                            <div className="cp-avatar"><Plus size={16} /></div>
                            <div className="cp-info">
                              <span className="cp-name">Send to {formatPhone(formContactSearch.replace(/[^0-9]/g, ''))}</span>
                              <span className="cp-phone">New number</span>
                            </div>
                          </button>
                        )}
                        {contactMapQuery.isLoading ? (
                          <div className="contact-picker-loading">
                            <Loader2 size={16} className="animate-spin" /> Loading contacts...
                          </div>
                        ) : filteredContacts.length === 0 ? (
                          <div className="contact-picker-empty">
                            No contacts found{formContactSearch ? ' — type a full number to send directly' : ''}
                          </div>
                        ) : (
                          filteredContacts.slice(0, 50).map(c => (
                            <button
                              key={c.chatId}
                              className="contact-picker-item"
                              onClick={() => {
                                setFormChatId(c.chatId);
                                setFormContactSearch('');
                              }}
                            >
                              <div className="cp-avatar">
                                {(c.name || c.pushName || c.phone).charAt(0).toUpperCase()}
                              </div>
                              <div className="cp-info">
                                <span className="cp-name">{c.name || c.pushName || formatPhone(c.phone)}</span>
                                <span className="cp-phone">{formatPhone(c.phone)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Template picker */}
              <div className="form-group">
                <label>
                  <LayoutTemplate size={14} />
                  Use Template
                </label>
                <div className="template-picker-wrapper">
                  <button
                    type="button"
                    className="template-picker-toggle"
                    onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  >
                    <LayoutTemplate size={14} />
                    <span>Choose a template</span>
                    <ChevronDown size={14} className={showTemplatePicker ? 'rotated' : ''} />
                  </button>
                  {showTemplatePicker && (
                    <div className="template-picker-dropdown">
                      {templatesQuery.isLoading ? (
                        <div className="template-picker-empty">
                          <Loader2 size={14} className="animate-spin" /> Loading templates...
                        </div>
                      ) : templatesList.length === 0 ? (
                        <div className="template-picker-empty">
                          No templates available
                        </div>
                      ) : (
                        templatesList.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            className="template-picker-item"
                            onClick={() => applyTemplate(t)}
                          >
                            <span className="tpi-name">{t.name}</span>
                            <span className="tpi-preview">
                              {t.body.length > 80 ? t.body.slice(0, 80) + '...' : t.body}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="form-group">
                <label>
                  <Edit3 size={14} />
                  Message
                </label>
                <textarea
                  placeholder="Type your message here..."
                  value={formMessage}
                  onChange={e => setFormMessage(e.target.value)}
                  rows={4}
                  maxLength={4096}
                />
                <span className="char-count">{formMessage.length}/4096</span>
              </div>

              {/* Date/Time */}
              <div className="form-group">
                <label>
                  <Calendar size={14} />
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={e => setFormScheduledAt(e.target.value)}
                  min={getMinDateTime()}
                />
              </div>

              {formError && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  {formError}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Scheduling...</>
                ) : (
                  <><Send size={16} /> Schedule Message</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card sub-component ───────────────────────────────────────────────

function ScheduledMessageCard({
  msg,
  contactMap,
  sessionName,
  onCancel,
  isCancelling,
}: {
  msg: ScheduledMessage;
  contactMap: Record<string, Contact> | undefined;
  sessionName?: string;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}) {
  const contactName = getContactDisplayName(msg.chatId, contactMap);
  const phone = formatPhone(chatIdToPhone(msg.chatId));
  const isPending = msg.status === 'pending';
  const scheduledDate = new Date(msg.scheduledAt);
  const now = new Date();
  const isOverdue = isPending && scheduledDate <= now;

  // Time until send
  let timeUntil = '';
  if (isPending && !isOverdue) {
    const diff = scheduledDate.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) timeUntil = `in ${days}d ${hrs % 24}h`;
    else if (hrs > 0) timeUntil = `in ${hrs}h ${mins % 60}m`;
    else if (mins > 0) timeUntil = `in ${mins}m`;
    else timeUntil = 'sending soon';
  }

  return (
    <div className={`scheduled-card ${msg.status} ${isOverdue ? 'overdue' : ''}`}>
      <div className="sc-header">
        <div className="sc-status">
          {getStatusIcon(msg.status)}
          <span className={`sc-status-label ${msg.status}`}>{getStatusLabel(msg.status)}</span>
          {isOverdue && <span className="sc-overdue-badge">Processing...</span>}
          {timeUntil && <span className="sc-time-until">{timeUntil}</span>}
        </div>
        {isPending && (
          <button
            className="sc-cancel-btn"
            onClick={() => onCancel(msg.id)}
            disabled={isCancelling}
            title="Cancel this scheduled message"
          >
            <Trash2 size={14} />
            Cancel
          </button>
        )}
      </div>

      <div className="sc-body">
        <div className="sc-contact">
          <div className="sc-contact-avatar">
            {contactName.charAt(0).toUpperCase()}
          </div>
          <div className="sc-contact-info">
            <span className="sc-contact-name">{contactName}</span>
            <span className="sc-contact-phone">{phone}</span>
          </div>
        </div>
        <div className="sc-message">
          <p>{msg.message}</p>
        </div>
      </div>

      <div className="sc-footer">
        <div className="sc-meta">
          <span className="sc-meta-item">
            <Calendar size={12} />
            {formatDateTime(msg.scheduledAt)}
          </span>
          {sessionName && (
            <span className="sc-meta-item">
              <MessageSquare size={12} />
              {sessionName}
            </span>
          )}
        </div>
        <div className="sc-meta-right">
          {msg.sentAt && (
            <span className="sc-meta-item sent-time">
              <CheckCircle2 size={12} />
              Sent {formatDateTime(msg.sentAt)}
            </span>
          )}
          {msg.errorMessage && (
            <span className="sc-meta-item error-msg" title={msg.errorMessage}>
              <AlertCircle size={12} />
              {msg.errorMessage.length > 60 ? msg.errorMessage.slice(0, 60) + '...' : msg.errorMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScheduledMessages;
