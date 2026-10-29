import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Building,
  FolderTree,
  Tag,
  Shield,
  MessageSquare,
  Edit2,
  Trash2,
  Copy,
  Clock,
  Check,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ConsentBadge } from './Badge';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

export const CustomerDetailDrawer = ({
  isOpen,
  onClose,
  customer,
  onEdit,
  onDelete,
  onOpenQuickChat,
  onStageUpdated,
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [currentStage, setCurrentStage] = useState(customer?.lead_stage || 'New');
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  useEffect(() => {
    if (customer) {
      setCurrentStage(customer.lead_stage || 'New');
      loadTimeline(customer.id);
    }
  }, [customer]);

  const loadTimeline = async (id) => {
    if (!id) return;
    setLoadingTimeline(true);
    try {
      const res = await api.getCustomerTimeline(id);
      setTimeline(res.timeline || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  if (!isOpen || !customer) return null;

  const handleCopyPhone = () => {
    const p = customer.phone || customer.formatted_phone;
    navigator.clipboard.writeText(p);
    setCopied(true);
    toast.success('Phone copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStageChange = async (newStage) => {
    try {
      await api.updateCustomerLeadStage(customer.id, newStage);
      setCurrentStage(newStage);
      toast.success(`Lead stage updated to ${newStage}`);
      if (onStageUpdated) onStageUpdated(customer.id, newStage);
      loadTimeline(customer.id);
    } catch (err) {
      toast.error('Failed to update lead stage');
    }
  };

  const getStageBadgeColor = (stage) => {
    switch (stage) {
      case 'New':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300';
      case 'Contacted':
        return 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300';
      case 'Interested':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300';
      case 'Converted':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold';
      case 'Lost':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm">
              {customer.full_name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {customer.full_name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {customer.formatted_phone || customer.phone}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenQuickChat(customer)}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Chat</span>
            </button>
            <button
              onClick={() => onEdit(customer)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(customer)}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl transition"
              title="Delete Contact"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Lead Stage Selector */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                <span>CRM Lead Stage</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStageBadgeColor(currentStage)}`}>
                {currentStage}
              </span>
            </div>
            <select
              value={currentStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none"
            >
              <option value="New">New (Uncontacted)</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested (Warm Lead)</option>
              <option value="Converted">Converted (Customer)</option>
              <option value="Lost">Lost / Inactive</option>
            </select>
          </div>

          {/* Contact Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
              Contact Details
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp Phone:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {customer.formatted_phone || customer.phone}
                  </span>
                  <button
                    onClick={handleCopyPhone}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Copy Phone"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email:</span>
                </span>
                <span className="text-slate-800 dark:text-slate-200">
                  {customer.email || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Company:</span>
                </span>
                <span className="text-slate-800 dark:text-slate-200 font-medium">
                  {customer.company || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5" />
                  <span>Audience Category:</span>
                </span>
                <span className="font-medium">
                  {customer.category_name ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                      {customer.category_name}
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Consent Status:</span>
                </span>
                <ConsentBadge status={customer.consent_status} />
              </div>
            </div>
          </div>

          {/* Interaction Timeline */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowTimeline(!showTimeline)}
            >
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Interaction Timeline ({timeline.length})</span>
              </h4>
              {showTimeline ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </div>

            {showTimeline && (
              <div className="pt-2">
                {loadingTimeline ? (
                  <div className="py-4 text-center text-slate-400">Loading timeline...</div>
                ) : timeline.length === 0 ? (
                  <div className="py-3 text-slate-400 italic">No interaction history recorded yet.</div>
                ) : (
                  <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                    {timeline.map((evt, idx) => (
                      <div key={idx} className="relative">
                        <div
                          className={`absolute -left-5 top-1 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${
                            evt.badge_color === 'red'
                              ? 'bg-red-500'
                              : evt.badge_color === 'indigo'
                              ? 'bg-indigo-500'
                              : evt.badge_color === 'purple'
                              ? 'bg-purple-500'
                              : evt.badge_color === 'amber'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {evt.title}
                          </span>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {evt.description}
                          </p>
                          {evt.timestamp && (
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {new Date(evt.timestamp).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Assigned Tags</span>
            </h4>
            {customer.tags ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customer.tags.split(',').map((t, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-[11px]"
                  >
                    #{t.trim()}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">No tags assigned.</span>
            )}
          </div>

          {/* Internal Notes */}
          {customer.notes && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                Internal Notes
              </h4>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {customer.notes}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[10px] text-slate-400 space-y-1 pt-2">
            <div>Added on: {new Date(customer.created_at).toLocaleString()}</div>
            {customer.updated_at && (
              <div>Last modified: {new Date(customer.updated_at).toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
