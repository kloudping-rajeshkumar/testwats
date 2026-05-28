import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutTemplate,
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  Send,
  Loader2,
  BarChart3,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  useTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} from '../hooks/queries';
import { templateApi, type MessageTemplate } from '../services/api';
import './Templates.css';

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'greeting', 'reminder', 'promotion', 'follow-up', 'custom'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  greeting: 'Greeting',
  reminder: 'Reminder',
  promotion: 'Promotion',
  'follow-up': 'Follow-up',
  custom: 'Custom',
};

function getCategoryBadgeClass(category: string | null): string {
  if (!category) return 'custom';
  const lower = category.toLowerCase();
  if (['greeting', 'reminder', 'promotion', 'follow-up', 'custom'].includes(lower)) return lower;
  return 'custom';
}

const PLACEHOLDER_MAP: Record<string, string> = {
  '{{name}}': 'John',
  '{{phone}}': '+91 93423 18857',
  '{{date}}': new Date().toLocaleDateString(),
};

function renderPreview(body: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\{\{(name|phone|date)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="placeholder-value">
        {PLACEHOLDER_MAP[match[0]] || match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }
  return parts;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Component ──────────────────────────────────────────────────────────

type PanelMode = 'empty' | 'view' | 'create' | 'edit';

export function Templates() {
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('greeting');
  const [formBody, setFormBody] = useState('');
  const [formLanguage, setFormLanguage] = useState('en');
  const [formError, setFormError] = useState('');

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const queryCategory = selectedCategory === 'all' ? undefined : selectedCategory;
  const templatesQuery = useTemplatesQuery(queryCategory);
  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();

  const templates = templatesQuery.data || [];

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  const selectedTemplate = useMemo(() => {
    if (!selectedId) return null;
    return templates.find(t => t.id === selectedId) || null;
  }, [templates, selectedId]);

  // ── Handlers ───────────────────────────────────────────────────────

  function openCreate() {
    setSelectedId(null);
    setFormName('');
    setFormCategory('greeting');
    setFormBody('');
    setFormLanguage('en');
    setFormError('');
    setPanelMode('create');
  }

  function openEdit(template: MessageTemplate) {
    setSelectedId(template.id);
    setFormName(template.name);
    setFormCategory(template.category || 'custom');
    setFormBody(template.body);
    setFormLanguage(template.language || 'en');
    setFormError('');
    setPanelMode('edit');
  }

  function openView(template: MessageTemplate) {
    setSelectedId(template.id);
    setPanelMode('view');
  }

  async function handleSave() {
    setFormError('');
    if (!formName.trim()) {
      setFormError('Template name is required');
      return;
    }
    if (!formBody.trim()) {
      setFormError('Template body is required');
      return;
    }

    try {
      if (panelMode === 'create') {
        const created = await createMutation.mutateAsync({
          name: formName.trim(),
          category: formCategory,
          body: formBody.trim(),
          language: formLanguage,
        });
        setSelectedId(created.id);
        setPanelMode('view');
      } else if (panelMode === 'edit' && selectedId) {
        await updateMutation.mutateAsync({
          id: selectedId,
          data: {
            name: formName.trim(),
            category: formCategory,
            body: formBody.trim(),
            language: formLanguage,
          },
        });
        setPanelMode('view');
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save template');
    }
  }

  function handleDeleteClick(id: string) {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId) return;
    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      if (selectedId === deleteTargetId) {
        setSelectedId(null);
        setPanelMode('empty');
      }
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    } catch {
      // ignore
    }
  }

  function handleUseInSchedule(template: MessageTemplate) {
    // Increment usage count in background
    void templateApi.use(template.id);
    navigate('/scheduled', { state: { templateBody: template.body } });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="templates-page">
      <div className="page-header">
        <div className="page-header-left">
          <LayoutTemplate size={28} />
          <div>
            <h1>Message Templates</h1>
            <p>Create and manage reusable message templates with placeholders</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          New Template
        </button>
      </div>

      <div className="templates-layout">
        {/* ── Left Panel ──────────────────────────── */}
        <div className="templates-list-panel">
          <div className="templates-list-header">
            <div className="templates-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="templates-category-tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="templates-card-list">
            {templatesQuery.isLoading ? (
              <div className="templates-empty-state">
                <Loader2 size={28} className="animate-spin" />
                <p>Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="templates-empty-state">
                <FileText size={40} />
                <p>No templates found</p>
                <button className="btn-primary" onClick={openCreate}>
                  <Plus size={14} />
                  Create your first template
                </button>
              </div>
            ) : (
              filteredTemplates.map(t => (
                <div
                  key={t.id}
                  className={`template-card ${selectedId === t.id ? 'selected' : ''}`}
                  onClick={() => openView(t)}
                >
                  <div className="tc-header">
                    <span className="tc-name">{t.name}</span>
                    <span className={`tc-badge ${getCategoryBadgeClass(t.category)}`}>
                      {t.category || 'custom'}
                    </span>
                  </div>
                  <div className="tc-preview">{t.body}</div>
                  <div className="tc-meta">
                    <span className="tc-meta-item">
                      <BarChart3 size={11} />
                      {t.usageCount} uses
                    </span>
                    <span className="tc-meta-item">
                      <Calendar size={11} />
                      {formatDate(t.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel ─────────────────────────── */}
        <div className="templates-detail-panel">
          {panelMode === 'empty' && (
            <div className="template-detail-empty">
              <LayoutTemplate size={48} />
              <p>Select a template to view or edit, or create a new one</p>
            </div>
          )}

          {panelMode === 'view' && selectedTemplate && (
            <div className="template-view">
              <div className="te-header">
                <span className="te-header-title">{selectedTemplate.name}</span>
                <div className="te-header-actions">
                  <button className="btn-ghost" onClick={() => openEdit(selectedTemplate)} title="Edit">
                    <Edit3 size={15} />
                  </button>
                  <button
                    className="btn-ghost danger"
                    onClick={() => handleDeleteClick(selectedTemplate.id)}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="tv-body">
                <div className="tv-info-grid">
                  <div className="tv-info-item">
                    <span className="tv-info-label">Category</span>
                    <span className="tv-info-value">
                      <span className={`tc-badge ${getCategoryBadgeClass(selectedTemplate.category)}`}>
                        {selectedTemplate.category || 'custom'}
                      </span>
                    </span>
                  </div>
                  <div className="tv-info-item">
                    <span className="tv-info-label">Language</span>
                    <span className="tv-info-value">{selectedTemplate.language || 'en'}</span>
                  </div>
                  <div className="tv-info-item">
                    <span className="tv-info-label">Usage Count</span>
                    <span className="tv-info-value">{selectedTemplate.usageCount}</span>
                  </div>
                  <div className="tv-info-item">
                    <span className="tv-info-label">Created</span>
                    <span className="tv-info-value">{formatDate(selectedTemplate.createdAt)}</span>
                  </div>
                </div>

                <div className="tv-message-box">
                  <div className="tv-message-label">Template Body</div>
                  <div className="tv-message-body">{selectedTemplate.body}</div>
                </div>

                <div className="te-preview-section">
                  <div className="te-preview-header">
                    <Eye size={13} />
                    Preview
                  </div>
                  <div className="te-preview-body">{renderPreview(selectedTemplate.body)}</div>
                </div>
              </div>
              <div className="te-footer">
                <button
                  className="btn-outline-primary"
                  onClick={() => handleUseInSchedule(selectedTemplate)}
                >
                  <Send size={14} />
                  Use in Schedule
                </button>
              </div>
            </div>
          )}

          {(panelMode === 'create' || panelMode === 'edit') && (
            <div className="template-editor">
              <div className="te-header">
                <span className="te-header-title">
                  {panelMode === 'create' ? 'New Template' : 'Edit Template'}
                </span>
              </div>
              <div className="te-body">
                <div className="te-form-row">
                  <div className="te-form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Welcome Message"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="te-form-group">
                    <label>Category</label>
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                      <option value="greeting">Greeting</option>
                      <option value="reminder">Reminder</option>
                      <option value="promotion">Promotion</option>
                      <option value="follow-up">Follow-up</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="te-form-group">
                  <label>Message Body</label>
                  <textarea
                    placeholder="Type your message template here..."
                    value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    rows={6}
                  />
                  <span className="te-placeholder-hint">
                    Placeholders: <code>{'{{name}}'}</code> for contact name,{' '}
                    <code>{'{{phone}}'}</code> for phone number,{' '}
                    <code>{'{{date}}'}</code> for current date
                  </span>
                </div>

                <div className="te-form-row">
                  <div className="te-form-group">
                    <label>Language</label>
                    <select value={formLanguage} onChange={e => setFormLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="he">Hebrew</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                      <option value="ar">Arabic</option>
                      <option value="hi">Hindi</option>
                    </select>
                  </div>
                </div>

                {formBody.trim() && (
                  <div className="te-preview-section">
                    <div className="te-preview-header">
                      <Eye size={13} />
                      Preview
                    </div>
                    <div className="te-preview-body">{renderPreview(formBody)}</div>
                  </div>
                )}

                {formError && (
                  <div className="form-error">
                    {formError}
                  </div>
                )}
              </div>
              <div className="te-footer">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (selectedId && panelMode === 'edit') {
                      setPanelMode('view');
                    } else {
                      setPanelMode('empty');
                      setSelectedId(null);
                    }
                  }}
                >
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : panelMode === 'create' ? (
                    <>
                      <Plus size={14} /> Create Template
                    </>
                  ) : (
                    <>
                      <Edit3 size={14} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm-box" onClick={e => e.stopPropagation()}>
            <h3>Delete Template</h3>
            <p>Are you sure you want to delete this template? This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Templates;
