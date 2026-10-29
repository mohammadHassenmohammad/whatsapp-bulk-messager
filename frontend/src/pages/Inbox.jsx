import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Search,
  Send,
  User,
  Phone,
  Clock,
  Check,
  CheckCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FolderOpen,
  Filter,
  Calendar,
  ChevronRight,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export const Inbox = () => {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);

  // Customer timeline drawer
  const [showTimeline, setShowTimeline] = useState(false);
  const [customerTimeline, setCustomerTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const messagesEndRef = useRef(null);

  // Load conversations list
  const loadConversations = async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const data = await api.getConversations({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery ? searchQuery.trim() : undefined,
      });
      setConversations(data || []);
      if (data && data.length > 0 && !selectedConvId) {
        setSelectedConvId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(() => loadConversations(true), 8000);
    return () => clearInterval(interval);
  }, [statusFilter, searchQuery]);

  // Load selected conversation detail
  const loadConversationDetail = async (id) => {
    if (!id) return;
    setLoadingChat(true);
    try {
      const conv = await api.getConversation(id);
      setSelectedConv(conv);
      // Fetch AI suggested replies if conversation has messages
      if (conv?.messages && conv.messages.length > 0) {
        const lastMsg = conv.messages[conv.messages.length - 1];
        fetchSuggestions(lastMsg.body, conv.customer_name);
      } else {
        setAiSuggestions([]);
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
      showToast('Failed to load message thread', 'error');
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (selectedConvId) {
      loadConversationDetail(selectedConvId);
    }
  }, [selectedConvId]);

  // Auto scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages]);

  const fetchSuggestions = async (lastMessageText, customerName) => {
    setLoadingSuggestions(true);
    try {
      const res = await api.suggestAiReplies({
        last_message: lastMessageText,
        customer_name: customerName,
      });
      setAiSuggestions(res.suggestions || []);
    } catch (err) {
      console.error('AI suggestion error:', err);
      setAiSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !selectedConvId || sending) return;

    setSending(true);
    try {
      await api.sendConversationReply(selectedConvId, {
        body: replyText.trim(),
      });
      setReplyText('');
      showToast('Message dispatched successfully', 'success');
      await loadConversationDetail(selectedConvId);
      loadConversations(true);
    } catch (err) {
      console.error('Send error:', err);
      showToast(err.message || 'Failed to send reply', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedConvId) return;
    try {
      await api.updateConversationStatus(selectedConvId, newStatus);
      showToast(`Conversation marked as ${newStatus}`, 'success');
      setSelectedConv((prev) => (prev ? { ...prev, status: newStatus } : prev));
      loadConversations(true);
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleOpenTimeline = async () => {
    if (!selectedConv?.customer_id) {
      showToast('No customer profile linked to this phone number', 'info');
      return;
    }
    setShowTimeline(true);
    setLoadingTimeline(true);
    try {
      const data = await api.getCustomerTimeline(selectedConv.customer_id);
      setCustomerTimeline(data);
    } catch (err) {
      showToast('Failed to load interaction timeline', 'error');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleSummarizeThread = async () => {
    if (!selectedConv?.messages || selectedConv.messages.length === 0) return;
    try {
      const res = await api.summarizeAiThread({
        messages: selectedConv.messages,
      });
      setAiSummary(res.summary);
      showToast('Thread summarized', 'success');
    } catch (err) {
      showToast('Failed to summarize thread', 'error');
    }
  };

  const getDeliveryIcon = (status) => {
    if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline ml-1" />;
    if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline ml-1" />;
    if (status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400 inline ml-1" />;
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* ----------------- LEFT PANE: Conversation List ----------------- */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        {/* Header & Filter */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">Inbox</h2>
            </div>
            <button
              onClick={() => loadConversations()}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Status Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {['all', 'open', 'waiting_reply', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full font-medium capitalize transition whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {loadingList ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p>No conversations found</p>
              <span className="text-xs text-slate-500">Inbound replies via WhatsApp will appear here automatically.</span>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConvId === conv.id;
              const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 cursor-pointer transition flex items-start gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                    {conv.customer_name ? conv.customer_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {conv.customer_name || `+${conv.phone}`}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {lastMsg ? lastMsg.body : 'No messages yet'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium uppercase tracking-wider ${
                          conv.status === 'open'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : conv.status === 'waiting_reply'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {conv.status.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">+{conv.phone}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ----------------- RIGHT PANE: Chat Thread ----------------- */}
      <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950 ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        {selectedConv ? (
          <>
            {/* Thread Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConvId(null)}
                  className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center">
                  {selectedConv.customer_name ? selectedConv.customer_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white leading-snug">
                      {selectedConv.customer_name || `+${selectedConv.phone}`}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Phone className="w-3 h-3" />
                    <span>+{selectedConv.phone}</span>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSummarizeThread}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 transition"
                  title="Summarize thread with local AI"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Summary</span>
                </button>

                <button
                  onClick={handleOpenTimeline}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Timeline</span>
                </button>

                <select
                  value={selectedConv.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="waiting_reply">Waiting Reply</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* AI Summary Banner (if requested) */}
            {aiSummary && (
              <div className="mx-6 mt-4 p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Thread Intelligence Summary</span>
                  <p className="whitespace-pre-line leading-relaxed">{aiSummary}</p>
                </div>
                <button
                  onClick={() => setAiSummary(null)}
                  className="text-indigo-400 hover:text-indigo-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingChat ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Loading chat history...
                </div>
              ) : !selectedConv.messages || selectedConv.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                  <p>No messages recorded yet in this conversation.</p>
                  <p className="text-xs text-slate-500">Send a reply below to initiate conversation.</p>
                </div>
              ) : (
                selectedConv.messages.map((msg) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          isOutbound
                            ? 'bg-emerald-600 text-white rounded-br-xs'
                            : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                        }`}
                      >
                        {msg.sender_type === 'auto_reply' && (
                          <span className="text-[10px] tracking-wider uppercase font-bold block mb-1 text-emerald-200">
                            ⚡ Automated Bot Reply
                          </span>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.body}</p>
                        <div
                          className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                            isOutbound ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isOutbound && getDeliveryIcon(msg.delivery_status)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Quick Response Chips */}
            {aiSuggestions.length > 0 && (
              <div className="px-6 py-2 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-emerald-500" /> Suggested:
                </span>
                {aiSuggestions.map((sugg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setReplyText(sugg)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition whitespace-nowrap shadow-2xs text-left max-w-sm truncate"
                    title={sugg}
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            )}

            {/* Composer Footer */}
            <form
              onSubmit={handleSendReply}
              className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-end gap-3"
            >
              <textarea
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for newline)"
                className="flex-1 p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm space-y-2">
            <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">Select a conversation to start chatting</p>
            <p className="text-xs text-slate-400">All customer WhatsApp messages and replies sync in real time.</p>
          </div>
        )}
      </div>

      {/* ----------------- TIMELINE DRAWER MODAL ----------------- */}
      {showTimeline && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                Customer Interaction Timeline
              </h3>
              <button
                onClick={() => setShowTimeline(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {loadingTimeline ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading timeline history...</div>
            ) : customerTimeline ? (
              <div className="mt-4 space-y-4">
                {/* Contact Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {customerTimeline.customer.name}
                  </div>
                  <div className="text-slate-500">Phone: +{customerTimeline.customer.phone}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                      {customerTimeline.customer.lead_stage}
                    </span>
                    <span className="text-slate-400">Category: {customerTimeline.customer.category}</span>
                  </div>
                </div>

                {/* Timeline Events List */}
                <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {customerTimeline.timeline.map((evt, idx) => (
                    <div key={idx} className="relative">
                      {/* Bullet point */}
                      <div
                        className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
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
                      <div className="text-xs">
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
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">No timeline events found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
