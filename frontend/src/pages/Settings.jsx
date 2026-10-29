import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Trash2,
  Save,
  Moon,
  Sun,
  ShieldAlert,
  HardDrive,
  CheckCircle2,
  FileJson
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from '../components/Modal';

export const Settings = () => {
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [settings, setSettings] = useState({
    app_name: 'WhatsApp Campaign Manager',
    default_country_code: '1',
    default_signature: '\n\nBest regards,\nCustomer Support Team',
    default_consent_status: 'unverified',
    auto_open_tab: 'true',
  });

  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Backup & Restore
  const [isRestoring, setIsRestoring] = useState(false);

  // Database Wipe Modal
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeInput, setWipeInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Provider Abstraction State
  const [activeProvider, setActiveProvider] = useState('baileys');
  const [availableProviders, setAvailableProviders] = useState([]);
  const [providerHealth, setProviderHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [cloudConfig, setCloudConfig] = useState({
    phone_number_id: '',
    access_token: '',
    waba_id: '',
    verify_token: '',
  });
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings((prev) => ({ ...prev, ...res.settings }));
      setDbInfo(res.db_info);

      setCloudConfig({
        phone_number_id: res.settings?.whatsapp_cloud_phone_number_id || '',
        access_token: res.settings?.whatsapp_cloud_access_token || '',
        waba_id: res.settings?.whatsapp_cloud_waba_id || '',
        verify_token: res.settings?.whatsapp_cloud_verify_token || '',
      });

      try {
        const provData = await api.getProviders();
        if (provData) {
          setActiveProvider(provData.active_provider || 'baileys');
          setAvailableProviders(provData.providers || []);
        }
      } catch (e) {}
    } catch (err) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchProvider = async (providerId) => {
    try {
      await api.switchProvider(providerId);
      setActiveProvider(providerId);
      toast.success(`Switched active transport provider to ${providerId === 'cloud_api' ? 'Official Meta Cloud API' : 'Baileys WhatsApp Gateway'}`);
      checkProviderHealth();
    } catch (e) {
      toast.error(e.message || 'Failed to switch provider');
    }
  };

  const checkProviderHealth = async () => {
    setCheckingHealth(true);
    try {
      const data = await api.getProviderHealth();
      setProviderHealth(data);
      if (data.health?.connected) {
        toast.success(`Provider is online and connected (${data.health.provider})`);
      } else {
        toast.info(`Provider status: ${data.health?.status || 'disconnected'}`);
      }
    } catch (e) {
      toast.error('Failed to check provider health');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleSaveCloudConfig = async (e) => {
    e.preventDefault();
    setIsSavingCloud(true);
    try {
      await api.saveCloudApiConfig(cloudConfig);
      toast.success('Meta Cloud API credentials saved successfully!');
      checkProviderHealth();
    } catch (e) {
      toast.error(e.message || 'Failed to save Cloud API credentials');
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp_campaign_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded successfully!');
    } catch (err) {
      toast.error(err.message || 'Backup export failed');
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restoring will replace existing customers, categories, and campaigns. Do you want to continue?')) {
      return;
    }

    setIsRestoring(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.restoreBackup(formData);
      toast.success(`Restored: ${res.customers_restored} customers, ${res.categories_restored} categories, ${res.campaigns_restored} campaigns.`);
      loadSettings();
    } catch (err) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const handleWipeDatabase = async () => {
    if (wipeInput !== 'CLEAR ALL DATA') {
      toast.error('Confirmation text does not match "CLEAR ALL DATA"');
      return;
    }

    setIsWiping(true);
    try {
      await api.resetAllData('CLEAR ALL DATA');
      toast.success('Database has been completely wiped.');
      setWipeModalOpen(false);
      setWipeInput('');
      loadSettings();
    } catch (err) {
      toast.error(err.message || 'Failed to reset database');
    } finally {
      setIsWiping(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          System Preferences & Local Storage
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure default dispatch rules, manage your local SQLite database, and download JSON backups
        </p>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            General Preferences
          </h3>
          <p className="text-xs text-slate-500">
            Customize branding, default calling codes, and signatures
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Application Name / Brand
            </label>
            <input
              type="text"
              value={settings.app_name}
              onChange={(e) => setSettings({ ...settings, app_name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Default Country Calling Code (Digits)
            </label>
            <input
              type="text"
              value={settings.default_country_code}
              onChange={(e) => setSettings({ ...settings, default_country_code: e.target.value })}
              placeholder="1 (US), 91 (India), 44 (UK)..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white outline-hidden"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Default Message Signature (Appended to templates when desired)
          </label>
          <textarea
            rows={3}
            value={settings.default_signature}
            onChange={(e) => setSettings({ ...settings, default_signature: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-white font-mono text-xs outline-hidden resize-none"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>

      {/* Messaging Provider Architecture Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Messaging Transport Provider Abstraction
            </h3>
            <p className="text-xs text-slate-500">
              Choose between the free local Baileys gateway and the Official Meta WhatsApp Business Platform
            </p>
          </div>
          <button
            type="button"
            onClick={checkProviderHealth}
            disabled={checkingHealth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all"
          >
            <span>{checkingHealth ? 'Checking...' : 'Check Connection Health'}</span>
          </button>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Baileys */}
          <div
            onClick={() => handleSwitchProvider('baileys')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 ${
              activeProvider === 'baileys'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                WhatsApp Web Gateway (Baileys)
              </span>
              {activeProvider === 'baileys' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Zero subscription fees. Connects via QR code using your own mobile WhatsApp app. Ideal for direct sales, manual outreach queues, and paced broadcasts.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Free</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Anti-Ban Pacing</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Buttons Supported</span>
            </div>
          </div>

          {/* Cloud API */}
          <div
            onClick={() => handleSwitchProvider('cloud_api')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 ${
              activeProvider === 'cloud_api'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                Official Meta Cloud API
              </span>
              {activeProvider === 'cloud_api' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Official enterprise solution hosted by Meta. Unlimited sending throughput, green badge support, and official webhooks. Requires pre-approved templates.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Enterprise SLA</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">24h Window</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">Meta Verified</span>
            </div>
          </div>
        </div>

        {/* Health status banner */}
        {providerHealth && (
          <div className={`p-3.5 rounded-xl text-xs border ${
            providerHealth.health?.connected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-200'
          }`}>
            <span className="font-semibold block mb-0.5">
              Provider Connection Status: {providerHealth.health?.status || 'Unknown'}
            </span>
            <span className="text-[11px] block">
              {providerHealth.health?.connected
                ? `Active provider (${providerHealth.health?.provider}) is connected and healthy.`
                : providerHealth.health?.message || providerHealth.health?.error || 'Provider is currently offline or unconfigured.'}
            </span>
          </div>
        )}

        {/* Meta Cloud API Configuration Fields */}
        <form onSubmit={handleSaveCloudConfig} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            Meta WhatsApp Cloud API Configuration
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phone Number ID
              </label>
              <input
                type="text"
                value={cloudConfig.phone_number_id}
                onChange={(e) => setCloudConfig({ ...cloudConfig, phone_number_id: e.target.value })}
                placeholder="e.g. 109827364512938"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white outline-hidden font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp Business Account ID (WABA)
              </label>
              <input
                type="text"
                value={cloudConfig.waba_id}
                onChange={(e) => setCloudConfig({ ...cloudConfig, waba_id: e.target.value })}
                placeholder="e.g. 293847162534120"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white outline-hidden font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Permanent System User Access Token
            </label>
            <input
              type="password"
              value={cloudConfig.access_token}
              onChange={(e) => setCloudConfig({ ...cloudConfig, access_token: e.target.value })}
              placeholder="EAAGm0PX4ZC..."
              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-white outline-hidden font-mono text-[11px]"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingCloud}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-all shadow-xs"
            >
              {isSavingCloud ? 'Saving...' : 'Save Cloud API Credentials'}
            </button>
          </div>
        </form>
      </div>

      {/* Local SQLite Database Information */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Local SQLite Database
            </h3>
            <p className="text-xs text-slate-500">
              Your customer data and campaign history reside completely in this local file
            </p>
          </div>
        </div>

        {dbInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border">
              <span className="text-slate-400 block mb-0.5">Database Driver</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{dbInfo.type}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border truncate">
              <span className="text-slate-400 block mb-0.5">Storage Location</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 truncate block" title={dbInfo.url}>
                {dbInfo.url}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border">
              <span className="text-slate-400 block mb-0.5">File Size</span>
              <span className="font-semibold text-emerald-600">{dbInfo.size_kb} KB</span>
            </div>
          </div>
        )}
      </div>

      {/* Backup & Restore Section */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Data Backup & Migration
          </h3>
          <p className="text-xs text-slate-500">
            Export all customers, categories, message templates, and campaign history to JSON or restore a previous snapshot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export JSON */}
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Download JSON Backup</span>
          </button>

          {/* Restore JSON */}
          <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{isRestoring ? 'Restoring...' : 'Restore from JSON File'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              disabled={isRestoring}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Danger Zone: Wipe All Data */}
      <div className="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-3">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-bold">Danger Zone: Reset Database</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
          Permanently erase all customers, categories, message templates, and campaign logs from your local SQLite database. This action is irreversible.
        </p>

        <button
          onClick={() => {
            setWipeInput('');
            setWipeModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-sm"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All Local Data</span>
        </button>
      </div>

      {/* Wipe Confirmation Modal */}
      <Modal
        isOpen={wipeModalOpen}
        onClose={() => setWipeModalOpen(false)}
        title="Confirm Total Database Wipe"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200">
            <span className="font-semibold block mb-1">WARNING: IRREVERSIBLE OPERATION</span>
            <span>
              All local records will be deleted immediately. To confirm, type <strong>CLEAR ALL DATA</strong> below:
            </span>
          </div>

          <input
            type="text"
            value={wipeInput}
            onChange={(e) => setWipeInput(e.target.value)}
            placeholder="Type CLEAR ALL DATA to confirm..."
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white outline-hidden"
          />

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button
              onClick={() => setWipeModalOpen(false)}
              className="px-4 py-2 border rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleWipeDatabase}
              disabled={wipeInput !== 'CLEAR ALL DATA' || isWiping}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold disabled:opacity-40"
            >
              {isWiping ? 'Erasing Data...' : 'Permanently Wipe Database'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
