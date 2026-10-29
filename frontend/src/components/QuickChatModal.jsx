import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  ExternalLink,
  Zap,
  User,
  Phone,
  FileText,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sparkles,
  Search,
  X
} from 'lucide-react';
import { Modal } from './Modal';
import { WhatsAppMessageEditor } from './WhatsAppMessageEditor';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export const QuickChatModal = ({
  isOpen,
  onClose,
  initialCustomer = null,
  initialPhone = '',
  initialMessage = '',
  initialMediaUrl = '',
  initialButtons = [],
}) => {
  const toast = useToast();

  const [mode, setMode] = useState('customer'); // 'customer' | 'manual'
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Form State
  const [targetPhone, setTargetPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [buttons, setButtons] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);

  // Gateway Connection State
  const [gatewayStatus, setGatewayStatus] = useState({ status: 'disconnected', user: null });
  const [isSending, setIsSending] = useState(false);

  // Load templates & check gateway
  useEffect(() => {
    if (isOpen) {
      api.getTemplates()
        .then(setTemplates)
        .catch(() => {});

      api.getCustomers({ page_size: 150 })
        .then((res) => setCustomers(res.items || []))
        .catch(() => {});

      checkGateway();
    }
  }, [isOpen]);

  const checkGateway = async () => {
    try {
      const data = await api.getGatewayStatus();
      setGatewayStatus(data);
    } catch {
      setGatewayStatus({ status: 'offline' });
    }
  };

  // Pre-fill initial state when opening modal
  useEffect(() => {
    if (initialCustomer) {
      setMode('customer');
      setSelectedCustomerId(initialCustomer.id?.toString() || '');
      setTargetPhone(initialCustomer.phone || initialCustomer.formatted_phone || '');
      setRecipientName(initialCustomer.full_name || '');
      setMessage(initialMessage || `Hello ${initialCustomer.full_name}, `);
    } else if (initialPhone) {
      setMode('manual');
      setTargetPhone(initialPhone);
      setRecipientName('Recipient');
      setMessage(initialMessage || 'Hello, ');
    } else {
      setMode('customer');
      setSelectedCustomerId('');
      setTargetPhone('');
      setRecipientName('');
      setMessage(initialMessage || '');
    }
    setHeaderMediaUrl(initialMediaUrl || '');
    setButtons(initialButtons || []);
  }, [initialCustomer, initialPhone, initialMessage, initialMediaUrl, initialButtons, isOpen]);

  // When selected customer changes
  const handleCustomerSelect = (custId) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id.toString() === custId);
    if (found) {
      setTargetPhone(found.phone || found.formatted_phone);
      setRecipientName(found.full_name);
      if (!message || message.startsWith('Hello ')) {
        setMessage(`Hello ${found.full_name}, `);
      }
    }
  };

  // When template selected
  const handleTemplateSelect = (tmplId) => {
    setSelectedTemplateId(tmplId);
    const found = templates.find((t) => t.id.toString() === tmplId);
    if (found) {
      const activeCust = customers.find((c) => c.id.toString() === selectedCustomerId);
      let text = found.body;
      if (activeCust) {
        text = text
          .replace(/\{name\}/g, activeCust.full_name || '')
          .replace(/\{company\}/g, activeCust.company || '')
          .replace(/\{category\}/g, activeCust.category_name || '')
          .replace(/\{phone\}/g, activeCust.formatted_phone || activeCust.phone || '');
      } else if (recipientName) {
        text = text.replace(/\{name\}/g, recipientName);
      }
      setMessage(text);
      setHeaderMediaUrl(found.header_media_url || '');
      try {
        setButtons(found.buttons_json ? JSON.parse(found.buttons_json) : []);
      } catch {
        setButtons([]);
      }
    }
  };

  const isWsConnected = gatewayStatus.status === 'connected';

  // 1. Direct Instant Dispatch via Gateway
  const handleDirectSend = async () => {
    const cleanPhone = targetPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error('Please enter a valid phone number with country code (e.g. +1... or +91...)');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message to send');
      return;
    }

    if (!isWsConnected) {
      toast.error('WhatsApp is not connected. Please scan the QR code to link your account first.');
      return;
    }

    setIsSending(true);
    try {
      let messageToSend = message;
      if (buttons && buttons.length > 0) {
        const btnLines = buttons.map((b) =>
          b.type === 'url' && b.url ? `🔗 *${b.text}*: ${b.url}` : `👉 Reply *${b.text}*`
        );
        if (!messageToSend.includes(btnLines[0])) {
          messageToSend = `${messageToSend.trim()}\n\n──────────────────\n${btnLines.join('\n')}`;
        }
      }

      await api.sendDirectSingle(cleanPhone, messageToSend, headerMediaUrl || null);
      toast.success(`Message sent instantly to ${recipientName || cleanPhone}!`);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to send WhatsApp message');
    } finally {
      setIsSending(false);
    }
  };

  const activeCustomer = customers.find((c) => c.id.toString() === selectedCustomerId);
  const sampleContext = activeCustomer
    ? {
        name: activeCustomer.full_name,
        company: activeCustomer.company,
        category: activeCustomer.category_name,
        phone: activeCustomer.formatted_phone || activeCustomer.phone,
      }
    : {
        name: recipientName || '',
        company: '',
        category: '',
        phone: targetPhone || '',
      };

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch) ||
      c.formatted_phone?.includes(customerSearch)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick WhatsApp Message"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-xs">
        {/* Gateway Connection Banner */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
            isWsConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold">
              {isWsConnected
                ? `WhatsApp Web Connected (${gatewayStatus.user?.phone || 'Active Session'})`
                : 'WhatsApp Web Not Connected'}
            </span>
          </div>
          <span className="text-[11px] opacity-80">
            {isWsConnected ? '⚡ Direct Send Ready' : 'Scan QR code to connect session'}
          </span>
        </div>

        {/* Recipient Selection Segmented Control */}
        <div className="space-y-3">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setMode('customer')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                mode === 'customer'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Select Contact
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                mode === 'manual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Type Any Phone
            </button>
          </div>

          {mode === 'customer' ? (
            <div className="space-y-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Choose Customer:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />

                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  <option value="">-- Select Contact ({filteredCustomers.length}) --</option>
                  {filteredCustomers.slice(0, 50).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.formatted_phone})
                    </option>
                  ))}
                </select>
              </div>

              {activeCustomer && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activeCustomer.full_name}
                  </span>
                  <span className="text-slate-400 font-mono">{activeCustomer.formatted_phone}</span>
                  {activeCustomer.company && (
                    <span className="text-slate-500">🏢 {activeCustomer.company}</span>
                  )}
                  {activeCustomer.category_name && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                      {activeCustomer.category_name}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Name (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (with Country Code):
                </label>
                <input
                  type="text"
                  placeholder="e.g. +14155552671 or +919876543210"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Template Selector */}
        {templates.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Apply Template:
            </span>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value="">-- Choose a pre-made template --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category_name || 'General'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Message Editor with WhatsApp Toolbar & Live Preview */}
        <WhatsAppMessageEditor
          value={message}
          onChange={setMessage}
          sampleContext={sampleContext}
          recipientName={recipientName || targetPhone || 'Recipient'}
          rows={4}
          showPreview={true}
          headerMediaUrl={headerMediaUrl}
          onMediaChange={setHeaderMediaUrl}
          buttons={buttons}
          onButtonsChange={setButtons}
          allowMedia={true}
          allowButtons={true}
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Direct Send via Gateway */}
            <button
              type="button"
              onClick={handleDirectSend}
              disabled={isSending || !targetPhone || !isWsConnected}
              title={
                !isWsConnected
                  ? 'Link your WhatsApp account via QR code to enable direct send'
                  : 'Send immediately through your linked WhatsApp session'
              }
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sending Message...' : 'Send Message'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
