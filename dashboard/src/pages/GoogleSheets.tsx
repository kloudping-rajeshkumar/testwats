import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  Plus,
  Trash2,
  ExternalLink,
  Share2,
  Send,
  UserPlus,
  Loader2,
  LogOut,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import {
  useGoogleAccountsQuery,
  useGoogleSpreadsheetsQuery,
  useConnectGoogleMutation,
  useRemoveGoogleAccountMutation,
  useCreateSpreadsheetMutation,
  useDeleteSpreadsheetMutation,
  useShareSpreadsheetMutation,
  useSendSheetWhatsAppMutation,
  useSessionsQuery,
} from '../hooks/queries';
import type { GoogleSpreadsheet } from '../services/api';
import './GoogleSheets.css';

type ModalType = 'connect' | 'create' | 'share' | 'send' | null;

export function GoogleSheets() {
  const { t } = useTranslation();
  useDocumentTitle(t('googleSheets.title'));
  const toast = useToast();

  const [modal, setModal] = useState<ModalType>(null);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSpreadsheet | null>(null);

  const { data: accounts = [], isLoading: loadingAccounts } = useGoogleAccountsQuery();
  const { data: spreadsheets = [], isLoading: loadingSheets } = useGoogleSpreadsheetsQuery();
  const { data: sessions = [] } = useSessionsQuery();

  const connectMutation = useConnectGoogleMutation();
  const removeAccountMutation = useRemoveGoogleAccountMutation();
  const createSheetMutation = useCreateSpreadsheetMutation();
  const deleteSheetMutation = useDeleteSpreadsheetMutation();
  const shareMutation = useShareSpreadsheetMutation();
  const sendMutation = useSendSheetWhatsAppMutation();

  // ── Connect Account ──────────────────────────────────
  const [connectLabel, setConnectLabel] = useState('');

  const handleConnect = async () => {
    if (!connectLabel.trim()) return;
    try {
      const result = await connectMutation.mutateAsync(connectLabel.trim());
      window.open(result.url, '_blank');
      setModal(null);
      setConnectLabel('');
      toast.info(t('googleSheets.connecting'), '');
    } catch {
      toast.error(t('common.errorGeneric'), '');
    }
  };

  const handleRemoveAccount = async (label: string) => {
    try {
      await removeAccountMutation.mutateAsync(label);
      toast.success(t('googleSheets.toasts.accountRemoved'), '');
    } catch {
      toast.error(t('googleSheets.toasts.accountRemoveFailed'), '');
    }
  };

  // ── Create Sheet ─────────────────────────────────────
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newSheetAccount, setNewSheetAccount] = useState('');
  const [newSheetHeaders, setNewSheetHeaders] = useState('');

  const handleCreateSheet = async () => {
    if (!newSheetTitle.trim() || !newSheetAccount) return;
    try {
      const headers = newSheetHeaders
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      await createSheetMutation.mutateAsync({
        tokenLabel: newSheetAccount,
        title: newSheetTitle.trim(),
        headers: headers.length > 0 ? headers : undefined,
      });
      toast.success(t('googleSheets.toasts.sheetCreated'), '');
      setModal(null);
      setNewSheetTitle('');
      setNewSheetHeaders('');
    } catch {
      toast.error(t('googleSheets.toasts.sheetCreateFailed'), '');
    }
  };

  const handleDeleteSheet = async (sheet: GoogleSpreadsheet) => {
    try {
      await deleteSheetMutation.mutateAsync({
        spreadsheetId: sheet.spreadsheetId,
        tokenLabel: sheet.tokenLabel,
      });
      toast.success(t('googleSheets.toasts.sheetDeleted'), '');
    } catch {
      toast.error(t('googleSheets.toasts.sheetDeleteFailed'), '');
    }
  };

  // ── Share ────────────────────────────────────────────
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('reader');

  const handleShare = async () => {
    if (!selectedSheet || !shareEmail.trim()) return;
    try {
      await shareMutation.mutateAsync({
        spreadsheetId: selectedSheet.spreadsheetId,
        data: {
          tokenLabel: selectedSheet.tokenLabel,
          emailAddress: shareEmail.trim(),
          role: shareRole,
          sendNotification: true,
        },
      });
      toast.success(t('googleSheets.toasts.shared'), '');
      setModal(null);
      setShareEmail('');
    } catch {
      toast.error(t('googleSheets.toasts.shareFailed'), '');
    }
  };

  // ── Send via WhatsApp ────────────────────────────────
  const [sendSession, setSendSession] = useState('');
  const [sendChatId, setSendChatId] = useState('');
  const [sendFormat, setSendFormat] = useState('link');
  const [sendCaption, setSendCaption] = useState('');

  const readySessions = sessions.filter((s) => s.status === 'ready');

  const handleSend = async () => {
    if (!selectedSheet || !sendSession || !sendChatId.trim()) return;
    try {
      await sendMutation.mutateAsync({
        spreadsheetId: selectedSheet.spreadsheetId,
        data: {
          tokenLabel: selectedSheet.tokenLabel,
          sessionId: sendSession,
          chatId: sendChatId.trim(),
          format: sendFormat,
          caption: sendCaption.trim() || undefined,
        },
      });
      toast.success(t('googleSheets.toasts.sent'), '');
      setModal(null);
      setSendChatId('');
      setSendCaption('');
    } catch {
      toast.error(t('googleSheets.toasts.sendFailed'), '');
    }
  };

  const isLoading = loadingAccounts || loadingSheets;

  return (
    <div className="google-sheets-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-header-left">
            <Sheet size={26} />
            <div>
              <h1>{t('googleSheets.title')}</h1>
              <p>{t('googleSheets.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn-primary" onClick={() => setModal('connect')}>
            <UserPlus size={16} /> {t('googleSheets.connectAccount')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (accounts.length > 0) {
                setNewSheetAccount(accounts[0].label);
              }
              setModal('create');
            }}
            disabled={accounts.length === 0}
          >
            <Plus size={16} /> {t('googleSheets.createSheet')}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="gs-empty">
          <Loader2 size={32} className="animate-spin" />
        </div>
      )}

      {/* Connected Accounts */}
      <div className="gs-section">
        <div className="gs-section-header">
          <span className="gs-section-title">{t('googleSheets.accounts')}</span>
        </div>
        <div className="gs-section-body">
          {accounts.length === 0 ? (
            <div className="gs-empty">
              <UserPlus size={40} />
              <p>{t('googleSheets.noAccounts')}</p>
              <p>{t('googleSheets.noAccountsDesc')}</p>
            </div>
          ) : (
            <div className="gs-accounts-grid">
              {accounts.map((account) => (
                <div key={account.id} className="gs-account-card">
                  <div className="gs-account-info">
                    <span className="gs-account-label">{account.label}</span>
                    <span className="gs-account-email">{account.email}</span>
                  </div>
                  <button
                    className="btn-icon danger"
                    title={t('googleSheets.removeAccount')}
                    onClick={() => handleRemoveAccount(account.label)}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spreadsheets */}
      <div className="gs-section">
        <div className="gs-section-header">
          <span className="gs-section-title">{t('googleSheets.spreadsheets')}</span>
        </div>
        <div className="gs-section-body" style={{ padding: 0 }}>
          {spreadsheets.length === 0 ? (
            <div className="gs-empty">
              <Sheet size={40} />
              <p>{t('googleSheets.noSheets')}</p>
              <p>{t('googleSheets.noSheetsDesc')}</p>
            </div>
          ) : (
            <table className="gs-sheet-table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('googleSheets.account')}</th>
                  <th>{t('common.url')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {spreadsheets.map((sheet) => (
                  <tr key={sheet.id}>
                    <td className="gs-sheet-title">{sheet.title}</td>
                    <td>{sheet.tokenLabel}</td>
                    <td>
                      {sheet.spreadsheetUrl && (
                        <a
                          className="gs-sheet-url"
                          href={sheet.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('googleSheets.openInGoogle')} <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                    <td>
                      <div className="gs-sheet-actions">
                        <button
                          className="btn-icon"
                          title={t('googleSheets.share')}
                          onClick={() => {
                            setSelectedSheet(sheet);
                            setModal('share');
                          }}
                        >
                          <Share2 size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title={t('googleSheets.sendWhatsApp')}
                          onClick={() => {
                            setSelectedSheet(sheet);
                            if (readySessions.length > 0) {
                              setSendSession(readySessions[0].id);
                            }
                            setModal('send');
                          }}
                        >
                          <Send size={14} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title={t('common.delete')}
                          onClick={() => handleDeleteSheet(sheet)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────── */}

      {/* Connect Account Modal */}
      {modal === 'connect' && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.connectAccount')}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.connectLabel')}</label>
              <input
                type="text"
                value={connectLabel}
                onChange={(e) => setConnectLabel(e.target.value)}
                placeholder={t('googleSheets.connectLabelPlaceholder')}
                autoFocus
              />
              <span className="gs-form-hint">{t('googleSheets.connectHint')}</span>
            </div>
            <div className="gs-modal-actions">
              <button className="btn-icon" style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setModal(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleConnect}
                disabled={!connectLabel.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {t('common.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Spreadsheet Modal */}
      {modal === 'create' && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.createSheet')}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.account')}</label>
              <select value={newSheetAccount} onChange={(e) => setNewSheetAccount(e.target.value)}>
                <option value="">{t('googleSheets.selectAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.label} value={a.label}>
                    {a.label} ({a.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.sheetTitle')}</label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder={t('googleSheets.sheetTitlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.headers')} ({t('common.optional')})</label>
              <input
                type="text"
                value={newSheetHeaders}
                onChange={(e) => setNewSheetHeaders(e.target.value)}
                placeholder={t('googleSheets.headersPlaceholder')}
              />
            </div>
            <div className="gs-modal-actions">
              <button className="btn-icon" style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setModal(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateSheet}
                disabled={!newSheetTitle.trim() || !newSheetAccount || createSheetMutation.isPending}
              >
                {createSheetMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {modal === 'share' && selectedSheet && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.shareTitle')}: {selectedSheet.title}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.shareEmail')}</label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder={t('googleSheets.shareEmailPlaceholder')}
                autoFocus
              />
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.shareRole')}</label>
              <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
                <option value="reader">{t('googleSheets.shareRoles.reader')}</option>
                <option value="writer">{t('googleSheets.shareRoles.writer')}</option>
                <option value="commenter">{t('googleSheets.shareRoles.commenter')}</option>
              </select>
            </div>
            <div className="gs-modal-actions">
              <button className="btn-icon" style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setModal(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleShare}
                disabled={!shareEmail.trim() || shareMutation.isPending}
              >
                {shareMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                {t('googleSheets.share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send via WhatsApp Modal */}
      {modal === 'send' && selectedSheet && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.sendTitle')}: {selectedSheet.title}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.sendSession')}</label>
              <select value={sendSession} onChange={(e) => setSendSession(e.target.value)}>
                {readySessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
                {readySessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || s.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.sendChatId')}</label>
              <input
                type="text"
                value={sendChatId}
                onChange={(e) => setSendChatId(e.target.value)}
                placeholder={t('googleSheets.sendChatIdPlaceholder')}
              />
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.sendFormat')}</label>
              <select value={sendFormat} onChange={(e) => setSendFormat(e.target.value)}>
                <option value="link">{t('googleSheets.sendFormats.link')}</option>
                <option value="pdf">{t('googleSheets.sendFormats.pdf')}</option>
                <option value="xlsx">{t('googleSheets.sendFormats.xlsx')}</option>
              </select>
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.sendCaption')} ({t('common.optional')})</label>
              <input
                type="text"
                value={sendCaption}
                onChange={(e) => setSendCaption(e.target.value)}
                placeholder={t('googleSheets.sendCaptionPlaceholder')}
              />
            </div>
            <div className="gs-modal-actions">
              <button className="btn-icon" style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.8125rem' }} onClick={() => setModal(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleSend}
                disabled={!sendSession || !sendChatId.trim() || sendMutation.isPending}
              >
                {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('googleSheets.sendWhatsApp')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
