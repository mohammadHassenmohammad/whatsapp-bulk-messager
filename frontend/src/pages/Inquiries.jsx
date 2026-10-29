import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  User,
  Phone,
  RefreshCw,
  Trash2,
  Filter,
  Check,
  Ban,
  ArrowUpRight,
  ShieldCheck,
  Flame,
  HelpCircle,
  Copy,
  CheckCheck,
  ExternalLink,
  Users,
  Radio,
  Tag,
  Calendar,
  MessageCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useQuickChat } from '../context/QuickChatContext';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';

// Helper to format phone number nicely or identify WhatsApp groups
function formatPhoneNumber(phone = '') {
  if (!phone) return 'Unknown';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('120363') || clean.length > 15) {
    return `Group Feed (#${clean.slice(-6)})`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return clean.startsWith('+') ? clean : `+${clean}`;
}

function isWhatsAppGroup(phone = '') {
  const clean = (phone || '').replace(/\D/g, '');
  return clean.startsWith('120363') || clean.length > 15;
}

// Clean formatted text with clickable link pills and WhatsApp markdown styling
function FormattedMessageText({ text }) {
  if (!text) return null;

  // Split lines
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-sm text-slate-200 break-words leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />;
        }

        // Check if line contains a URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = line.split(urlRegex);

        return (
          <p key={idx} className="break-words">
            {parts.map((part, pIdx) => {
              if (part.match(/^https?:\/\//)) {
                let domain = 'link';
                try {
                  const urlObj = new URL(part);
                  domain = urlObj.hostname.replace(/^www\./, '');
                } catch (e) {
                  domain = 'web link';
                }

                return (
                  <a
                    key={pIdx}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium transition-colors break-all shadow-sm align-middle"
                    title={part}
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span>{domain}</span>
                    <span className="opacity-60 text-[10px] hidden sm:inline truncate max-w-[140px]">
                      {part.length > 30 ? part.slice(domain.length + 8, domain.length + 28) + '...' : ''}
                    </span>
                  </a>
                );
              }

              // Format WhatsApp markdown (*bold*, _italic_, ~strike~)
              return (
                <span key={pIdx}>
                  {formatWhatsAppMarkdown(part)}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

// Lightweight WhatsApp markdown formatter
function formatWhatsAppMarkdown(str) {
  // Bold: *text*
  const boldRegex = /\*([^*]+)\*/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = boldRegex.exec(str)) !== null) {
    if (match.index > lastIdx) {
      parts.push(str.substring(lastIdx, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold text-white">
        {match[1]}
      </strong>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < str.length) {
    parts.push(str.substring(lastIdx));
  }

  return parts.length > 0 ? parts : str;
}

export const Inquiries = () => {
  const toast = useToast();
  const { openQuickChat } = useQuickChat();

  const [inquiries, setInquiries] = useState([]);
  const [counts, setCounts] = useState({ total: 0, new: 0, enquiries: 0, opt_outs: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'enquire' | 'stop' | 'general_reply'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'new' | 'contacted' | 'resolved'

  // Delete Confirm
  const [deleteId, setDeleteId] = useState(null);

  const fetchInquiries = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        api.getInquiries({ inquiry_type: typeFilter, status: statusFilter }),
        api.getInquiryCounts()
      ]);
      setInquiries(listRes || []);
      setCounts(countRes || { total: 0, new: 0, enquiries: 0, opt_outs: 0 });
    } catch (err) {
      toast.show(err.message || 'Failed to load inquiries', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [typeFilter, statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInquiries();
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.updateInquiryStatus(id, newStatus);
      setInquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      toast.show(`Status updated to ${newStatus}`, 'success');
      api.getInquiryCounts().then(setCounts).catch(() => {});
    } catch (err) {
      toast.show(err.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteInquiry(deleteId);
      setInquiries((prev) => prev.filter((item) => item.id !== deleteId));
      setDeleteId(null);
      toast.show('Inquiry removed from inbox', 'success');
      api.getInquiryCounts().then(setCounts).catch(() => {});
    } catch (err) {
      toast.show(err.message || 'Failed to delete inquiry', 'error');
    }
  };

  const handleCopyMessage = (id, text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.show('Message copied to clipboard', 'info');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter client-side by search query
  const filteredInquiries = inquiries.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.customer_name && item.customer_name.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.message_text && item.message_text.toLowerCase().includes(q))
    );
  });

  const getTypeBadge = (type) => {
    switch (type) {
      case 'enquire':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <Flame className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Hot Lead (Enquiry)
          </span>
        );
      case 'stop':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm"
            title="Customer opted out. System has automatically suppressed future messages."
          >
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            Opted Out (STOP)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            Customer Reply
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            New
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Send className="w-3 h-3" />
            Contacted
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Check className="w-3 h-3" />
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Leads & Customer Replies
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Inbox
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Centralized CRM inbox for all inbound customer messages, campaign button clicks, and enquiries.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition text-xs font-medium disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Received</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{counts.total || 0}</div>
          <p className="text-[11px] text-slate-500 mt-1">All incoming messages & clicks</p>
        </div>

        <div className="bg-slate-900/90 border border-emerald-900/40 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:border-emerald-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Hot Leads</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2">{counts.enquiries || 0}</div>
          <p className="text-[11px] text-slate-500 mt-1">Ready buyers & interested enquiries</p>
        </div>

        <div className="bg-slate-900/90 border border-rose-900/40 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:border-rose-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Opt-Outs (STOP)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 mt-2">{counts.opt_outs || 0}</div>
          <p className="text-[11px] text-slate-500 mt-1">Auto-suppressed for zero spam risk</p>
        </div>

        <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:border-amber-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Needs Reply</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2">{counts.new || 0}</div>
          <p className="text-[11px] text-slate-500 mt-1">Pending action from your team</p>
        </div>
      </div>

      {/* Compliance / Auto-Suppression Notice */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-indigo-950/30 border border-emerald-800/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
              Automated Compliance Protection Active
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                Active
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Whenever a customer texts <code className="text-rose-400 font-mono font-semibold bg-rose-500/10 px-1 py-0.5 rounded">STOP</code>, the gateway instantly blocks future automated broadcasts to their number, preserving your WhatsApp reputation.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or message text..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Inquiry Type Filter */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700/80">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                typeFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('enquire')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                typeFilter === 'enquire'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-300" /> Leads
            </button>
            <button
              onClick={() => setTypeFilter('stop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                typeFilter === 'stop'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ban className="w-3 h-3 text-white" /> Opt-Outs
            </button>
            <button
              onClick={() => setTypeFilter('general_reply')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                typeFilter === 'general_reply'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3 h-3" /> Replies
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="new">Status: New</option>
            <option value="contacted">Status: Contacted</option>
            <option value="resolved">Status: Resolved</option>
          </select>
        </div>
      </div>

      {/* Inquiry List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-slate-900/80 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-emerald-500 mb-3" />
          <p className="text-sm font-medium">Fetching real-time customer replies & leads...</p>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={search ? 'No inquiries match your query' : 'No incoming inquiries yet'}
          description={
            search
              ? 'Try modifying your search query or changing your filter criteria.'
              : 'When customers reply to your messages or tap interactive template buttons (like ENQUIRE or STOP), their inquiries will appear here instantly.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => {
            const isGroup = isWhatsAppGroup(inquiry.phone);
            const displayName =
              inquiry.customer_name && !inquiry.customer_name.startsWith('WhatsApp User (')
                ? inquiry.customer_name
                : isGroup
                ? `WhatsApp Group Feed`
                : `WhatsApp Customer`;

            return (
              <div
                key={inquiry.id}
                className={`group rounded-2xl border transition-all duration-200 overflow-hidden ${
                  inquiry.status === 'new'
                    ? 'bg-slate-900/95 border-emerald-500/40 shadow-lg shadow-emerald-950/20 hover:border-emerald-500/60'
                    : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/30">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* User Avatar */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-sm ${
                        isGroup
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : inquiry.inquiry_type === 'enquire'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isGroup ? <Users className="w-4 h-4" /> : displayName.slice(0, 2)}
                    </div>

                    {/* Customer Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm sm:text-base">
                          {displayName}
                        </span>
                        {isGroup && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            Group Chat
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {!isGroup ? (
                          <a
                            href={`https://wa.me/${inquiry.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 font-medium"
                          >
                            <Phone className="w-3 h-3" />
                            {formatPhoneNumber(inquiry.phone)}
                            <ArrowUpRight className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <span className="font-mono text-slate-400 flex items-center gap-1">
                            <Radio className="w-3 h-3 text-indigo-400" />
                            {formatPhoneNumber(inquiry.phone)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges on right side of header */}
                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(inquiry.inquiry_type)}
                    {getStatusBadge(inquiry.status)}
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium ml-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(inquiry.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Card Body & Actions */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-5 items-stretch lg:items-start justify-between">
                  {/* Message Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="relative bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 hover:border-slate-700/80 transition-colors">
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3 text-emerald-400" />
                          Message Content
                        </span>
                        <button
                          onClick={() => handleCopyMessage(inquiry.id, inquiry.message_text)}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 transition"
                          title="Copy raw message"
                        >
                          {copiedId === inquiry.id ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Render formatted message text with links */}
                      <FormattedMessageText text={inquiry.message_text} />
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2.5 px-1">
                      {inquiry.campaign_id && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px]">
                          Campaign #{inquiry.campaign_id}
                        </span>
                      )}
                      {inquiry.inquiry_type === 'stop' && (
                        <span className="text-rose-400 flex items-center gap-1 font-medium text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" /> Auto-Suppression Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                    {/* Status Pill Switcher */}
                    <div className="flex flex-col items-start lg:items-end gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Update Status
                      </span>
                      <div className="inline-flex rounded-xl bg-slate-950/80 p-1 border border-slate-800">
                        {['new', 'contacted', 'resolved'].map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(inquiry.id, s)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition ${
                              inquiry.status === s
                                ? s === 'new'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                  : s === 'contacted'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Main CTA: Reply on WhatsApp */}
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={() =>
                          openQuickChat({
                            phone: inquiry.phone,
                            customer: {
                              full_name: displayName,
                              phone: inquiry.phone,
                            },
                            message:
                              inquiry.inquiry_type === 'enquire'
                                ? `Hello ${displayName}, thank you for your enquiry regarding our promotion! How can I assist you today?`
                                : `Hello ${displayName}, how can I help you today?`,
                          })
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-950/40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Reply on WhatsApp
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setDeleteId(inquiry.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition border border-transparent hover:border-rose-500/20"
                        title="Delete inquiry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        title="Delete Inquiry Record"
        message="Are you sure you want to remove this customer inquiry? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};
