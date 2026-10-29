import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

export const WhatsAppConnectModal = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [gatewayStatus, setGatewayStatus] = useState({
    status: 'disconnected',
    qrCode: null,
    user: null,
  });
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    const data = await api.getGatewayStatus();
    setGatewayStatus(data);
  };

  useEffect(() => {
    let interval = null;
    if (isOpen) {
      checkStatus();
      interval = setInterval(checkStatus, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await api.connectGateway();
      toast.info('Requesting WhatsApp Web QR code...');
      await checkStatus();
    } catch (err) {
      toast.error('Failed to start WhatsApp Web session');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectGateway();
      toast.success('Disconnected from WhatsApp Web');
      await checkStatus();
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const isConnected = gatewayStatus.status === 'connected';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Link WhatsApp Web Account"
      maxWidth="max-w-md"
    >
      <div className="space-y-5 text-xs text-center">
        {isConnected ? (
          /* Connected State */
          <div className="py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Account Connected!
              </h3>
              <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {gatewayStatus.user?.phone || 'Linked Device'}
              </p>
              <span className="text-[11px] text-slate-400 block mt-1">
                {gatewayStatus.user?.name || 'Session Active'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-left space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-emerald-600">
                <Zap className="w-4 h-4" />
                <span>Automated Dispatch Ready</span>
              </div>
              <p>
                You can now launch automated campaigns directly from this connected number. Messages will be sent automatically with safe delays between each contact.
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect / Unlink Account</span>
            </button>
          </div>
        ) : (
          /* QR Code Scan State */
          <div className="space-y-3">
            {gatewayStatus.qrCode ? (
              <div className="flex flex-col items-center">
                <div className="p-2.5 bg-white rounded-xl shadow-md border-2 border-emerald-500 inline-block mb-2">
                  <img
                    src={gatewayStatus.qrCode}
                    alt="WhatsApp Web QR Code"
                    className="w-44 h-44 sm:w-48 sm:h-48 rounded-lg object-contain block mx-auto"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs mb-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scan QR Code with WhatsApp on your phone</span>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center">
                <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mb-3">
                  <QrCode className="w-12 h-12" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                  Ready to Link WhatsApp Web
                </h4>
                <p className="text-slate-500 max-w-xs mb-4 leading-relaxed">
                  Generate a temporary QR code to link your personal or business WhatsApp to this local software.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{loading ? 'Initializing...' : 'Generate QR Code'}</span>
                </button>
              </div>
            )}

            {/* Step by Step Instructions */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-left space-y-2 text-slate-600 dark:text-slate-300 text-[11px]">
              <span className="font-bold text-slate-900 dark:text-white block">
                How to link your WhatsApp:
              </span>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
                <li>Tap <strong>Menu (Android 3 dots)</strong> or <strong>Settings (iPhone)</strong>.</li>
                <li>Tap <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.</li>
                <li>Point your phone camera at the QR code above.</li>
              </ol>
            </div>
          </div>
        )}

        <div className="pt-2 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border rounded-xl text-xs font-medium">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
