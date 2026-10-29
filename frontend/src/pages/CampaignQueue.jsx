import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Send,
  ExternalLink,
  CheckCircle2,
  SkipForward,
  XCircle,
  Clock,
  User,
  Building,
  FolderTree,
  AlertCircle,
  HelpCircle,
  Award,
  ChevronRight,
  ChevronLeft,
  Zap,
  Pause,
  Play,
  Square,
  QrCode,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RecipientStatusBadge } from '../components/Badge';
import { WhatsAppConnectModal } from '../components/WhatsAppConnectModal';

export const CampaignQueue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // WhatsApp Web Session State
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsUser, setWsUser] = useState(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Automated Dispatch State
  const [autoSending, setAutoSending] = useState(false);
  const [isJobPaused, setIsJobPaused] = useState(false);
  const [minDelay, setMinDelay] = useState(4);
  const [maxDelay, setMaxDelay] = useState(8);

  // Actions state
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [markSentModal, setMarkSentModal] = useState(false);
  const [skipModal, setSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('Recipient unavailable / skipped by user');

  // Queue Roster Browser Filter & Search
  const [rosterFilter, setRosterFilter] = useState('all'); // 'all' | 'pending' | 'sent' | 'skipped'
  const [rosterSearch, setRosterSearch] = useState('');

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && campaign?.recipients) {
        setCurrentIndex((prev) => Math.min(prev + 1, campaign.recipients.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [campaign]);

  const checkGatewayStatus = async () => {
    const data = await api.getGatewayStatus();
    if (data && data.status === 'connected') {
      setIsWsConnected(true);
      setWsUser(data.user);
      if (data.activeBulkJob && data.activeBulkJob.campaignId === parseInt(id)) {
        setAutoSending(true);
        setIsJobPaused(Boolean(data.activeBulkJob.isPaused));
      }
    } else {
      setIsWsConnected(false);
      setWsUser(null);
      setAutoSending(false);
    }
  };

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaign(id);
      setCampaign(data);

      if (data.recipients && data.recipients.length > 0) {
        const firstUnfinished = data.recipients.findIndex(
          (r) => r.status === 'prepared' || r.status === 'opened'
        );
        if (firstUnfinished !== -1) {
          setCurrentIndex(firstUnfinished);
        } else {
          setCurrentIndex(data.recipients.length);
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load campaign queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaign();
    checkGatewayStatus();
    const interval = setInterval(checkGatewayStatus, 3500);
    return () => clearInterval(interval);
  }, [id]);

  // Polling campaign while auto sending
  useEffect(() => {
    let poller = null;
    if (autoSending) {
      poller = setInterval(async () => {
        try {
          const refreshed = await api.getCampaign(id);
          setCampaign(refreshed);

          // Find current active index
          const nextUnfinished = refreshed.recipients.findIndex(
            (r) => r.status === 'prepared' || r.status === 'opened'
          );
          if (nextUnfinished !== -1) {
            setCurrentIndex(nextUnfinished);
          } else {
            setCurrentIndex(refreshed.recipients.length);
            setAutoSending(false);
            toast.success('Automated dispatch campaign finished!');
          }
        } catch (e) {}
      }, 2500);
    }
    return () => {
      if (poller) clearInterval(poller);
    };
  }, [autoSending, id]);

  const currentRecipient = campaign?.recipients?.[currentIndex];
  const isFinished = !currentRecipient && (campaign?.recipients?.length || 0) > 0;

  // 1. Manual Click-to-Chat trigger
  const handleOpenWhatsApp = async () => {
    if (!currentRecipient) return;
    window.open(currentRecipient.click_to_chat_url, '_blank', 'noopener,noreferrer');

    if (currentRecipient.status === 'prepared') {
      try {
        await api.updateRecipientStatus(campaign.id, currentRecipient.id, {
          status: 'opened',
        });
        toast.info(`Opened WhatsApp chat for ${currentRecipient.recipient_name}`);
        const refreshed = await api.getCampaign(id);
        setCampaign(refreshed);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 2. Direct 1-Click Send via connected session
  const handleSendDirectSingle = async () => {
    if (!currentRecipient) return;
    if (!isWsConnected) {
      setConnectModalOpen(true);
      return;
    }

    setIsUpdating(true);
    try {
      await api.sendDirectSingle(
        currentRecipient.recipient_phone,
        currentRecipient.personalized_message,
        currentRecipient.media_url || campaign?.header_media_url || null
      );
      await api.updateRecipientStatus(campaign.id, currentRecipient.id, {
        status: 'sent',
        notes: 'Direct 1-click dispatch via linked WhatsApp Web',
      });
      toast.success(`Sent directly to ${currentRecipient.recipient_name}!`);

      const refreshed = await api.getCampaign(id);
      setCampaign(refreshed);

      const nextUnfinished = refreshed.recipients.findIndex(
        (r, idx) => idx > currentIndex && (r.status === 'prepared' || r.status === 'opened')
      );
      if (nextUnfinished !== -1) {
        setCurrentIndex(nextUnfinished);
      } else {
        const anyUnfinished = refreshed.recipients.findIndex(
          (r) => r.status === 'prepared' || r.status === 'opened'
        );
        setCurrentIndex(anyUnfinished !== -1 ? anyUnfinished : refreshed.recipients.length);
      }
    } catch (err) {
      toast.error(err.message || 'Direct send failed');
    } finally {
      setIsUpdating(false);
    }
  };

  // 3. Automated Bulk Dispatch (Hands-Free)
  const handleStartAutomatedSending = async () => {
    if (!isWsConnected) {
      setConnectModalOpen(true);
      return;
    }

    const remaining = (campaign?.recipients || [])
      .filter((r) => r.status === 'prepared' || r.status === 'opened')
      .map((r) => ({
        id: r.id,
        phone: r.recipient_phone,
        message: r.personalized_message,
        mediaUrl: r.media_url || campaign?.header_media_url || null,
      }));

    if (remaining.length === 0) {
      toast.info('No remaining recipients to send to.');
      return;
    }

    try {
      await api.sendBulkDirect(campaign.id, remaining, minDelay, maxDelay);
      setAutoSending(true);
      toast.success(`Automated dispatch started for ${remaining.length} recipients!`);
    } catch (err) {
      toast.error(err.message || 'Failed to start automated dispatch');
    }
  };

  const handleStopAutomatedSending = async () => {
    try {
      await api.cancelBulkDirect();
      setAutoSending(false);
      setIsJobPaused(false);
      toast.info('Automated dispatch stopped');
      const refreshed = await api.getCampaign(id);
      setCampaign(refreshed);
    } catch (err) {
      toast.error('Failed to cancel');
    }
  };

  const handlePauseAutomatedSending = async () => {
    try {
      await api.pauseBulkDirect();
      setIsJobPaused(true);
      toast.info('Automated dispatch paused.');
    } catch (e) {
      toast.error('Failed to pause automated dispatch');
    }
  };

  const handleResumeAutomatedSending = async () => {
    try {
      await api.resumeBulkDirect();
      setIsJobPaused(false);
      toast.success('Automated dispatch resumed.');
    } catch (e) {
      toast.error('Failed to resume automated dispatch');
    }
  };

  const handleRetryFailedRecipients = async () => {
    try {
      setIsUpdating(true);
      const res = await api.retryFailedRecipients(id);
      toast.success(res.message);
      await loadCampaign();
    } catch (e) {
      toast.error(e.message || 'Failed to retry failed recipients');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmSent = async () => {
    if (!currentRecipient) return;
    setIsUpdating(true);
    try {
      await api.updateRecipientStatus(campaign.id, currentRecipient.id, {
        status: 'sent',
      });
      toast.success(`Marked as Sent: ${currentRecipient.recipient_name}`);
      setMarkSentModal(false);

      const refreshed = await api.getCampaign(id);
      setCampaign(refreshed);

      const nextUnfinished = refreshed.recipients.findIndex(
        (r, idx) => idx > currentIndex && (r.status === 'prepared' || r.status === 'opened')
      );
      if (nextUnfinished !== -1) {
        setCurrentIndex(nextUnfinished);
      } else {
        const anyUnfinished = refreshed.recipients.findIndex(
          (r) => r.status === 'prepared' || r.status === 'opened'
        );
        setCurrentIndex(anyUnfinished !== -1 ? anyUnfinished : refreshed.recipients.length);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkipRecipient = async () => {
    if (!currentRecipient) return;
    setIsUpdating(true);
    try {
      await api.updateRecipientStatus(campaign.id, currentRecipient.id, {
        status: 'skipped',
        notes: skipReason,
      });
      toast.info(`Skipped recipient ${currentRecipient.recipient_name}`);
      setSkipModal(false);

      const refreshed = await api.getCampaign(id);
      setCampaign(refreshed);

      const nextIdx = refreshed.recipients.findIndex(
        (r, idx) => idx > currentIndex && (r.status === 'prepared' || r.status === 'opened')
      );
      if (nextIdx !== -1) {
        setCurrentIndex(nextIdx);
      } else {
        const anyUnfinished = refreshed.recipients.findIndex(
          (r) => r.status === 'prepared' || r.status === 'opened'
        );
        setCurrentIndex(anyUnfinished !== -1 ? anyUnfinished : refreshed.recipients.length);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to skip recipient');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelCampaign = async () => {
    try {
      await api.cancelCampaign(campaign.id);
      toast.warning('Campaign has been cancelled.');
      setCancelModal(false);
      navigate('/campaigns/history');
    } catch (err) {
      toast.error(err.message || 'Failed to cancel campaign');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-slate-400">Loading campaign queue...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">Campaign not found.</p>
        <Link to="/campaigns" className="text-xs text-emerald-600 font-semibold mt-2 inline-block">
          Return to Campaigns
        </Link>
      </div>
    );
  }

  const total = campaign.total_recipients;
  const sent = campaign.sent_count;
  const skipped = campaign.skipped_count;
  const processed = sent + skipped;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Campaign Progress Bar */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Queue: {campaign.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Outreach dispatch queue ({processed} of {total} completed)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCancelModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-colors"
            >
              Cancel Campaign
            </button>
            <Link
              to={`/campaigns/${campaign.id}`}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl"
            >
              View Report
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Overall Progress</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {progressPercent}% Complete
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${total > 0 ? (sent / total) * 100 : 0}%` }}
              title="Confirmed Sent"
            ></div>
            <div
              className="bg-amber-400 transition-all duration-300"
              style={{ width: `${total > 0 ? (skipped / total) * 100 : 0}%` }}
              title="Skipped"
            ></div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{sent} Sent</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>{skipped} Skipped</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></span>
              <span>{total - processed} Remaining</span>
            </span>
            {failed > 0 && (
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>{failed} Failed</span>
                </span>
                <button
                  type="button"
                  onClick={handleRetryFailedRecipients}
                  className="px-2.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 rounded-lg transition-all shadow-xs"
                >
                  Retry Failed
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AUTOMATED DISPATCH BANNER (Direct from Linked WhatsApp Web) */}
      {!isFinished && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white shadow-lg border border-emerald-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400 fill-current" />
              <h3 className="text-sm font-bold tracking-tight">
                Automated Direct Sending (Without Clicking Each Chat)
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              {isWsConnected
                ? `Logged in as ${wsUser?.phone || 'Your Account'}. The app will automatically cycle through remaining recipients with a safe pause between messages.`
                : 'Connect your WhatsApp Web session once via QR code to enable 100% automated background sending.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isWsConnected ? (
              autoSending ? (
                <div className="flex items-center gap-2">
                  {isJobPaused ? (
                    <button
                      onClick={handleResumeAutomatedSending}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseAutomatedSending}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 rounded-xl transition-all shadow-md"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </button>
                  )}
                  <button
                    onClick={handleStopAutomatedSending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Speed Presets */}
                  <div className="hidden sm:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => { setMinDelay(6); setMaxDelay(12); }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                        minDelay === 6 && maxDelay === 12
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🛡️ Safe (6-12s)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMinDelay(4); setMaxDelay(8); }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                        minDelay === 4 && maxDelay === 8
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚖️ Standard (4-8s)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMinDelay(2); setMaxDelay(5); }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                        minDelay === 2 && maxDelay === 5
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ Fast (2-5s)
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mr-1">
                    <span>Delay:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-9 px-1 py-0.5 rounded bg-slate-800 text-white text-center font-mono text-[11px]"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      min={minDelay}
                      max={60}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-9 px-1 py-0.5 rounded bg-slate-800 text-white text-center font-mono text-[11px]"
                    />
                    <span>s</span>
                  </div>

                  <button
                    onClick={handleStartAutomatedSending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 rounded-xl transition-all shadow-md"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Start Auto-Send ({total - processed})</span>
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => setConnectModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-all shadow-sm"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Link WhatsApp (Scan QR)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Queue Card or Finished State */}
      {isFinished ? (
        <div className="p-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="inline-flex p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <Award className="w-12 h-12" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              All Recipients Processed!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              All {total} recipients in this campaign queue have been completed. Records and timestamps are saved in your database.
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link
              to="/campaigns/history"
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border rounded-xl"
            >
              Campaign History
            </Link>
            <Link
              to={`/campaigns/${campaign.id}`}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              View Full Campaign Report
            </Link>
          </div>
        </div>
      ) : (
        currentRecipient && (
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
            {/* Recipient Details Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                  {currentIndex + 1}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentRecipient.recipient_name}
                  </h3>
                  <span className="font-mono text-xs text-slate-500">
                    +{currentRecipient.recipient_phone}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {currentRecipient.recipient_category && (
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {currentRecipient.recipient_category}
                  </span>
                )}
                {currentRecipient.recipient_company && (
                  <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {currentRecipient.recipient_company}
                  </span>
                )}
                <RecipientStatusBadge status={currentRecipient.status} />
              </div>
            </div>

            {/* Exact Personalized Message Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Exact Personalized Message:
                </label>
                <span className="text-[11px] text-slate-400">
                  {currentRecipient.personalized_message.length} characters
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                {(currentRecipient.media_url || campaign?.header_media_url) && (
                  <div className="w-full max-h-48 bg-black/10 overflow-hidden flex items-center justify-center border-b border-slate-200 dark:border-slate-700">
                    <img
                      src={currentRecipient.media_url || campaign?.header_media_url}
                      alt="Campaign attachment"
                      className="max-h-48 w-auto object-cover"
                    />
                  </div>
                )}
                <div className="p-4 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {currentRecipient.personalized_message}
                </div>
                {campaign?.buttons_json && (
                  <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 bg-slate-100/60 dark:bg-slate-900/40">
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

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSkipModal(true)}
                disabled={autoSending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
              >
                <SkipForward className="w-4 h-4" />
                <span>Skip Recipient</span>
              </button>

              <div className="flex items-center gap-2.5">
                {/* Send Directly Button */}
                <button
                  onClick={handleSendDirectSingle}
                  disabled={isUpdating || autoSending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {!isWsConnected
                      ? 'Link WhatsApp to Send'
                      : isUpdating
                      ? 'Sending...'
                      : 'Send Directly'}
                  </span>
                </button>

                {/* Mark as Sent */}
                <button
                  onClick={() => setMarkSentModal(true)}
                  disabled={autoSending}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border rounded-xl hover:bg-slate-50 transition-all disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mark as Sent</span>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Recipient Navigator Drawer at Bottom */}
      {campaign.recipients && campaign.recipients.length > 0 && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Queue Roster ({campaign.recipients.length})
              </span>
              <span className="text-[10px] text-slate-400 hidden md:inline">
                • Keyboard: Arrow keys to navigate
              </span>
            </div>

            {/* Status Filter Tabs & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Search recipient..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 outline-hidden w-36"
              />

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                {['all', 'pending', 'sent', 'skipped'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRosterFilter(tab)}
                    className={`px-2 py-0.5 rounded-md font-medium capitalize transition-all ${
                      rosterFilter === tab
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {campaign.recipients
              .map((r, idx) => ({ ...r, originalIndex: idx }))
              .filter((r) => {
                if (rosterFilter === 'pending') return r.status === 'prepared' || r.status === 'opened';
                if (rosterFilter === 'sent') return r.status === 'sent';
                if (rosterFilter === 'skipped') return r.status === 'skipped' || r.status === 'failed';
                return true;
              })
              .filter((r) => {
                if (!rosterSearch.trim()) return true;
                const q = rosterSearch.toLowerCase();
                return (
                  r.recipient_name?.toLowerCase().includes(q) ||
                  r.recipient_phone?.includes(q)
                );
              })
              .map((r) => {
                const isCurrent = r.originalIndex === currentIndex;
                let bg = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
                if (r.status === 'sent') bg = 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300';
                if (r.status === 'skipped') bg = 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300';
                if (r.status === 'failed') bg = 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300';
                if (isCurrent) bg = 'ring-2 ring-emerald-500 bg-emerald-500 text-white font-bold';

                return (
                  <button
                    key={r.id}
                    onClick={() => setCurrentIndex(r.originalIndex)}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${bg}`}
                    title={`${r.recipient_name} (${r.recipient_phone}) - ${r.status}`}
                  >
                    <span>{r.originalIndex + 1}.</span>
                    <span className="max-w-[80px] truncate">{r.recipient_name}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* WhatsApp Connect Modal */}
      <WhatsAppConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />

      {/* Mark Sent Confirmation Modal */}
      <ConfirmDialog
        isOpen={markSentModal}
        onClose={() => setMarkSentModal(false)}
        onConfirm={handleConfirmSent}
        title="Confirm Manual Message Send"
        message={`Have you reviewed and sent the message to "${currentRecipient?.recipient_name}" (${currentRecipient?.recipient_phone}) in WhatsApp?`}
        confirmLabel="Yes, Confirmed Sent"
      />

      {/* Skip Modal */}
      <ConfirmDialog
        isOpen={skipModal}
        onClose={() => setSkipModal(false)}
        onConfirm={handleSkipRecipient}
        title="Skip Recipient"
        message={`Skip outreach to "${currentRecipient?.recipient_name}"?`}
        confirmLabel="Skip Recipient"
        isDestructive={false}
      />

      {/* Cancel Campaign Confirmation */}
      <ConfirmDialog
        isOpen={cancelModal}
        onClose={() => setCancelModal(false)}
        onConfirm={handleCancelCampaign}
        title="Cancel In-Progress Campaign"
        message="Are you sure you want to cancel this campaign? Current progress will be preserved in Campaign History."
        confirmLabel="Cancel Campaign"
        isDestructive={true}
      />
    </div>
  );
};
