import { useState, useMemo, useCallback } from 'react';
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
  Search,
  User,
  Users,
  Edit3,
  Eye,
  Save,
  PlusCircle,
  X,
  FileSpreadsheet,
  GraduationCap,
  Receipt,
  ClipboardList,
  Users2,
  CalendarDays,
  RefreshCw,
  Download,
  Link,
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
  useContactMapQuery,
  useSessionGroupsQuery,
  useSyncFromDriveMutation,
  useImportByUrlMutation,
} from '../hooks/queries';
import { googleSheetsApi } from '../services/api';
import type { GoogleSpreadsheet } from '../services/api';
import './GoogleSheets.css';

// ── Sheet Templates ──────────────────────────────────────────────────

interface SheetTemplate {
  id: string;
  icon: typeof Sheet;
  color: string;
  headers: string[];
  sampleRows?: string[][];
}

const TEMPLATES: SheetTemplate[] = [
  {
    id: 'blank',
    icon: FileSpreadsheet,
    color: '#6b7280',
    headers: [],
  },
  {
    id: 'studentMarks',
    icon: GraduationCap,
    color: '#2563eb',
    headers: ['Roll No', 'Student Name', 'Math', 'Science', 'English', 'Hindi', 'Total', 'Percentage', 'Grade', 'Result'],
    sampleRows: [
      ['1', 'Rahul Kumar', '85', '90', '78', '88', '=SUM(C2:F2)', '=ROUND(G2/4,2)', '=IF(H2>=90,"A+",IF(H2>=80,"A",IF(H2>=70,"B",IF(H2>=60,"C","D"))))', '=IF(AND(C2>=35,D2>=35,E2>=35,F2>=35),"PASS","FAIL")'],
      ['2', 'Priya Sharma', '92', '88', '95', '91', '=SUM(C3:F3)', '=ROUND(G3/4,2)', '=IF(H3>=90,"A+",IF(H3>=80,"A",IF(H3>=70,"B",IF(H3>=60,"C","D"))))', '=IF(AND(C3>=35,D3>=35,E3>=35,F3>=35),"PASS","FAIL")'],
      ['3', 'Amit Singh', '45', '30', '55', '62', '=SUM(C4:F4)', '=ROUND(G4/4,2)', '=IF(H4>=90,"A+",IF(H4>=80,"A",IF(H4>=70,"B",IF(H4>=60,"C","D"))))', '=IF(AND(C4>=35,D4>=35,E4>=35,F4>=35),"PASS","FAIL")'],
      ['4', 'Sneha Patel', '78', '82', '71', '75', '=SUM(C5:F5)', '=ROUND(G5/4,2)', '=IF(H5>=90,"A+",IF(H5>=80,"A",IF(H5>=70,"B",IF(H5>=60,"C","D"))))', '=IF(AND(C5>=35,D5>=35,E5>=35,F5>=35),"PASS","FAIL")'],
      ['5', 'Ravi Verma', '60', '65', '58', '70', '=SUM(C6:F6)', '=ROUND(G6/4,2)', '=IF(H6>=90,"A+",IF(H6>=80,"A",IF(H6>=70,"B",IF(H6>=60,"C","D"))))', '=IF(AND(C6>=35,D6>=35,E6>=35,F6>=35),"PASS","FAIL")'],
      ['', '', '', '', '', '', '', '', '', ''],
      ['', '', 'Math Avg', 'Sci Avg', 'Eng Avg', 'Hin Avg', 'Class Avg', 'Highest %', 'Lowest %', 'Pass Count'],
      ['', '', '=ROUND(AVERAGE(C2:C6),1)', '=ROUND(AVERAGE(D2:D6),1)', '=ROUND(AVERAGE(E2:E6),1)', '=ROUND(AVERAGE(F2:F6),1)', '=ROUND(AVERAGE(H2:H6),1)', '=MAX(H2:H6)', '=MIN(H2:H6)', '=COUNTIF(J2:J6,"PASS")'],
    ],
  },
  {
    id: 'invoice',
    icon: Receipt,
    color: '#16a34a',
    headers: ['Item No', 'Description', 'HSN/SAC', 'Quantity', 'Unit Price', 'Discount %', 'Taxable Amt', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'Total'],
    sampleRows: [
      ['1', 'Web Development Service', '998314', '1', '50000', '10', '=D2*E2*(1-F2/100)', '9', '=G2*H2/100', '9', '=G2*J2/100', '=G2+I2+K2'],
      ['2', 'Domain & Hosting (1 Year)', '998315', '1', '5000', '0', '=D3*E3*(1-F3/100)', '9', '=G3*H3/100', '9', '=G3*J3/100', '=G3+I3+K3'],
      ['3', 'SSL Certificate', '998316', '2', '1500', '0', '=D4*E4*(1-F4/100)', '9', '=G4*H4/100', '9', '=G4*J4/100', '=G4+I4+K4'],
      ['4', 'Logo Design', '998314', '1', '8000', '5', '=D5*E5*(1-F5/100)', '9', '=G5*H5/100', '9', '=G5*J5/100', '=G5+I5+K5'],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', 'Sub Total', '', 'CGST Total', '', 'SGST Total', 'Grand Total'],
      ['', '', '', '', '', '', '=SUM(G2:G5)', '', '=SUM(I2:I5)', '', '=SUM(K2:K5)', '=SUM(L2:L5)'],
      ['', '', '', '', '', '', '', '', '', '', 'Total Tax:', '=I8+K8'],
      ['', '', '', '', '', '', '', '', '', '', 'Amount in Words:', '=L7'],
    ],
  },
  {
    id: 'attendance',
    icon: ClipboardList,
    color: '#9333ea',
    headers: ['S.No', 'Name', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Total Present', 'Total Absent', 'Percentage', 'Status'],
    sampleRows: [
      ['1', 'Rahul Kumar', 'P', 'P', 'A', 'P', 'P', 'P', '=COUNTIF(C2:H2,"P")', '=COUNTIF(C2:H2,"A")', '=ROUND(I2/6*100,1)', '=IF(K2>=75,"Regular",IF(K2>=50,"Irregular","Shortage"))'],
      ['2', 'Priya Sharma', 'P', 'P', 'P', 'P', 'P', 'P', '=COUNTIF(C3:H3,"P")', '=COUNTIF(C3:H3,"A")', '=ROUND(I3/6*100,1)', '=IF(K3>=75,"Regular",IF(K3>=50,"Irregular","Shortage"))'],
      ['3', 'Amit Singh', 'A', 'P', 'A', 'A', 'P', 'A', '=COUNTIF(C4:H4,"P")', '=COUNTIF(C4:H4,"A")', '=ROUND(I4/6*100,1)', '=IF(K4>=75,"Regular",IF(K4>=50,"Irregular","Shortage"))'],
      ['4', 'Sneha Patel', 'P', 'A', 'P', 'P', 'A', 'P', '=COUNTIF(C5:H5,"P")', '=COUNTIF(C5:H5,"A")', '=ROUND(I5/6*100,1)', '=IF(K5>=75,"Regular",IF(K5>=50,"Irregular","Shortage"))'],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ['', 'Summary', '', '', '', '', '', '', 'Total Present', 'Total Absent', 'Avg %', 'Regular Count'],
      ['', '', '', '', '', '', '', '', '=SUM(I2:I5)', '=SUM(J2:J5)', '=ROUND(AVERAGE(K2:K5),1)', '=COUNTIF(L2:L5,"Regular")'],
    ],
  },
  {
    id: 'employees',
    icon: Users2,
    color: '#ea580c',
    headers: ['Emp ID', 'Name', 'Department', 'Designation', 'Phone', 'Email', 'Basic Salary', 'HRA', 'DA', 'PF Deduction', 'Net Salary', 'Join Date'],
    sampleRows: [
      ['EMP001', 'Rajesh Kumar', 'Engineering', 'Sr. Developer', '9876543210', 'rajesh@company.com', '50000', '=G2*0.4', '=G2*0.2', '=G2*0.12', '=G2+H2+I2-J2', '2023-01-15'],
      ['EMP002', 'Anita Desai', 'Marketing', 'Manager', '9876543211', 'anita@company.com', '60000', '=G3*0.4', '=G3*0.2', '=G3*0.12', '=G3+H3+I3-J3', '2022-06-01'],
      ['EMP003', 'Vikram Joshi', 'Engineering', 'Developer', '9876543212', 'vikram@company.com', '40000', '=G4*0.4', '=G4*0.2', '=G4*0.12', '=G4+H4+I4-J4', '2024-03-10'],
      ['EMP004', 'Meena Shah', 'HR', 'HR Executive', '9876543213', 'meena@company.com', '35000', '=G5*0.4', '=G5*0.2', '=G5*0.12', '=G5+H5+I5-J5', '2023-08-20'],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', 'Total Basic', 'Total HRA', 'Total DA', 'Total PF', 'Total Net', 'Headcount'],
      ['', '', '', '', '', '', '=SUM(G2:G5)', '=SUM(H2:H5)', '=SUM(I2:I5)', '=SUM(J2:J5)', '=SUM(K2:K5)', '=COUNTA(A2:A5)'],
      ['', '', '', '', '', '', 'Avg Salary', '', '', '', 'Max Salary', 'Min Salary'],
      ['', '', '', '', '', '', '=ROUND(AVERAGE(G2:G5),0)', '', '', '', '=MAX(K2:K5)', '=MIN(K2:K5)'],
    ],
  },
  {
    id: 'expenses',
    icon: CalendarDays,
    color: '#dc2626',
    headers: ['Date', 'Category', 'Description', 'Amount', 'Payment Mode', 'Receipt No', 'Notes'],
    sampleRows: [
      ['2026-05-01', 'Office Supplies', 'Printer Paper & Ink', '2500', 'UPI', 'REC001', ''],
      ['2026-05-03', 'Travel', 'Client Meeting - Cab', '850', 'Cash', 'REC002', 'Meeting at Pune'],
      ['2026-05-05', 'Software', 'GitHub Subscription', '750', 'Credit Card', 'REC003', 'Monthly'],
      ['2026-05-08', 'Office Supplies', 'Stationery', '450', 'UPI', 'REC004', ''],
      ['2026-05-10', 'Food', 'Team Lunch', '3200', 'Credit Card', 'REC005', '8 people'],
      ['2026-05-12', 'Travel', 'Airport Pickup', '1200', 'Cash', 'REC006', 'Client visit'],
      ['2026-05-15', 'Software', 'Cloud Hosting', '5000', 'Bank Transfer', 'REC007', 'Monthly AWS'],
      ['', '', '', '', '', '', ''],
      ['', '', 'Total Expenses:', '=SUM(D2:D8)', '', '', ''],
      ['', '', 'Category Summary:', '', '', '', ''],
      ['', '', 'Office Supplies', '=SUMIF(B2:B8,"Office Supplies",D2:D8)', 'Count:', '=COUNTIF(B2:B8,"Office Supplies")', ''],
      ['', '', 'Travel', '=SUMIF(B2:B8,"Travel",D2:D8)', 'Count:', '=COUNTIF(B2:B8,"Travel")', ''],
      ['', '', 'Software', '=SUMIF(B2:B8,"Software",D2:D8)', 'Count:', '=COUNTIF(B2:B8,"Software")', ''],
      ['', '', 'Food', '=SUMIF(B2:B8,"Food",D2:D8)', 'Count:', '=COUNTIF(B2:B8,"Food")', ''],
      ['', '', 'Average Expense:', '=ROUND(AVERAGE(D2:D8),0)', 'Highest:', '=MAX(D2:D8)', ''],
    ],
  },
];

type ModalType = 'connect' | 'create' | 'share' | 'send' | 'editor' | 'import' | null;

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
  const syncMutation = useSyncFromDriveMutation();
  const importMutation = useImportByUrlMutation();

  // ── Sync from Drive ─────────────────────────────────
  const [syncAccount, setSyncAccount] = useState('');

  const handleSync = async () => {
    const label = syncAccount || (accounts.length > 0 ? accounts[0].label : '');
    if (!label) {
      toast.error(t('googleSheets.noAccounts'), '');
      return;
    }
    try {
      const result = await syncMutation.mutateAsync(label);
      toast.success(
        t('googleSheets.toasts.synced', { synced: result.synced, total: result.total }),
        '',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Drive API')) {
        toast.error(t('googleSheets.toasts.driveApiDisabled'), '');
      } else {
        toast.error(t('googleSheets.toasts.syncFailed'), '');
      }
    }
  };

  // ── Import by URL ───────────────────────────────────
  const [importUrl, setImportUrl] = useState('');
  const [importAccount, setImportAccount] = useState('');

  const handleImport = async () => {
    const label = importAccount || (accounts.length > 0 ? accounts[0].label : '');
    if (!label || !importUrl.trim()) return;
    try {
      await importMutation.mutateAsync({ tokenLabel: label, spreadsheetUrl: importUrl.trim() });
      toast.success(t('googleSheets.toasts.imported'), '');
      setModal(null);
      setImportUrl('');
    } catch {
      toast.error(t('googleSheets.toasts.importFailed'), '');
    }
  };

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

  // ── Create Sheet (with templates) ────────────────────
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [newSheetAccount, setNewSheetAccount] = useState('');
  const [newSheetHeaders, setNewSheetHeaders] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setNewSheetHeaders(tmpl.headers.join(', '));
      if (templateId !== 'blank' && !newSheetTitle.trim()) {
        setNewSheetTitle(t(`googleSheets.templates.${templateId}`));
      }
    }
  };

  const handleCreateSheet = async () => {
    if (!newSheetTitle.trim() || !newSheetAccount) return;
    try {
      const headers = newSheetHeaders
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      const result = await createSheetMutation.mutateAsync({
        tokenLabel: newSheetAccount,
        title: newSheetTitle.trim(),
        headers: headers.length > 0 ? headers : undefined,
      });

      // If template has sample rows, append them
      const tmpl = TEMPLATES.find((t) => t.id === selectedTemplate);
      if (tmpl?.sampleRows && tmpl.sampleRows.length > 0) {
        try {
          await googleSheetsApi.appendRows(result.spreadsheetId, {
            tokenLabel: newSheetAccount,
            values: tmpl.sampleRows,
          });
        } catch {
          // Sample data is optional, don't fail the whole create
        }
      }

      toast.success(t('googleSheets.toasts.sheetCreated'), '');
      setModal(null);
      setNewSheetTitle('');
      setNewSheetHeaders('');
      setSelectedTemplate('blank');
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
      if (selectedSheet?.id === sheet.id) setSelectedSheet(null);
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

  // ── Inline Editor ────────────────────────────────────
  const [editorData, setEditorData] = useState<string[][]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  const openEditor = async (sheet: GoogleSpreadsheet) => {
    setSelectedSheet(sheet);
    setModal('editor');
    setEditorLoading(true);
    setEditorDirty(false);
    try {
      const result = await googleSheetsApi.readRange(
        sheet.spreadsheetId,
        'Sheet1',
        sheet.tokenLabel,
      );
      setEditorData(result.values.length > 0 ? result.values : [['']]);
    } catch {
      setEditorData([['']]);
      toast.error(t('googleSheets.toasts.loadFailed'), '');
    } finally {
      setEditorLoading(false);
    }
  };

  const refreshEditor = async () => {
    if (!selectedSheet) return;
    setEditorLoading(true);
    try {
      const result = await googleSheetsApi.readRange(
        selectedSheet.spreadsheetId,
        'Sheet1',
        selectedSheet.tokenLabel,
      );
      setEditorData(result.values.length > 0 ? result.values : [['']]);
      setEditorDirty(false);
    } catch {
      toast.error(t('googleSheets.toasts.loadFailed'), '');
    } finally {
      setEditorLoading(false);
    }
  };

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    setEditorData((prev) => {
      const updated = prev.map((r) => [...r]);
      // Ensure row exists
      while (updated.length <= rowIdx) updated.push([]);
      // Ensure col exists
      while (updated[rowIdx].length <= colIdx) updated[rowIdx].push('');
      updated[rowIdx][colIdx] = value;
      return updated;
    });
    setEditorDirty(true);
  };

  const addRow = () => {
    setEditorData((prev) => {
      const cols = Math.max(...prev.map((r) => r.length), 1);
      return [...prev, Array(cols).fill('')];
    });
    setEditorDirty(true);
  };

  const deleteRow = (rowIdx: number) => {
    setEditorData((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== rowIdx);
    });
    setEditorDirty(true);
  };

  const addColumn = () => {
    setEditorData((prev) => prev.map((row) => [...row, '']));
    setEditorDirty(true);
  };

  const deleteColumn = (colIdx: number) => {
    setEditorData((prev) => {
      if (prev[0]?.length <= 1) return prev;
      return prev.map((row) => row.filter((_, i) => i !== colIdx));
    });
    setEditorDirty(true);
  };

  const saveEditor = async () => {
    if (!selectedSheet || !editorDirty) return;
    setEditorSaving(true);
    try {
      // Normalize: make all rows same length
      const maxCols = Math.max(...editorData.map((r) => r.length), 1);
      const normalized = editorData.map((row) => {
        const r = [...row];
        while (r.length < maxCols) r.push('');
        return r;
      });

      const endCol = String.fromCharCode(64 + maxCols); // A=65
      const range = `Sheet1!A1:${endCol}${normalized.length}`;

      await googleSheetsApi.updateRange(selectedSheet.spreadsheetId, {
        tokenLabel: selectedSheet.tokenLabel,
        range,
        values: normalized,
      });
      setEditorDirty(false);
      toast.success(t('googleSheets.toasts.saved'), '');
    } catch {
      toast.error(t('googleSheets.toasts.saveFailed'), '');
    } finally {
      setEditorSaving(false);
    }
  };

  // ── Send via WhatsApp ────────────────────────────────
  const [sendSession, setSendSession] = useState('');
  const [sendChatId, setSendChatId] = useState('');
  const [sendFormat, setSendFormat] = useState('link');
  const [sendCaption, setSendCaption] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const readySessions = sessions.filter((s) => s.status === 'ready');
  const { data: contactMap = {} } = useContactMapQuery(sendSession);
  const { data: groups = [] } = useSessionGroupsQuery(sendSession, !!sendSession);

  const contactList = useMemo(() => {
    const items: { chatId: string; name: string; type: 'contact' | 'group'; phone?: string }[] = [];
    Object.values(contactMap).forEach((c) => {
      if (!c.isGroup) {
        items.push({ chatId: c.chatId, name: c.name || c.pushName || c.phone || c.chatId, type: 'contact', phone: c.phone });
      }
    });
    groups.forEach((g) => {
      items.push({ chatId: g.id, name: g.name || g.id, type: 'group' });
    });
    Object.values(contactMap).forEach((c) => {
      if (c.isGroup && !items.some((i) => i.chatId === c.chatId)) {
        items.push({ chatId: c.chatId, name: c.name || c.pushName || c.chatId, type: 'group' });
      }
    });
    return items;
  }, [contactMap, groups]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contactList;
    const q = contactSearch.toLowerCase();
    return contactList.filter((c) => c.name.toLowerCase().includes(q) || c.chatId.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
  }, [contactList, contactSearch]);

  const selectedContactName = useMemo(() => {
    if (!sendChatId) return '';
    const found = contactList.find((c) => c.chatId === sendChatId);
    return found ? found.name : sendChatId;
  }, [sendChatId, contactList]);

  const handleSend = async () => {
    if (!selectedSheet || !sendSession || !sendChatId.trim()) return;
    try {
      await sendMutation.mutateAsync({
        spreadsheetId: selectedSheet.spreadsheetId,
        data: { tokenLabel: selectedSheet.tokenLabel, sessionId: sendSession, chatId: sendChatId.trim(), format: sendFormat, caption: sendCaption.trim() || undefined },
      });
      toast.success(t('googleSheets.toasts.sent'), '');
      setModal(null);
      setSendChatId('');
      setSendCaption('');
      setContactSearch('');
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
          {accounts.length > 1 && (
            <select
              className="gs-sync-account-select"
              value={syncAccount || (accounts.length > 0 ? accounts[0].label : '')}
              onChange={(e) => setSyncAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.label} value={a.label}>{a.label}</option>
              ))}
            </select>
          )}
          <button
            className="btn-primary"
            onClick={handleSync}
            disabled={accounts.length === 0 || syncMutation.isPending}
          >
            {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {t('googleSheets.syncFromDrive')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (accounts.length > 0) setImportAccount(accounts[0].label);
              setImportUrl('');
              setModal('import');
            }}
            disabled={accounts.length === 0}
          >
            <Link size={16} /> {t('googleSheets.importByUrl')}
          </button>
          <button className="btn-primary" onClick={() => setModal('connect')}>
            <UserPlus size={16} /> {t('googleSheets.connectAccount')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (accounts.length > 0) setNewSheetAccount(accounts[0].label);
              setSelectedTemplate('blank');
              setNewSheetHeaders('');
              setNewSheetTitle('');
              setModal('create');
            }}
            disabled={accounts.length === 0}
          >
            <Plus size={16} /> {t('googleSheets.createSheet')}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="gs-empty"><Loader2 size={32} className="animate-spin" /></div>
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
                  <button className="btn-icon danger" title={t('googleSheets.removeAccount')} onClick={() => handleRemoveAccount(account.label)}>
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
                        <a className="gs-sheet-url" href={sheet.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                          {t('googleSheets.openInGoogle')} <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                    <td>
                      <div className="gs-sheet-actions">
                        <button className="btn-icon" title={t('googleSheets.viewEdit')} onClick={() => openEditor(sheet)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-icon" title={t('googleSheets.share')} onClick={() => { setSelectedSheet(sheet); setModal('share'); }}>
                          <Share2 size={14} />
                        </button>
                        <button className="btn-icon" title={t('googleSheets.sendWhatsApp')} onClick={() => { setSelectedSheet(sheet); if (readySessions.length > 0) setSendSession(readySessions[0].id); setModal('send'); }}>
                          <Send size={14} />
                        </button>
                        <button className="btn-icon danger" title={t('common.delete')} onClick={() => handleDeleteSheet(sheet)}>
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

      {/* ════════════════ MODALS ════════════════ */}

      {/* Connect Account Modal */}
      {modal === 'connect' && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.connectAccount')}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.connectLabel')}</label>
              <input type="text" value={connectLabel} onChange={(e) => setConnectLabel(e.target.value)} placeholder={t('googleSheets.connectLabelPlaceholder')} autoFocus />
              <span className="gs-form-hint">{t('googleSheets.connectHint')}</span>
            </div>
            <div className="gs-modal-actions">
              <button className="btn-cancel" onClick={() => setModal(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleConnect} disabled={!connectLabel.trim() || connectMutation.isPending}>
                {connectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {t('common.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Spreadsheet Modal (with Templates) */}
      {modal === 'create' && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal gs-modal-lg" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.createSheet')}</h3>

            {/* Template Picker */}
            <div className="gs-form-group">
              <label>{t('googleSheets.chooseTemplate')}</label>
              <div className="gs-template-grid">
                {TEMPLATES.map((tmpl) => {
                  const TIcon = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      className={`gs-template-card ${selectedTemplate === tmpl.id ? 'selected' : ''}`}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                    >
                      <div className="gs-template-icon" style={{ color: tmpl.color }}>
                        <TIcon size={22} />
                      </div>
                      <span className="gs-template-name">{t(`googleSheets.templates.${tmpl.id}`)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="gs-form-group">
              <label>{t('googleSheets.account')}</label>
              <select value={newSheetAccount} onChange={(e) => setNewSheetAccount(e.target.value)}>
                <option value="">{t('googleSheets.selectAccount')}</option>
                {accounts.map((a) => (
                  <option key={a.label} value={a.label}>{a.label} ({a.email})</option>
                ))}
              </select>
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.sheetTitle')}</label>
              <input type="text" value={newSheetTitle} onChange={(e) => setNewSheetTitle(e.target.value)} placeholder={t('googleSheets.sheetTitlePlaceholder')} />
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.headers')}</label>
              <input type="text" value={newSheetHeaders} onChange={(e) => setNewSheetHeaders(e.target.value)} placeholder={t('googleSheets.headersPlaceholder')} />
              <span className="gs-form-hint">{t('googleSheets.headersHint')}</span>
            </div>
            <div className="gs-modal-actions">
              <button className="btn-cancel" onClick={() => setModal(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleCreateSheet} disabled={!newSheetTitle.trim() || !newSheetAccount || createSheetMutation.isPending}>
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
              <input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder={t('googleSheets.shareEmailPlaceholder')} autoFocus />
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
              <button className="btn-cancel" onClick={() => setModal(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleShare} disabled={!shareEmail.trim() || shareMutation.isPending}>
                {shareMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                {t('googleSheets.share')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Sheet Editor ──────────────────────────── */}
      {modal === 'editor' && selectedSheet && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal gs-modal-editor" onClick={(e) => e.stopPropagation()}>
            <div className="gs-editor-header">
              <div className="gs-editor-title">
                <Edit3 size={18} />
                <h3>{selectedSheet.title}</h3>
                {editorDirty && <span className="gs-unsaved-badge">{t('googleSheets.unsaved')}</span>}
              </div>
              <div className="gs-editor-toolbar">
                <button className="btn-icon" title={t('common.refresh')} onClick={refreshEditor} disabled={editorLoading}>
                  <RefreshCw size={14} className={editorLoading ? 'animate-spin' : ''} />
                </button>
                <button className="btn-icon" title={t('googleSheets.addColumn')} onClick={addColumn}>
                  <Plus size={14} />
                </button>
                <button className="btn-primary btn-sm" onClick={addRow}>
                  <PlusCircle size={14} /> {t('googleSheets.addRow')}
                </button>
                <button className="btn-primary btn-sm" onClick={saveEditor} disabled={!editorDirty || editorSaving}>
                  {editorSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {t('common.save')}
                </button>
                <button className="btn-icon" onClick={() => setModal(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {editorLoading ? (
              <div className="gs-editor-loading">
                <Loader2 size={28} className="animate-spin" />
                <p>{t('common.loading')}</p>
              </div>
            ) : (
              <div className="gs-editor-table-wrap">
                <table className="gs-editor-table">
                  <thead>
                    <tr>
                      <th className="gs-row-num">#</th>
                      {(editorData[0] || ['']).map((_, colIdx) => (
                        <th key={colIdx}>
                          <div className="gs-col-header">
                            <span>{String.fromCharCode(65 + colIdx)}</span>
                            <button className="gs-col-delete" title={t('googleSheets.deleteColumn')} onClick={() => deleteColumn(colIdx)}>
                              <X size={10} />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editorData.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx === 0 ? 'gs-header-row' : ''}>
                        <td className="gs-row-num">
                          <div className="gs-row-num-inner">
                            <span>{rowIdx + 1}</span>
                            <button className="gs-row-delete" title={t('googleSheets.deleteRow')} onClick={() => deleteRow(rowIdx)}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                        {row.map((cell, colIdx) => (
                          <td
                            key={colIdx}
                            className={editingCell?.row === rowIdx && editingCell?.col === colIdx ? 'gs-cell-editing' : 'gs-cell'}
                            onClick={() => setEditingCell({ row: rowIdx, col: colIdx })}
                          >
                            {editingCell?.row === rowIdx && editingCell?.col === colIdx ? (
                              <input
                                className="gs-cell-input"
                                value={cell}
                                onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingCell(null);
                                  if (e.key === 'Tab') {
                                    e.preventDefault();
                                    setEditingCell({ row: rowIdx, col: colIdx + 1 < row.length ? colIdx + 1 : 0 });
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className="gs-cell-value">{cell}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send via WhatsApp Modal */}
      {modal === 'send' && selectedSheet && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal gs-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.sendTitle')}: {selectedSheet.title}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.sendSession')}</label>
              <select value={sendSession} onChange={(e) => { setSendSession(e.target.value); setSendChatId(''); setContactSearch(''); }}>
                {readySessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
                {readySessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.phone || s.id})</option>
                ))}
              </select>
            </div>
            {sendSession && (
              <div className="gs-form-group">
                <label>{t('googleSheets.sendContact')}</label>
                {sendChatId ? (
                  <div className="gs-selected-contact">
                    <div className="gs-selected-contact-info">
                      {contactList.find((c) => c.chatId === sendChatId)?.type === 'group' ? <Users size={14} /> : <User size={14} />}
                      <span className="gs-selected-name">{selectedContactName}</span>
                      <span className="gs-selected-id">{sendChatId}</span>
                    </div>
                    <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => { setSendChatId(''); setContactSearch(''); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="gs-contact-search">
                      <Search size={14} />
                      <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder={t('googleSheets.searchContacts')} autoFocus />
                    </div>
                    <div className="gs-contact-list">
                      {filteredContacts.length === 0 ? (
                        <div className="gs-contact-empty">{contactList.length === 0 ? t('googleSheets.noContacts') : t('googleSheets.noMatchingContacts')}</div>
                      ) : (
                        filteredContacts.map((c) => (
                          <div key={c.chatId} className="gs-contact-item" onClick={() => { setSendChatId(c.chatId); setContactSearch(''); }}>
                            <div className="gs-contact-icon">{c.type === 'group' ? <Users size={16} /> : <User size={16} />}</div>
                            <div className="gs-contact-details">
                              <span className="gs-contact-name">{c.name}</span>
                              <span className="gs-contact-id">{c.phone || c.chatId}</span>
                            </div>
                            <span className={`gs-contact-badge ${c.type}`}>{c.type === 'group' ? t('googleSheets.group') : t('googleSheets.personal')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
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
              <input type="text" value={sendCaption} onChange={(e) => setSendCaption(e.target.value)} placeholder={t('googleSheets.sendCaptionPlaceholder')} />
            </div>
            <div className="gs-modal-actions">
              <button className="btn-cancel" onClick={() => { setModal(null); setContactSearch(''); }}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleSend} disabled={!sendSession || !sendChatId.trim() || sendMutation.isPending}>
                {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('googleSheets.sendWhatsApp')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import by URL Modal */}
      {modal === 'import' && (
        <div className="gs-modal-overlay" onClick={() => setModal(null)}>
          <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('googleSheets.importByUrl')}</h3>
            <div className="gs-form-group">
              <label>{t('googleSheets.account')}</label>
              <select value={importAccount || (accounts.length > 0 ? accounts[0].label : '')} onChange={(e) => setImportAccount(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.label} value={a.label}>{a.label} ({a.email})</option>
                ))}
              </select>
            </div>
            <div className="gs-form-group">
              <label>{t('googleSheets.importUrlLabel')}</label>
              <input
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder={t('googleSheets.importUrlPlaceholder')}
                autoFocus
              />
              <span className="gs-form-hint">{t('googleSheets.importUrlHint')}</span>
            </div>
            <div className="gs-modal-actions">
              <button className="btn-cancel" onClick={() => setModal(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleImport} disabled={!importUrl.trim() || importMutation.isPending}>
                {importMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {t('googleSheets.importBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
