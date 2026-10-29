import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Send,
  Users,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Eye,
  Filter,
  Check,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { WhatsAppMessageEditor, renderWhatsAppFormattedText } from '../components/WhatsAppMessageEditor';

export const CampaignWizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [step, setStep] = useState(1); // 1: Details, 2: Recipients, 3: Compose, 4: Review

  // Step 1: Details
  const [campaignDetails, setCampaignDetails] = useState({
    name: `Campaign - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    description: '',
    notes: '',
  });

  // Step 2: Recipients
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [onlyVerifiedConsent, setOnlyVerifiedConsent] = useState(false);
  const [excludeSuppressed, setExcludeSuppressed] = useState(true);

  // Individual selection fallback
  const [allCustomers, setAllCustomers] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [recipientMode, setRecipientMode] = useState('category'); // 'category' or 'individual'

  // Selection preview stats from backend
  const [selectionPreview, setSelectionPreview] = useState(null);
  const [loadingSelection, setLoadingSelection] = useState(false);

  // Step 3: Message / Template
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [buttons, setButtons] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Step 4: Review & Confirmation
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    // Load categories & templates
    api.getCategories().then(setCategories).catch(console.error);
    api.getTemplates().then((tpls) => {
      setTemplates(tpls);
      if (tpls.length > 0) {
        const targetTplId = searchParams.get('template_id');
        const chosen = (targetTplId && tpls.find((t) => t.id.toString() === targetTplId)) || tpls[0];
        setSelectedTemplateId(chosen.id.toString());
        setMessageBody(chosen.body);
        setHeaderMediaUrl(chosen.header_media_url || '');
        try {
          setButtons(chosen.buttons_json ? JSON.parse(chosen.buttons_json) : []);
        } catch (e) {
          setButtons([]);
        }
      }
    }).catch(console.error);
    api.getCustomers({ page_size: 100 }).then((res) => setAllCustomers(res.items)).catch(console.error);
  }, []);

  // Pre-select customers if passed via query parameter (e.g. from Customers list)
  useEffect(() => {
    const rawIds = searchParams.get('customer_ids');
    if (rawIds) {
      const parsed = rawIds.split(',').map((id) => parseInt(id.trim())).filter((n) => !isNaN(n));
      if (parsed.length > 0) {
        setRecipientMode('individual');
        setSelectedCustomerIds(parsed);
        setStep(2);
        toast.info(`Pre-selected ${parsed.length} customers for your campaign`);
      }
    }
  }, [searchParams]);

  // Fetch backend preview of eligible/excluded recipients whenever criteria changes
  useEffect(() => {
    const fetchSelectionPreview = async () => {
      setLoadingSelection(true);
      try {
        const payload = {
          name: campaignDetails.name || 'Preview',
          message_body: messageBody || 'Preview',
          customer_ids: recipientMode === 'individual' ? selectedCustomerIds : [],
          category_ids: recipientMode === 'category' ? selectedCategoryIds : [],
          only_verified_consent: onlyVerifiedConsent,
          exclude_suppressed: excludeSuppressed,
        };
        const res = await api.previewCampaignSelection(payload);
        setSelectionPreview(res);
        setPreviewIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSelection(false);
      }
    };

    if (step >= 2) {
      fetchSelectionPreview();
    }
  }, [
    step,
    recipientMode,
    selectedCategoryIds,
    selectedCustomerIds,
    onlyVerifiedConsent,
    excludeSuppressed,
    messageBody,
  ]);

  const handleTemplateChange = (tplId) => {
    setSelectedTemplateId(tplId);
    if (!tplId) {
      setHeaderMediaUrl('');
      setButtons([]);
      return;
    }
    const tpl = templates.find((t) => t.id === parseInt(tplId));
    if (tpl) {
      setMessageBody(tpl.body);
      setHeaderMediaUrl(tpl.header_media_url || '');
      try {
        setButtons(tpl.buttons_json ? JSON.parse(tpl.buttons_json) : []);
      } catch (e) {
        setButtons([]);
      }
    }
  };

  const handleCategoryToggle = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCustomerToggle = (id) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const insertVariable = (varName) => {
    setMessageBody((prev) => prev + ` {${varName}}`);
  };

  const getMissingVariables = () => {
    if (!selectionPreview?.sample_recipients?.length) return [];
    const current = selectionPreview.sample_recipients[previewIndex] || selectionPreview.sample_recipients[0];
    const missing = [];
    if (/\{company\}/i.test(messageBody) && !current.company) missing.push('{company}');
    if (/\{category\}/i.test(messageBody) && !current.category) missing.push('{category}');
    return missing;
  };

  const renderSampleRecipientMessage = () => {
    if (!selectionPreview || !selectionPreview.sample_recipients || selectionPreview.sample_recipients.length === 0) {
      return messageBody;
    }
    const current = selectionPreview.sample_recipients[previewIndex] || selectionPreview.sample_recipients[0];
    return messageBody
      .replace(/\{name\}/gi, current.name)
      .replace(/\{company\}/gi, current.company || '')
      .replace(/\{category\}/gi, current.category || '')
      .replace(/\{phone\}/gi, current.formatted_phone);
  };

  const handleCreateCampaign = async () => {
    if (!confirmedRisk) {
      toast.error('Please confirm you have reviewed the recipient list and dispatch terms.');
      return;
    }

    setIsCreating(true);
    try {
      if (isTestMode && !testPhone.trim()) {
        toast.error('Please enter your WhatsApp test phone number for Sandbox mode.');
        setIsCreating(false);
        return;
      }

      const payload = {
        name: campaignDetails.name.trim(),
        description: campaignDetails.description.trim() || undefined,
        notes: campaignDetails.notes.trim() || undefined,
        template_id: selectedTemplateId ? parseInt(selectedTemplateId) : undefined,
        message_body: messageBody.trim(),
        header_media_url: headerMediaUrl.trim() || undefined,
        buttons_json: buttons.length > 0 ? JSON.stringify(buttons) : undefined,
        customer_ids: recipientMode === 'individual' ? selectedCustomerIds : [],
        category_ids: recipientMode === 'category' ? selectedCategoryIds : [],
        only_verified_consent: onlyVerifiedConsent,
        exclude_suppressed: excludeSuppressed,
        is_test_mode: isTestMode,
        test_phone_number: isTestMode ? testPhone.trim() : undefined,
      };

      const campaign = await api.createCampaign(payload);
      toast.success(`Campaign "${campaign.name}" created with ${campaign.total_recipients} recipient(s)!`);
      // Navigate directly into the live Queue!
      navigate(`/campaigns/${campaign.id}/queue`);
    } catch (err) {
      toast.error(err.message || 'Failed to create campaign');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Create WhatsApp Campaign
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Prepare outreach, personalize messages with customer tags, and initialize manual queue
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {[
          { num: 1, title: 'Details' },
          { num: 2, title: 'Recipients' },
          { num: 3, title: 'Compose Message' },
          { num: 4, title: 'Review & Launch' },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s.num
                  ? 'bg-emerald-600 text-white'
                  : step === s.num
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`hidden sm:inline text-xs font-medium ${
                step >= s.num ? 'text-slate-900 dark:text-white' : 'text-slate-400'
              }`}
            >
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* STEP 1: Campaign Details */}
      {step === 1 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Step 1: Campaign Information
            </h3>
            <p className="text-xs text-slate-500">
              Provide an identifiable name and internal notes for this campaign
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Campaign Name *
              </label>
              <input
                type="text"
                required
                value={campaignDetails.name}
                onChange={(e) =>
                  setCampaignDetails({ ...campaignDetails, name: e.target.value })
                }
                placeholder="e.g. VIP Fall Promo, Weekly Follow-up"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Campaign Description (Optional)
              </label>
              <input
                type="text"
                value={campaignDetails.description}
                onChange={(e) =>
                  setCampaignDetails({ ...campaignDetails, description: e.target.value })
                }
                placeholder="Target objective or purpose of this campaign..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Internal Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={campaignDetails.notes}
                onChange={(e) =>
                  setCampaignDetails({ ...campaignDetails, notes: e.target.value })
                }
                placeholder="Any special remarks for team members..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                if (!campaignDetails.name.trim()) {
                  toast.error('Please enter a campaign name');
                  return;
                }
                setStep(2);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <span>Next: Select Recipients</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Select Recipients */}
      {step === 2 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Step 2: Choose Target Recipients & Consent Filters
            </h3>
            <p className="text-xs text-slate-500">
              Select entire customer categories or pick specific individuals. Suppression filters are enforced automatically.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-xs text-xs font-medium">
            <button
              type="button"
              onClick={() => setRecipientMode('category')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                recipientMode === 'category'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              By Category
            </button>
            <button
              type="button"
              onClick={() => setRecipientMode('individual')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                recipientMode === 'individual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Individual Contacts
            </button>
          </div>

          {/* Category Mode Selection */}
          {recipientMode === 'category' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Select Categories to Include:
                </label>
                {categories.every((c) => (c.customer_count || 0) === 0) && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    Categories have 0 members
                  </span>
                )}
              </div>

              {categories.every((c) => (c.customer_count || 0) === 0) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
                  <span>Your categories currently have 0 contacts. Switch to "Individual Contacts" to choose your directory contacts.</span>
                  <button
                    type="button"
                    onClick={() => setRecipientMode('individual')}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded-lg shrink-0 ml-2"
                  >
                    Switch to Individual
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((c) => {
                  const isChecked = selectedCategoryIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleCategoryToggle(c.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: c.color || '#10b981' }}
                        ></span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {c.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {c.customer_count || 0} contacts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Individual Customer Selection */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Select Customers ({selectedCustomerIds.length} chosen):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCustomerIds.length === allCustomers.length) {
                      setSelectedCustomerIds([]);
                    } else {
                      setSelectedCustomerIds(allCustomers.map((c) => c.id));
                    }
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {selectedCustomerIds.length === allCustomers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {allCustomers.map((cust) => {
                  const isChecked = selectedCustomerIds.includes(cust.id);
                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleCustomerToggle(cust.id)}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-emerald-600"
                        />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {cust.full_name}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {cust.formatted_phone}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500">{cust.category_name || 'No Category'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consent & Exclusion Rules */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Compliance & Suppression Rules:
            </h4>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeSuppressed}
                onChange={(e) => setExcludeSuppressed(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Automatically exclude contacts on Opt-Out / Suppression list (Recommended)
                </span>
                <span className="text-slate-500 text-[11px]">
                  Prevents reaching out to contacts who previously requested to unsubscribe.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyVerifiedConsent}
                onChange={(e) => setOnlyVerifiedConsent(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Strict Mode: Only message contacts with explicitly verified consent
                </span>
                <span className="text-slate-500 text-[11px]">
                  Excludes any contacts whose consent is marked as 'Unverified'.
                </span>
              </div>
            </label>
          </div>

          {/* Real-time Eligible vs Excluded Count Banner */}
          {selectionPreview && (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    {selectionPreview.eligible_count} Eligible Recipients Ready
                  </span>
                  {selectionPreview.excluded_count > 0 && (
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                      ({selectionPreview.excluded_count} contacts excluded by opt-out or consent filters)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (selectionPreview && selectionPreview.eligible_count === 0) {
                  toast.error('No eligible recipients found. Please select categories or adjust consent filters.');
                  return;
                }
                setStep(3);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <span>Next: Compose Message</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Compose Message */}
      {step === 3 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Step 3: Compose Personalized WhatsApp Message
            </h3>
            <p className="text-xs text-slate-500">
              Select a message template or craft a custom message with tags
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Template Selector */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Load Saved Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- Write Custom Message from Scratch --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category || 'General'})
                  </option>
                ))}
              </select>
            </div>

            {/* Variable Pills */}
            <div>
              <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Insert Variables:
              </label>
              <div className="flex flex-wrap gap-2">
                {['name', 'company', 'category', 'phone'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1 transition-colors"
                  >
                    <span>+ &#123;{v}&#125;</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor with WhatsApp Toolbar & Sample Recipient Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">
                  Message Body & Formatting Toolbar *
                </label>
                <WhatsAppMessageEditor
                  value={messageBody}
                  onChange={setMessageBody}
                  headerMediaUrl={headerMediaUrl}
                  onMediaChange={setHeaderMediaUrl}
                  buttons={buttons}
                  onButtonsChange={setButtons}
                  rows={8}
                  showPreview={false}
                  placeholder="Type message text... Use *bold*, _italic_, ~strike~, ```code```"
                />
              </div>

              {/* Sample Recipient Viewer with Real-Time WhatsApp Rendering */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Recipient Preview (Live Rendering)</span>
                  </span>

                  {selectionPreview?.sample_recipients?.length > 1 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        onClick={() =>
                          setPreviewIndex((prev) =>
                            prev === 0 ? selectionPreview.sample_recipients.length - 1 : prev - 1
                          )
                        }
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span>
                        {previewIndex + 1} / {selectionPreview.sample_recipients.length}
                      </span>
                      <button
                        onClick={() =>
                          setPreviewIndex((prev) =>
                            (prev + 1) % selectionPreview.sample_recipients.length
                          )
                        }
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {getMissingVariables().length > 0 && (
                  <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Notice: <strong>{getMissingVariables().join(', ')}</strong> is empty for this recipient and will be blank in their message.
                    </span>
                  </div>
                )}

                <div className="min-h-[260px] p-4 rounded-2xl bg-[#e5ddd5] dark:bg-[#0b141a] border border-slate-200 dark:border-slate-800 flex flex-col justify-end overflow-y-auto">
                  <div className="self-end max-w-[90%] bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-2xl rounded-tr-xs shadow-sm text-xs leading-relaxed overflow-hidden">
                    {/* Header Image if attached */}
                    {headerMediaUrl && (
                      <div className="w-full max-h-48 overflow-hidden bg-black/10">
                        <img
                          src={headerMediaUrl}
                          alt="Campaign Header"
                          className="w-full h-auto object-cover max-h-48"
                        />
                      </div>
                    )}

                    <div className="p-3">
                      {messageBody.trim() ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: renderWhatsAppFormattedText(
                              renderSampleRecipientMessage(),
                              selectionPreview?.sample_recipients?.[previewIndex]
                                ? {
                                    name: selectionPreview.sample_recipients[previewIndex].name,
                                    company: selectionPreview.sample_recipients[previewIndex].company,
                                    category: selectionPreview.sample_recipients[previewIndex].category,
                                    phone: selectionPreview.sample_recipients[previewIndex].formatted_phone,
                                  }
                                : {}
                            ),
                          }}
                        />
                      ) : (
                        <span className="italic text-slate-400">Empty message</span>
                      )}
                      <span className="block text-right text-[10px] text-slate-500 dark:text-emerald-200/80 mt-1">
                        12:00 PM ✓✓
                      </span>
                    </div>

                    {/* Interactive Action Buttons */}
                    {buttons && buttons.length > 0 && (
                      <div className="border-t border-slate-200/60 dark:border-emerald-800/40 divide-y divide-slate-200/60 dark:divide-emerald-800/40 bg-white/40 dark:bg-black/20">
                        {buttons.map((btn, idx) => {
                          const isStop = btn.action === 'stop' || btn.text?.toLowerCase() === 'stop';
                          const isEnquire = btn.action === 'enquire' || btn.text?.toLowerCase() === 'enquire';
                          const isUrl = btn.type === 'url' || btn.url;
                          return (
                            <div
                              key={idx}
                              className="py-2 px-3 text-center text-xs font-medium flex items-center justify-center gap-1.5"
                            >
                              {isStop ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                  🛑 {btn.text} <span className="text-[10px] opacity-75 font-normal">(Opt-Out)</span>
                                </span>
                              ) : isEnquire ? (
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                  🔥 {btn.text} <span className="text-[10px] opacity-75 font-normal">(Capture Lead)</span>
                                </span>
                              ) : isUrl ? (
                                <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                  ↗ {btn.text}
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                  🔘 {btn.text}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {selectionPreview?.sample_recipients?.[previewIndex] && (
                  <p className="text-[11px] text-slate-400 mt-1 truncate">
                    Previewing for: <strong>{selectionPreview.sample_recipients[previewIndex].name}</strong> ({selectionPreview.sample_recipients[previewIndex].formatted_phone})
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!messageBody.trim()) {
                  toast.error('Message body cannot be empty');
                  return;
                }
                setStep(4);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <span>Next: Final Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Final Launch Confirmation */}
      {step === 4 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Step 4: Final Campaign Review & Safety Acknowledgement
            </h3>
            <p className="text-xs text-slate-500">
              Review recipients, personalized message snapshot, and launch to the manual sending queue
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70">
              <span className="text-slate-400 block mb-1">Campaign Name</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {campaignDetails.name}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50">
              <span className="text-emerald-700 dark:text-emerald-300 block mb-1">Total Recipients</span>
              <span className="font-bold text-emerald-600 text-lg">
                {selectionPreview?.eligible_count || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50">
              <span className="text-amber-700 dark:text-amber-300 block mb-1">Excluded Contacts</span>
              <span className="font-bold text-amber-600 text-lg">
                {selectionPreview?.excluded_count || 0}
              </span>
            </div>
          </div>

          {/* Message Snapshot */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
              <span>Message Template Snapshot:</span>
              <span className="text-[10px] text-slate-400 font-normal">Supports WhatsApp markdown and dynamic tags</span>
            </h4>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border overflow-hidden">
              {headerMediaUrl && (
                <div className="w-full max-h-40 bg-black/10 overflow-hidden flex items-center justify-center">
                  <img
                    src={headerMediaUrl}
                    alt="Campaign Header"
                    className="max-h-40 w-auto object-cover"
                  />
                </div>
              )}
              <div className="p-3.5 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderWhatsAppFormattedText(messageBody),
                  }}
                />
              </div>
              {buttons && buttons.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700/60 divide-y divide-slate-200 dark:divide-slate-700/60 bg-slate-100/60 dark:bg-slate-900/40">
                  {buttons.map((btn, idx) => {
                    const isStop = btn.action === 'stop' || btn.text?.toLowerCase() === 'stop';
                    const isEnquire = btn.action === 'enquire' || btn.text?.toLowerCase() === 'enquire';
                    const isUrl = btn.type === 'url' || btn.url;
                    return (
                      <div
                        key={idx}
                        className="py-1.5 px-3 text-center text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        {isStop ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            🛑 {btn.text} <span className="text-[10px] opacity-75 font-normal">(Opt-Out)</span>
                          </span>
                        ) : isEnquire ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            🔥 {btn.text} <span className="text-[10px] opacity-75 font-normal">(Capture Lead)</span>
                          </span>
                        ) : isUrl ? (
                          <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                            ↗ {btn.text}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            🔘 {btn.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Excluded Contacts Table (if any) */}
          {selectionPreview?.excluded_details && selectionPreview.excluded_details.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Sample Excluded Contacts:</span>
              </h4>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-3">Name</th>
                      <th className="py-1.5 px-3">Phone</th>
                      <th className="py-1.5 px-3">Exclusion Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectionPreview.excluded_details.map((ex, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-3 font-medium">{ex.name}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-500">{ex.phone}</td>
                        <td className="py-1.5 px-3 text-amber-600 dark:text-amber-400">{ex.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sandbox Test Mode Card */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <div>
                <span className="font-semibold text-indigo-950 dark:text-indigo-200 text-xs block">
                  🧪 Sandbox Test Mode (Safe Dry-Run to Your Own Number)
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block mt-0.5">
                  When enabled, this broadcast will ONLY send to your test phone number. Zero real customer contacts will be messaged.
                </span>
              </div>
            </label>

            {isTestMode && (
              <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your WhatsApp Phone Number (with Country Code):
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. +1 555 123 4567 or 919876543210"
                  className="w-full sm:w-80 px-3 py-1.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <div
            onClick={() => setConfirmedRisk(!confirmedRisk)}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 text-xs ${
              confirmedRisk
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
            }`}
          >
            <input
              id="confirm-risk-checkbox"
              type="checkbox"
              checked={confirmedRisk}
              onChange={(e) => setConfirmedRisk(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="confirm-risk-checkbox" className="text-slate-700 dark:text-slate-200 leading-normal cursor-pointer flex-1">
              <strong>Safety & Dispatch Acknowledgement:</strong> I understand this application operates strictly via official WhatsApp click-to-chat links. No messages are sent automatically. I will manually review each chat and confirm delivery in the queue.
            </label>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl"
            >
              Back
            </button>
            <button
              onClick={handleCreateCampaign}
              disabled={isCreating || !confirmedRisk}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>{isCreating ? 'Preparing Queue...' : 'Initialize Sending Queue'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
