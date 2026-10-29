import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertTriangle,
  FolderPlus,
  ArrowRight,
  UserPlus
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ManageCategoryMembersModal } from '../components/ManageCategoryMembersModal';

export const Categories = () => {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Category Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#10b981',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage Category Members Modal
  const [manageMembersCategory, setManageMembersCategory] = useState(null);

  // Delete Category Dialog
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    category: null,
    reassignToId: '',
    forceUncategorize: false,
  });

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', color: '#10b981' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      color: cat.color || '#10b981',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, formData);
        toast.success(`Updated category "${formData.name}"`);
      } else {
        await api.createCategory(formData);
        toast.success(`Created category "${formData.name}"`);
      }
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      setFormError(err.message || 'Save failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrompt = (cat) => {
    setDeleteDialog({
      open: true,
      category: cat,
      reassignToId: '',
      forceUncategorize: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { category, reassignToId, forceUncategorize } = deleteDialog;
    if (!category) return;

    try {
      const params = {};
      if (reassignToId) {
        params.reassign_to_category_id = reassignToId;
      } else if (forceUncategorize || category.customer_count === 0) {
        params.force_uncategorize = 'true';
      }

      await api.deleteCategory(category.id, params);
      toast.success(`Deleted category "${category.name}"`);
      setDeleteDialog({ open: false, category: null, reassignToId: '', forceUncategorize: false });
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const PRESET_COLORS = [
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#64748b', // Slate
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer Categories
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Segment your contacts for targeted WhatsApp campaigns and bulk management
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* Categories Cards Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories defined"
          description="Create categories to organize your contacts into meaningful target audiences."
          actionLabel="Create Category"
          onAction={openAddModal}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color || '#10b981' }}
                    ></span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {cat.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(cat)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-8 mb-4">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cat.customer_count || 0} customers</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManageMembersCategory(cat)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-lg transition-colors shadow-2xs"
                    title="Add or remove contacts in this category"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Members</span>
                  </button>

                  <Link
                    to={`/customers?category_id=${cat.id}`}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <span>View ({cat.customer_count || 0})</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Category'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. VIP Customers, Leads, Colleges"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Who belongs to this category..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden resize-none"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">
              Color Accent
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: col })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    formData.color === col
                      ? 'border-slate-900 dark:border-white scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
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
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold"
            >
              {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Category with Safety Reassignment */}
      <Modal
        isOpen={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, category: null, reassignToId: '', forceUncategorize: false })
        }
        title="Delete Category"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold block">
                Category "{deleteDialog.category?.name}" contains {deleteDialog.category?.customer_count || 0} customer(s).
              </span>
              <span>
                To prevent accidental loss of organization, choose where to move these contacts before deleting.
              </span>
            </div>
          </div>

          {deleteDialog.category?.customer_count > 0 && (
            <div className="space-y-3">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Reassign existing customers to:
                </label>
                <select
                  value={deleteDialog.reassignToId}
                  onChange={(e) =>
                    setDeleteDialog({
                      ...deleteDialog,
                      reassignToId: e.target.value,
                      forceUncategorize: false,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose destination category --</option>
                  {categories
                    .filter((c) => c.id !== deleteDialog.category?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteDialog.forceUncategorize}
                    onChange={(e) =>
                      setDeleteDialog({
                        ...deleteDialog,
                        forceUncategorize: e.target.checked,
                        reassignToId: '',
                      })
                    }
                    className="rounded text-rose-600"
                  />
                  <span className="text-slate-600 dark:text-slate-400">
                    Or leave contacts as <strong>Uncategorized</strong>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              onClick={() =>
                setDeleteDialog({ open: false, category: null, reassignToId: '', forceUncategorize: false })
              }
              className="px-4 py-2 border rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={
                deleteDialog.category?.customer_count > 0 &&
                !deleteDialog.reassignToId &&
                !deleteDialog.forceUncategorize
              }
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold disabled:opacity-50"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Category Members Modal */}
      <ManageCategoryMembersModal
        isOpen={!!manageMembersCategory}
        category={manageMembersCategory}
        onClose={() => setManageMembersCategory(null)}
        onUpdated={loadCategories}
      />
    </div>
  );
};
