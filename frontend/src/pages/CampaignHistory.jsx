import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Send,
  Plus,
  ArrowRight,
  Search,
  Download,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { CampaignStatusBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const CampaignHistory = () => {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' });

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const data = await api.getCampaigns(params);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, search]);

  const handleDeleteConfirm = async () => {
    try {
      await api.deleteCampaign(deleteDialog.id);
      toast.success('Campaign history deleted');
      setDeleteDialog({ open: false, id: null, name: '' });
      loadCampaigns();
    } catch (err) {
      toast.error(err.message || 'Failed to delete campaign');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Campaign History & Logs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Durable records of all past and in-progress manual WhatsApp outreach campaigns
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/templates"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-xs"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Message Templates</span>
          </Link>

          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Total: <strong className="text-slate-800 dark:text-slate-200">{campaigns.length}</strong> campaigns
        </span>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={History}
            title="No campaign history"
            description="Create your first campaign to build an outreach history log."
            actionLabel="Create Campaign"
            onAction={() => window.location.href = '#/campaigns/new'}
            className="border-none py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Campaign Name</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4">Recipients</th>
                  <th className="py-3.5 px-4">Dispatched</th>
                  <th className="py-3.5 px-4">Delivered (✓✓)</th>
                  <th className="py-3.5 px-4">Skipped</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {campaigns.map((cmp) => (
                  <tr
                    key={cmp.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <Link
                        to={`/campaigns/${cmp.id}`}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        {cmp.name}
                      </Link>
                      {cmp.description && (
                        <span className="block font-normal text-[11px] text-slate-400">
                          {cmp.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(cmp.created_at).toLocaleDateString()} {new Date(cmp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      {cmp.total_recipients}
                    </td>
                    <td className="py-3.5 px-4 text-indigo-600 dark:text-indigo-400 font-bold">
                      {cmp.sent_count}
                    </td>
                    <td className="py-3.5 px-4 text-teal-600 dark:text-teal-400 font-medium">
                      {cmp.delivered_count || 0}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {cmp.skipped_count}
                    </td>
                    <td className="py-3.5 px-4">
                      <CampaignStatusBadge status={cmp.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cmp.status === 'in_progress' && (
                          <Link
                            to={`/campaigns/${cmp.id}/queue`}
                            title="Resume Sending Queue"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Resume</span>
                          </Link>
                        )}
                        <Link
                          to={`/campaigns/${cmp.id}`}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        >
                          Report
                        </Link>
                        <a
                          href={api.exportCampaignCsvUrl(cmp.id)}
                          download
                          title="Export CSV Report"
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          title="Delete Campaign"
                          onClick={() => setDeleteDialog({ open: true, id: cmp.id, name: cmp.name })}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Campaign Record"
        message={`Delete campaign "${deleteDialog.name}" and its associated recipient logs?`}
        confirmLabel="Delete"
        isDestructive={true}
      />
    </div>
  );
};
