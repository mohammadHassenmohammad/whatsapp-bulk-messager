import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  FolderPlus,
  Shield,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  Send,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useQuickChat } from '../context/QuickChatContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConsentBadge, Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer';
import { ManageCategoryMembersModal } from '../components/ManageCategoryMembersModal';

export const Customers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { openQuickChat } = useQuickChat();

  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category_id') || '');
  const [selectedConsent, setSelectedConsent] = useState(searchParams.get('consent_status') || '');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    category_id: '',
    company: '',
    tags: '',
    consent_status: 'unverified',
    consent_source: 'Manual Entry',
    notes: '',
    default_country_code: '1',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete & Bulk Dialogs
  const [deleteDialog, setDeleteDialog] = useState({ open: false, customerId: null, name: '' });
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkCategoryModal, setBulkCategoryModal] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkConsentModal, setBulkConsentModal] = useState(false);
  const [bulkConsentStatus, setBulkConsentStatus] = useState('verified');

  // Customer Detail Drawer
  const [drawerCustomer, setDrawerCustomer] = useState(null);

  // Manage Category Members Modal
  const [categoryMembersModal, setCategoryMembersModal] = useState(null);

  const activeCategory = categories.find((c) => String(c.id) === String(selectedCategory));

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        search: search.trim(),
        category_id: selectedCategory || undefined,
        consent_status: selectedConsent || undefined,
        tag: tagFilter.trim() || undefined,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      const res = await api.getCustomers(params);
      setCustomers(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedConsent, tagFilter, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Handle URL params change (sync search, category_id, consent_status)
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== search) {
      setSearch(q);
    }
    const cat = searchParams.get('category_id');
    if (cat !== null && cat !== selectedCategory) {
      setSelectedCategory(cat);
      setPage(1);
    }
    const con = searchParams.get('consent_status');
    if (con !== null && con !== selectedConsent) {
      setSelectedConsent(con);
      setPage(1);
    }
  }, [searchParams]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchParams(search ? { search } : {});
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      category_id: selectedCategory && selectedCategory !== '0' ? parseInt(selectedCategory) : '',
      company: '',
      tags: '',
      consent_status: 'unverified',
      consent_source: 'Manual Entry',
      notes: '',
      default_country_code: '1',
    });
    setFormError('');
    setCustomerModalOpen(true);
  };

  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    setFormData({
      full_name: cust.full_name,
      phone: cust.formatted_phone || cust.phone,
      email: cust.email || '',
      category_id: cust.category_id || '',
      company: cust.company || '',
      tags: cust.tags || '',
      consent_status: cust.consent_status,
      consent_source: cust.consent_source || '',
      notes: cust.notes || '',
      default_country_code: '1',
    });
    setFormError('');
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
        toast.success(`Updated customer "${formData.full_name}"`);
      } else {
        await api.createCustomer(payload);
        toast.success(`Added customer "${formData.full_name}"`);
      }
      setCustomerModalOpen(false);
      loadCustomers();
      loadCategories(); // refresh customer counts
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteCustomer(deleteDialog.customerId);
      toast.success('Customer deleted');
      setDeleteDialog({ open: false, customerId: null, name: '' });
      setSelectedIds((prev) => prev.filter((id) => id !== deleteDialog.customerId));
      loadCustomers();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await api.bulkDelete(selectedIds);
      toast.success(`Deleted ${res.deleted_count} customers`);
      setBulkDeleteDialog(false);
      setSelectedIds([]);
      loadCustomers();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Bulk delete failed');
    }
  };

  const handleBulkCategorize = async () => {
    try {
      const catId = bulkCategoryId ? parseInt(bulkCategoryId) : null;
      await api.bulkCategorize(selectedIds, catId);
      toast.success(`Assigned category to ${selectedIds.length} contacts`);
      setBulkCategoryModal(false);
      setSelectedIds([]);
      loadCustomers();
      loadCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to update category');
    }
  };

  const handleBulkConsent = async () => {
    try {
      await api.bulkConsent(selectedIds, bulkConsentStatus);
      toast.success(`Updated consent status for ${selectedIds.length} contacts`);
      setBulkConsentModal(false);
      setSelectedIds([]);
      loadCustomers();
    } catch (err) {
      toast.error(err.message || 'Failed to update consent');
    }
  };

  const handleOpenDirectWhatsApp = (cust) => {
    openQuickChat({ customer: cust });
  };

  const handleLeadStageChange = async (customerId, newStage) => {
    try {
      await api.updateCustomerLeadStage(customerId, newStage);
      toast.success(`Lead stage updated to ${newStage}`);
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, lead_stage: newStage } : c))
      );
    } catch (err) {
      toast.error('Failed to update lead stage');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage contacts, verify consent, and organize marketing audience segments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={api.exportCustomersCsvUrl(selectedCategory, selectedConsent)}
            download="customers_export.csv"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>

          <Link
            to="/categories"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-xs"
          >
            <FolderPlus className="w-4 h-4 text-indigo-500" />
            <span>Categories</span>
          </Link>

          <Link
            to="/customers/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-xs"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Contacts</span>
          </Link>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </form>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
          >
            <option value="">All Categories</option>
            <option value="0">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customer_count || 0})
              </option>
            ))}
          </select>

          {/* Consent Status Filter */}
          <select
            value={selectedConsent}
            onChange={(e) => {
              setSelectedConsent(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
          >
            <option value="">All Consent States</option>
            <option value="verified">Verified Consent</option>
            <option value="unverified">Unverified</option>
            <option value="opted_out">Opted Out (Suppressed)</option>
          </select>

          {/* Tag Filter */}
          <input
            type="text"
            placeholder="Filter by tag (e.g. VIP)..."
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-hidden"
          />
        </div>

        {/* Active Category Filter Banner */}
        {activeCategory && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeCategory.color || '#10b981' }}
              ></span>
              <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                Viewing Category: {activeCategory.name} ({total} contact{total === 1 ? '' : 's'})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoryMembersModal(activeCategory)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add / Manage Category Members</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  setSearchParams({});
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline px-1"
              >
                Clear Filter
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Bar (when rows are selected) */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {selectedIds.length} customer{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/campaigns/new?customer_ids=${selectedIds.join(',')}`)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Launch Campaign ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => setBulkCategoryModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Assign Category</span>
              </button>
              <button
                onClick={() => setBulkConsentModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Update Consent</span>
              </button>
              <button
                onClick={() => setBulkDeleteDialog(true)}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Customers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs text-slate-400">Loading customer records...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            {activeCategory ? (
              <div className="max-w-md space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  No members in "{activeCategory.name}" yet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This category currently has 0 members. You can select existing contacts from your directory to add to this category, or create a new customer.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCategoryMembersModal(activeCategory)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add Existing Contacts to "{activeCategory.name}"</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl"
                  >
                    Create New Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('');
                      setSearchParams({});
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                  >
                    Show All Contacts
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No customers match your criteria"
                description="Try adjusting your search terms or filters, or add your first customer."
                actionLabel="Add Customer"
                onAction={openAddModal}
                className="border-none py-8"
              />
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                      {selectedIds.length === customers.length && customers.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">WhatsApp Phone</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Lead Stage</th>
                  <th className="py-3.5 px-4">Consent Status</th>
                  <th className="py-3.5 px-4">Tags</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => toggleSelectOne(c.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setDrawerCustomer(c)}
                          className="text-left font-semibold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors block"
                          title="View customer profile details"
                        >
                          {c.full_name}
                        </button>
                        {c.email && (
                          <span className="block font-normal text-[11px] text-slate-400">
                            {c.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {c.formatted_phone}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.category_name ? (
                          <Badge variant="brand">{c.category_name}</Badge>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {c.company || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={c.lead_stage || 'New'}
                          onChange={(e) => handleLeadStageChange(c.id, e.target.value)}
                          className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Interested">Interested</option>
                          <option value="Converted">Converted</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        <ConsentBadge status={c.consent_status} />
                      </td>
                      <td className="py-3.5 px-4">
                        {c.tags ? (
                          <div className="flex flex-wrap gap-1">
                            {c.tags.split(',').map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-medium"
                              >
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct WhatsApp Quick Chat shortcut */}
                          <button
                            title="Send WhatsApp Message"
                            onClick={() => openQuickChat({ customer: c })}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            title="Edit Customer"
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete Customer"
                            onClick={() =>
                              setDeleteDialog({ open: true, customerId: c.id, name: c.full_name })
                            }
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="font-semibold">{total}</span> customers
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="e.g. Alex Morgan"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp Phone *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. +1 555 123 4567"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Include country code (e.g. +1 for US, +91 for India)
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="alex@company.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name (Optional)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Messaging Consent Status
              </label>
              <select
                value={formData.consent_status}
                onChange={(e) => setFormData({ ...formData, consent_status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="verified">Verified (Customer requested updates)</option>
                <option value="unverified">Unverified (Pending confirmation)</option>
                <option value="opted_out">Opted Out (Do not message)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g. VIP, Wholesale, Lead"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Internal Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Context or notes about this client..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCustomerModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, customerId: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={`Are you sure you want to permanently delete "${deleteDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive={true}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteDialog}
        onClose={() => setBulkDeleteDialog(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Customers"
        message={`Are you sure you want to delete ${selectedIds.length} selected customers from your database?`}
        confirmLabel="Delete Selected"
        isDestructive={true}
      />

      {/* Bulk Categorize Modal */}
      <Modal
        isOpen={bulkCategoryModal}
        onClose={() => setBulkCategoryModal(false)}
        title="Assign Category in Bulk"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Assign {selectedIds.length} selected customers to a category:
          </p>
          <select
            value={bulkCategoryId}
            onChange={(e) => setBulkCategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="">Uncategorize (Remove category)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setBulkCategoryModal(false)}
              className="px-3 py-1.5 border rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkCategorize}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-semibold"
            >
              Update Category
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Consent Modal */}
      <Modal
        isOpen={bulkConsentModal}
        onClose={() => setBulkConsentModal(false)}
        title="Update Consent in Bulk"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Update messaging consent status for {selectedIds.length} contacts:
          </p>
          <select
            value={bulkConsentStatus}
            onChange={(e) => setBulkConsentStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="verified">Verified (Customer requested messages)</option>
            <option value="unverified">Unverified (Pending confirmation)</option>
            <option value="opted_out">Opted Out (Add to suppression list)</option>
          </select>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setBulkConsentModal(false)}
              className="px-3 py-1.5 border rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkConsent}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-semibold"
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      {/* Customer Profile Slide-over Drawer */}
      <CustomerDetailDrawer
        isOpen={!!drawerCustomer}
        customer={drawerCustomer}
        onClose={() => setDrawerCustomer(null)}
        onEdit={(cust) => openEditModal(cust)}
        onDelete={(cust) =>
          setDeleteDialog({ open: true, customerId: cust.id, name: cust.full_name })
        }
        onOpenQuickChat={(cust) => openQuickChat({ customer: cust })}
        onStageUpdated={(id, stage) => {
          setCustomers((prev) =>
            prev.map((c) => (c.id === id ? { ...c, lead_stage: stage } : c))
          );
        }}
      />

      {/* Manage Category Members Modal */}
      <ManageCategoryMembersModal
        isOpen={!!categoryMembersModal}
        category={categoryMembersModal}
        onClose={() => setCategoryMembersModal(null)}
        onUpdated={() => {
          loadCustomers();
          loadCategories();
        }}
      />
    </div>
  );
};
