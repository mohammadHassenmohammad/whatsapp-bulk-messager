import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Settings,
  HelpCircle,
  Check,
  Download,
  FileText,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export const ImportContacts = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1); // 1: Upload, 2: Map & Preview, 3: Configure, 4: Results
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'paste'
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Column Mappings
  const [mappings, setMappings] = useState({
    name_col: '',
    phone_col: '',
    email_col: '',
    company_col: '',
    category_col: '',
    tags_col: '',
    consent_status_col: '',
    notes_col: '',
  });

  // Import Settings
  const [settings, setSettings] = useState({
    default_country_code: '1',
    default_category_id: '',
    default_consent_status: 'unverified',
    on_duplicate: 'skip', // 'skip' or 'update'
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'name,phone,email,company,category,consent_status,tags\n' +
      'Sarah Jenkins,+14155552671,sarah@example.com,Acme Corp,VIP,verified,repeat-buyer\n' +
      'Michael Chang,+919876543210,michael@example.com,Chang Enterprises,Wholesale,verified,lead-2026\n' +
      'Elena Rostova,+447911123456,elena@example.com,Rostova Design,Retail,unverified,inquiry\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_whatsapp_contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded sample CSV template');
  };

  const handleUpload = async () => {
    let targetFile = file;

    if (uploadMode === 'paste') {
      if (!pastedText.trim()) {
        toast.warning('Please paste CSV or tab-separated data first');
        return;
      }
      targetFile = new File([pastedText.trim()], 'pasted_contacts.csv', { type: 'text/csv' });
    } else if (!file) {
      toast.warning('Please select a CSV or Excel file to upload');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', targetFile);

    try {
      const res = await api.uploadImportFile(formData);
      setPreviewData(res);
      // Pre-fill detected mappings
      setMappings((prev) => ({
        ...prev,
        ...res.detected_mappings,
      }));
      setStep(2);
      toast.success(`Loaded spreadsheet with ${res.total_rows} rows`);
    } catch (err) {
      toast.error(err.message || 'File analysis failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProceedToSettings = () => {
    if (!mappings.phone_col) {
      toast.error('You must map the Phone Number column');
      return;
    }
    setStep(3);
  };

  const handleExecuteImport = async () => {
    setIsProcessing(true);
    try {
      const payload = {
        filename: previewData.filename,
        mappings,
        default_country_code: settings.default_country_code,
        default_category_id: settings.default_category_id
          ? parseInt(settings.default_category_id)
          : null,
        default_consent_status: settings.default_consent_status,
        on_duplicate: settings.on_duplicate,
      };

      const res = await api.confirmImport(payload);
      setImportResult(res);
      setStep(4);
      toast.success(`Import complete! ${res.imported_count} imported, ${res.updated_count} updated.`);
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Guided Contact Import
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload spreadsheets, map columns, validate international phone numbers, and deduplicate
        </p>
      </div>

      {/* Stepper Indicator */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {[
          { num: 1, title: 'Upload File' },
          { num: 2, title: 'Map Columns' },
          { num: 3, title: 'Validation & Settings' },
          { num: 4, title: 'Summary' },
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

      {/* STEP 1: Upload or Paste */}
      {step === 1 && (
        <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          {/* Top Bar with Mode Switcher & Download Sample */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  uploadMode === 'file'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Upload File (.csv, .xlsx)
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('paste')}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  uploadMode === 'paste'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Paste Spreadsheet Text
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {uploadMode === 'file' ? (
            /* Drag and Drop File Area */
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30"
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
                <FileSpreadsheet className="w-10 h-10" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {file ? file.name : 'Select or drop your contacts file'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                Supports CSV, Microsoft Excel (.xlsx), and .xls files up to 10MB
              </p>
              <span className="px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                Browse Files
              </span>
            </div>
          ) : (
            /* Direct Text Paste Area */
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Paste CSV or Tab-Separated Rows from Excel / Google Sheets:
              </label>
              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="name,phone,email,company,category&#10;Alex Morgan,+14155552671,alex@example.com,Acme,VIP&#10;Sarah Jenkins,+919876543210,sarah@example.com,Global,Wholesale"
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 outline-hidden leading-relaxed"
              />
              <span className="text-[11px] text-slate-400 block">
                Include headers in the first row (e.g. name, phone, email, category)
              </span>
            </div>
          )}

          {/* Quick Columns Cheat Sheet */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
            <span className="font-bold text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">
              Recommended Columns Reference:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <strong className="text-emerald-600 block">phone (Required)</strong>
                <span className="text-slate-500">e.g. +14155552671</span>
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-300 block">name</strong>
                <span className="text-slate-500">Contact full name</span>
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-300 block">category</strong>
                <span className="text-slate-500">VIP, Wholesale, etc.</span>
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-300 block">company</strong>
                <span className="text-slate-500">Company name</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold block">Consent Responsibility Note:</span>
              <span>
                Importing contacts does NOT grant messaging permission automatically. All imported contacts default to <strong>Unverified</strong> unless explicit opt-in records exist.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={(uploadMode === 'file' && !file) || (uploadMode === 'paste' && !pastedText.trim()) || isUploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              <span>{isUploading ? 'Analyzing Data...' : 'Upload & Preview'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Map Columns & Sample Preview */}
      {step === 2 && previewData && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Map Spreadsheet Columns
              </h3>
              <p className="text-xs text-slate-500">
                Found {previewData.total_rows} rows in file. Match incoming headers to customer fields.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change File</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Phone (Required) */}
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50">
              <label className="block font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                WhatsApp Phone Column * (Required)
              </label>
              <select
                value={mappings.phone_col}
                onChange={(e) => setMappings({ ...mappings, phone_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 font-medium text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- Select Phone Column --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Name Column
              </label>
              <select
                value={mappings.name_col}
                onChange={(e) => setMappings({ ...mappings, name_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- None / Default to Phone --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category / Group Column
              </label>
              <select
                value={mappings.category_col}
                onChange={(e) => setMappings({ ...mappings, category_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- None (Will use default category) --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Name Column
              </label>
              <select
                value={mappings.company_col}
                onChange={(e) => setMappings({ ...mappings, company_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- None --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address Column
              </label>
              <select
                value={mappings.email_col}
                onChange={(e) => setMappings({ ...mappings, email_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- None --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tags Column
              </label>
              <select
                value={mappings.tags_col}
                onChange={(e) => setMappings({ ...mappings, tags_col: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              >
                <option value="">-- None --</option>
                {previewData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* First 5 rows preview table */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Sample Data (First 5 Rows):
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    {previewData.headers.map((h) => (
                      <th key={h} className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewData.sample_rows.map((row, i) => (
                    <tr key={i}>
                      {previewData.headers.map((h) => (
                        <td key={h} className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl"
            >
              Back
            </button>
            <button
              onClick={handleProceedToSettings}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              <span>Next: Validation & Rules</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Validation & Settings */}
      {step === 3 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Validation & Duplicate Handling
            </h3>
            <p className="text-xs text-slate-500">
              Configure how duplicates and phone numbers without international prefixes should be treated
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Duplicate policy */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block">
                When a duplicate phone number is detected:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="radio"
                    name="on_duplicate"
                    value="skip"
                    checked={settings.on_duplicate === 'skip'}
                    onChange={(e) => setSettings({ ...settings, on_duplicate: e.target.value })}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">Skip duplicate</span>
                    <span className="text-[11px] text-slate-500">
                      Preserve existing customer record unchanged
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="radio"
                    name="on_duplicate"
                    value="update"
                    checked={settings.on_duplicate === 'update'}
                    onChange={(e) => setSettings({ ...settings, on_duplicate: e.target.value })}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-white">Update existing</span>
                    <span className="text-[11px] text-slate-500">
                      Overwrite name, company, and category with file values
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Default Country Calling Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Country Calling Code
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 font-mono">
                    +
                  </span>
                  <input
                    type="text"
                    value={settings.default_country_code}
                    onChange={(e) =>
                      setSettings({ ...settings, default_country_code: e.target.value })
                    }
                    placeholder="1 (US/Canada), 91 (India), 44 (UK)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Applied when numbers do not include a country code.
                </span>
              </div>

              {/* Default Category */}
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Category (If not specified in row)
                </label>
                <select
                  value={settings.default_category_id}
                  onChange={(e) =>
                    setSettings({ ...settings, default_category_id: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
                >
                  <option value="">None (Uncategorized)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
              onClick={handleExecuteImport}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm"
            >
              <span>{isProcessing ? 'Importing Rows...' : 'Confirm & Execute Import'}</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Summary Results */}
      {step === 4 && importResult && (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Import Finished Successfully
              </h3>
              <p className="text-xs text-slate-500">
                Processed {importResult.total_processed} rows from your file.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50">
              <span className="text-2xl font-bold text-emerald-600 block">
                {importResult.imported_count}
              </span>
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">New Imported</span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50">
              <span className="text-2xl font-bold text-blue-600 block">
                {importResult.updated_count}
              </span>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Updated</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50">
              <span className="text-2xl font-bold text-amber-600 block">
                {importResult.skipped_count}
              </span>
              <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Skipped (Dups)</span>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50">
              <span className="text-2xl font-bold text-rose-600 block">
                {importResult.failed_count}
              </span>
              <span className="text-xs font-medium text-rose-800 dark:text-rose-300">Failed (Invalid)</span>
            </div>
          </div>

          {/* Errors table if any */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Skipped or Failed Row Details ({importResult.errors.length}):
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importResult.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-1.5 px-3 font-mono">{err.row}</td>
                        <td className="py-1.5 px-3 font-mono">{err.phone || '—'}</td>
                        <td className="py-1.5 px-3 text-slate-500">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData(null);
                setImportResult(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border rounded-xl"
            >
              Import Another File
            </button>
            <Link
              to="/customers"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              View Customers Directory
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
