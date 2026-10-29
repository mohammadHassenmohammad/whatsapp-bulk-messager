import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Eye,
  Search,
  Sparkles,
  Check,
  Code2,
  Zap,
  Send,
  Users
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useQuickChat } from '../context/QuickChatContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { WhatsAppMessageEditor, renderWhatsAppFormattedText } from '../components/WhatsAppMessageEditor';

export const Templates = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { openQuickChat } = useQuickChat();
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Editor Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Promotional',
    description: '',
    body: '',
    header_type: 'none',
    header_media_url: '',
    buttons: [],
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real database customer for genuine preview
  const [sampleContext, setSampleContext] = useState({
    name: '',
    company: '',
    category: '',
    phone: '',
    isRealContact: false,
  });

  // Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' });
  const [draftingAi, setDraftingAi] = useState(false);

  const handleAiDraft = async () => {
    const topic = formData.description || formData.name || 'exclusive promotional update';
    setDraftingAi(true);
    try {
      const res = await api.draftAiTemplate({
        topic: topic,
        tone: formData.category === 'Promotional' ? 'enthusiastic' : 'professional',
        include_customer_name: true,
      });
      if (res?.template_text) {
        setFormData((prev) => ({ ...prev, body: res.template_text }));
        toast.success(`Draft generated via ${res.source === 'ollama' ? 'Local Ollama AI' : 'Smart Rule Engine'}`);
      }
    } catch (err) {
      toast.error('AI draft generation failed');
    } finally {
      setDraftingAi(false);
    }
  };


  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getTemplates(search);
      setTemplates(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load message templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [search]);

  useEffect(() => {
    const fetchRealCustomer = async () => {
      try {
        const res = await api.getCustomers({ page_size: 1 });
        if (res?.items && res.items.length > 0) {
          const first = res.items[0];
          setSampleContext({
            name: first.full_name,
            company: first.company || '',
            category: first.category_name || 'General',
            phone: first.formatted_phone || first.phone,
            isRealContact: true,
          });
        }
      } catch {
        // silent fallback if offline
      }
    };
    fetchRealCustomer();
  }, []);

  const openAddModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      category: 'Promotional',
      description: '',
      body: 'Get 10% off — Hi {name}!\n\nLast chance to save on hair and skin care. Offer ends in 7 days!',
      header_type: 'image',
      header_media_url: '',
      buttons: [
        { id: '1', type: 'quick_reply', text: 'ENQUIRE' },
        { id: '2', type: 'quick_reply', text: 'STOP' },
        { id: '3', type: 'url', text: 'Shop now', url: 'https://' }
      ],
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (tpl) => {
    setEditingTemplate(tpl);
    let parsedButtons = [];
    try {
      if (tpl.buttons_json) parsedButtons = JSON.parse(tpl.buttons_json);
    } catch {}

    setFormData({
      name: tpl.name,
      category: tpl.category || 'Follow-up',
      description: tpl.description || '',
      body: tpl.body,
      header_type: tpl.header_type || 'none',
      header_media_url: tpl.header_media_url || '',
      buttons: parsedButtons,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDuplicate = async (id) => {
    try {
      const copy = await api.duplicateTemplate(id);
      toast.success(`Duplicated as "${copy.name}"`);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to duplicate template');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.body.trim()) {
      setFormError('Template Name and Message Body are required.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      body: formData.body.trim(),
      description: formData.description?.trim() || null,
      category: formData.category?.trim() || null,
      header_type: formData.header_media_url ? 'image' : 'none',
      header_media_url: formData.header_media_url?.trim() || null,
      buttons_json: formData.buttons && formData.buttons.length > 0 ? JSON.stringify(formData.buttons) : null,
    };

    try {
      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, payload);
        toast.success(`Updated template "${formData.name}"`);
      } else {
        await api.createTemplate(payload);
        toast.success(`Created template "${formData.name}"`);
      }
      setModalOpen(false);
      loadTemplates();
    } catch (err) {
      setFormError(err.message || 'Save failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteTemplate(deleteDialog.id);
      toast.success('Template deleted');
      setDeleteDialog({ open: false, id: null, name: '' });
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const insertVariable = (varName) => {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + ` {${varName}}`,
    }));
  };

  const renderLivePreview = (text) => {
    if (!text) return '';
    return text
      .replace(/\{name\}/gi, sampleContext.name || '{name}')
      .replace(/\{company\}/gi, sampleContext.company || '{company}')
      .replace(/\{category\}/gi, sampleContext.category || '{category}')
      .replace(/\{phone\}/gi, sampleContext.phone || '{phone}');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Message Templates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Design reusable message templates with dynamic placeholders like &#123;name&#125; and &#123;company&#125;
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No message templates"
          description="Create your first message template with personalization variables."
          actionLabel="Create Template"
          onAction={openAddModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header Photo Thumbnail */}
                {tpl.header_media_url && (
                  <div className="mb-3 rounded-xl overflow-hidden max-h-32 bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                    <img
                      src={tpl.header_media_url}
                      alt={tpl.name}
                      className="w-full h-28 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {tpl.name}
                    </h3>
                    {tpl.category && (
                      <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        {tpl.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      title="Duplicate"
                      onClick={() => handleDuplicate(tpl.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => openEditModal(tpl)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => setDeleteDialog({ open: true, id: tpl.id, name: tpl.name })}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {tpl.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {tpl.description}
                  </p>
                )}

                {/* Message Preview Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-4 leading-relaxed mb-3">
                  {tpl.body}
                </div>

                {/* Interactive Buttons Preview Chips */}
                {tpl.buttons_json && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {(() => {
                      try {
                        const btns = JSON.parse(tpl.buttons_json);
                        return btns.map((b, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                          >
                            {b.text}
                          </span>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                {/* Variables list */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Variables:</span>
                  {tpl.variables && tpl.variables.length > 0 ? (
                    tpl.variables.map((v) => (
                      <span
                        key={v}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-medium"
                      >
                        &#123;{v}&#125;
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">None</span>
                  )}
                </div>

                {/* Send Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      let parsedBtns = [];
                      try {
                        if (tpl.buttons_json) parsedBtns = JSON.parse(tpl.buttons_json);
                      } catch {}
                      openQuickChat({
                        message: tpl.body,
                        mediaUrl: tpl.header_media_url || '',
                        buttons: parsedBtns,
                      });
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/60"
                    title="Send to an individual contact or customer"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Quick Send</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/campaigns/new?template_id=${tpl.id}`)}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
                    title="Launch a bulk broadcast campaign using this template"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Bulk Send</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor & Live Preview Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? 'Edit Message Template' : 'Create Message Template'}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Follow Up Inquiry"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category / Intent
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
              >
                <option value="Follow-up">Follow-up</option>
                <option value="Promotional">Promotional</option>
                <option value="Transactional">Transactional / Update</option>
                <option value="Announcement">Announcement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="When to use this message..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                Message Template & Live WhatsApp Preview *
              </label>
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={draftingAi}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg border border-indigo-200 dark:border-indigo-800 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>{draftingAi ? 'Drafting...' : 'AI Auto-Draft'}</span>
              </button>
            </div>
            <WhatsAppMessageEditor
              value={formData.body}
              onChange={(val) => setFormData({ ...formData, body: val })}
              headerMediaUrl={formData.header_media_url}
              onMediaChange={(url) => setFormData({ ...formData, header_media_url: url, header_type: url ? 'image' : 'none' })}
              buttons={formData.buttons || []}
              onButtonsChange={(btns) => setFormData({ ...formData, buttons: btns })}
              sampleContext={sampleContext}
              recipientName={sampleContext.name || ''}
              rows={5}
              showPreview={true}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold"
            >
              {isSubmitting ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        message={`Are you sure you want to delete template "${deleteDialog.name}"?`}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
