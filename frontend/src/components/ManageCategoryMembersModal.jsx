import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckSquare,
  Square,
  UserCheck,
  UserPlus,
  AlertCircle,
  FolderTree
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Modal } from './Modal';

export const ManageCategoryMembersModal = ({
  isOpen,
  onClose,
  category,
  onUpdated,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [initialCategoryIds, setInitialCategoryIds] = useState([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && category) {
      loadAllCustomers();
    }
  }, [isOpen, category]);

  const loadAllCustomers = async () => {
    try {
      setLoading(true);
      // Fetch all customers for membership selection
      const res = await api.getCustomers({ page_size: 200 });
      const items = res.items || [];
      setAllCustomers(items);

      // Pre-select customers already in this category
      const currentMemberIds = items
        .filter((c) => c.category_id === category.id)
        .map((c) => c.id);

      setSelectedIds(currentMemberIds);
      setInitialCategoryIds(currentMemberIds);
    } catch (err) {
      toast.error(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = allCustomers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.formatted_phone?.includes(q) ||
      c.company?.toLowerCase().includes(q)
    );
  });

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredCustomers.map((c) => c.id);
    const allFilteredSelected = filteredIds.every((id) => selectedIds.includes(id));

    if (allFilteredSelected) {
      // Unselect all currently filtered
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Add all currently filtered
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSave = async () => {
    if (!category) return;
    setIsSaving(true);
    try {
      // 1. Members to add or keep in this category
      if (selectedIds.length > 0) {
        await api.bulkCategorize(selectedIds, category.id);
      }

      // 2. Members who were previously in this category but got unselected -> uncategorize them
      const removedIds = initialCategoryIds.filter((id) => !selectedIds.includes(id));
      if (removedIds.length > 0) {
        await api.bulkCategorize(removedIds, null);
      }

      toast.success(
        `Updated category "${category.name}" (${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'})`
      );
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update category members');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !category) return null;

  const isAllFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.includes(c.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add / Manage Members in "${category.name}"`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Header summary banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: category.color || '#10b981' }}
            ></span>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100 block">
                {category.name}
              </span>
              <p className="text-[11px] text-slate-400">
                Select contacts from your directory to include in this audience segment
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
            {selectedIds.length} selected
          </span>
        </div>

        {/* Search & Bulk Select Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            disabled={filteredCustomers.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-xs disabled:opacity-50"
          >
            {isAllFilteredSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>{isAllFilteredSelected ? 'Deselect Filtered' : 'Select All Filtered'}</span>
          </button>
        </div>

        {/* Contacts Roster */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-slate-400 text-[11px]">Loading directory contacts...</p>
          </div>
        ) : allCustomers.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No contacts in directory</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Add or import customer contacts first to assign them to categories.
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            No contacts match "{search}"
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCustomers.map((c) => {
              const isChecked = selectedIds.includes(c.id);
              const isCurrentlyInThis = c.category_id === category.id;

              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelectOne(c.id)}
                  className={`p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                    isChecked ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(c.id);
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {c.full_name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{c.formatted_phone || c.phone}</span>
                        {c.company && (
                          <>
                            <span>•</span>
                            <span>{c.company}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {c.category_name ? (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          isCurrentlyInThis
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isCurrentlyInThis ? 'In this category' : `In: ${c.category_name}`}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
                        Uncategorized
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-400 text-[11px]">
            {selectedIds.length} contact{selectedIds.length === 1 ? '' : 's'} assigned to {category.name}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || allCustomers.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : `Save Members (${selectedIds.length})`}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
