import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Play,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Eye,
  Activity,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { CampaignStatusBadge, RecipientStatusBadge } from '../components/Badge';
import { Modal } from '../components/Modal';

export const CampaignDetail = () => {
  const { id } = useParams();
  const toast = useToast();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('');

  // View individual recipient message modal
  const [viewMessageModal, setViewMessageModal] = useState({
    open: false,
    recipient: null,
  });

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaign(id);
      setCampaign(data);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaign();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center text-xs">
        <p className="text-slate-500">Campaign not found.</p>
        <Link to="/campaigns/history" className="text-emerald-600 font-semibold mt-2 inline-block">
          Return to History
        </Link>
      </div>
    );
  }

  const filteredRecipients = (campaign.recipients || []).filter((r) => {
    const matchesSearch =
      r.recipient_name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      r.recipient_phone.includes(recipientSearch) ||
      (r.recipient_company && r.recipient_company.toLowerCase().includes(recipientSearch.toLowerCase()));

    const matchesStatus = !recipientStatusFilter || r.status === recipientStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/campaigns/history"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {campaign.name}
              </h2>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-slate-500">
              Created on {new Date(campaign.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={api.exportCampaignCsvUrl(campaign.id)}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border rounded-xl shadow-xs hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </a>

          {(campaign.status === 'in_progress' || campaign.sent_count + campaign.skipped_count < campaign.total_recipients) && (
            <Link
              to={`/campaigns/${campaign.id}/queue`}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Sending Queue</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Total Recipients</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">
            {campaign.total_recipients}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Dispatched</span>
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {campaign.sent_count}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Delivered (✓✓)</span>
          <span className="text-xl font-bold text-teal-600 dark:text-teal-400">
            {campaign.delivered_count || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Read (Blue Tick)</span>
          <span className="text-xl font-bold text-amber-500">
            {campaign.read_count || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Replies / Leads</span>
          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {campaign.replied_count || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-slate-400 block mb-1">Delivery Rate</span>
          <span className="text-xl font-bold text-emerald-600">
            {campaign.sent_count > 0
              ? `${Math.round(((campaign.delivered_count || campaign.sent_count) / campaign.sent_count) * 100)}%`
              : '0%'}
          </span>
        </div>
      </div>

      {/* Message Snapshot Accordion */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
          Original Message Template Snapshot:
        </h3>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border overflow-hidden">
          {campaign.header_media_url && (
            <div className="w-full max-h-48 bg-black/10 overflow-hidden flex items-center justify-center border-b border-slate-200 dark:border-slate-700/60">
              <img
                src={campaign.header_media_url}
                alt="Campaign Header"
                className="max-h-48 w-auto object-cover"
              />
            </div>
          )}
          <div className="p-3.5 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {campaign.message_body_snapshot}
          </div>
          {campaign.buttons_json && (
            <div className="border-t border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 bg-slate-100/60 dark:bg-slate-900/40">
              {(() => {
                try {
                  const parsed = JSON.parse(campaign.buttons_json);
                  return parsed.map((btn, idx) => (
                    <div
                      key={idx}
                      className="py-1.5 px-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      {btn.action === 'stop'
                        ? `🛑 ${btn.text} (Auto Opt-Out)`
                        : btn.action === 'enquire'
                        ? `🔥 ${btn.text} (Capture Lead)`
                        : `↗ ${btn.text} (URL Link)`}
                    </div>
                  ));
                } catch (e) {
                  return null;
                }
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Recipients Activity Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recipient Outreach Activity ({filteredRecipients.length})
            </h3>
            <p className="text-xs text-slate-500">
              Per-recipient dispatch records, real delivery receipts (✓✓), blue ticks, and customer replies
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search recipient..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              />
            </div>

            <select
              value={recipientStatusFilter}
              onChange={(e) => setRecipientStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="opened">Opened</option>
              <option value="prepared">Prepared</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 font-semibold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status & Receipts</th>
                <th className="py-3 px-4">Delivery Timeline</th>
                <th className="py-3 px-4 text-right">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecipients.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {r.recipient_name}
                    {r.recipient_company && (
                      <span className="block font-normal text-[11px] text-slate-400">
                        {r.recipient_company}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                    +{r.recipient_phone}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {r.recipient_category || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 items-start">
                      {r.reply_text ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          🔥 Replied
                        </span>
                      ) : r.read_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                          ✓✓ Read
                        </span>
                      ) : r.delivered_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ✓✓ Delivered
                        </span>
                      ) : (
                        <RecipientStatusBadge status={r.status} />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-500 space-y-0.5">
                    {r.read_at && (
                      <span className="text-sky-500 font-medium block">
                        Read: {new Date(r.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {r.delivered_at && (
                      <span className="text-teal-600 dark:text-teal-400 block">
                        Delivered: {new Date(r.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {r.confirmed_sent_at && (
                      <span className="text-slate-400 block">
                        Sent: {new Date(r.confirmed_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {!r.confirmed_sent_at && !r.delivered_at && (
                      <span>Prepared</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setViewMessageModal({ open: true, recipient: r })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Timeline Logs */}
      {campaign.activity_logs && campaign.activity_logs.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Campaign Activity Logs ({campaign.activity_logs.length})</span>
          </h3>

          <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
            {campaign.activity_logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {log.action.replace('_', ' ')}:
                  </span>{' '}
                  <span className="text-slate-600 dark:text-slate-400">{log.details}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Personalized Message Modal */}
      <Modal
        isOpen={viewMessageModal.open}
        onClose={() => setViewMessageModal({ open: false, recipient: null })}
        title={`Message for ${viewMessageModal.recipient?.recipient_name || ''}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span>Phone: +{viewMessageModal.recipient?.recipient_phone}</span>
            <RecipientStatusBadge status={viewMessageModal.recipient?.status} />
          </div>

          {(viewMessageModal.recipient?.media_url || campaign.header_media_url) && (
            <div className="rounded-xl overflow-hidden border max-h-48 bg-black/10 flex items-center justify-center">
              <img
                src={viewMessageModal.recipient?.media_url || campaign.header_media_url}
                alt="Message attachment"
                className="max-h-48 w-auto object-cover"
              />
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
            {viewMessageModal.recipient?.personalized_message}
          </div>

          {viewMessageModal.recipient?.reply_text && (
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
              <span className="font-bold text-purple-700 dark:text-purple-300 block mb-1">
                Customer's Received Reply:
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-sans">
                "{viewMessageModal.recipient.reply_text}"
              </p>
            </div>
          )}


          <div className="flex justify-end pt-2">
            <button
              onClick={() => setViewMessageModal({ open: false, recipient: null })}
              className="px-4 py-2 border rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
