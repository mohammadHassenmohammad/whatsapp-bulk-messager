import React from 'react';
import {
  ShieldCheck,
  Zap,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  HelpCircle,
  Smartphone,
  Lock,
  Send
} from 'lucide-react';
import { Modal } from './Modal';

export const ComplianceGuideModal = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="WhatsApp Outreach Guide & Best Practices"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 text-xs leading-relaxed max-h-[75vh] overflow-y-auto pr-1">
        {/* Intro Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-700 dark:text-emerald-300 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Privacy-First & Free: How This Software Works</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            This application is 100% local. Your customer records and campaign histories stay safely on your computer in SQLite (<code className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">whatsapp_campaign.db</code>). You pay zero per-message fees or cloud subscription costs.
          </p>
        </div>

        {/* Section 1: Two Ways to Send */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Two Ways to Send Messages</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mode A: Direct 1-Click Send */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                <Send className="w-4 h-4 text-emerald-500" />
                <span>1. Direct 1-Click Send</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Review individual recipients and click Send to dispatch personalized messages immediately through your connected WhatsApp session.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Instant dispatch without opening external tabs</span>
              </div>
            </div>

            {/* Mode B: Linked WhatsApp Web */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>2. Automated Dispatch (Linked Session)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                Link your phone by scanning the QR code. The software dispatches your campaign queue in the background with randomized human-like delays.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                <Clock className="w-3.5 h-3.5" />
                <span>Hands-free with automated safe delay</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: 5 Golden Rules to Prevent WhatsApp Restrictions */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>5 Golden Rules for Safe WhatsApp Outreach</span>
          </h4>

          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-3 text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block">
                  Keep Safe Delays Between Messages
                </strong>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Always keep at least 4 to 8 seconds delay between messages when auto-sending. Instant blasting flags accounts for robotic activity.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block">
                  Always Personalize Your Messages
                </strong>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Use dynamic tags like <code className="text-emerald-600 font-mono">&#123;name&#125;</code> and <code className="text-emerald-600 font-mono">&#123;company&#125;</code>. Identical bulk copies sent to many numbers trigger spam detection.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block">
                  Warm Up New Numbers Gradually
                </strong>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  If your WhatsApp account or number is new, start with 20–30 messages per day for the first week before increasing volume.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block">
                  Honor Opt-Outs & Verified Consent
                </strong>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  If a customer asks to stop, mark them as 'Opted Out'. The Campaign Wizard will automatically suppress them from future dispatches.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                5
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white block">
                  Encourage Replies
                </strong>
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Two-way conversations demonstrate to WhatsApp that your account is engaging in genuine dialogue, building high account trust.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Formatting & Tags Cheat Sheet */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>WhatsApp Text Formatting Cheat Sheet</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <code className="text-slate-800 dark:text-slate-200 font-mono text-xs block mb-1">
                *bold*
              </code>
              <span className="font-bold text-slate-900 dark:text-white">Bold Text</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <code className="text-slate-800 dark:text-slate-200 font-mono text-xs block mb-1">
                _italic_
              </code>
              <span className="italic text-slate-900 dark:text-white">Italic Text</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <code className="text-slate-800 dark:text-slate-200 font-mono text-xs block mb-1">
                ~strike~
              </code>
              <span className="line-through text-slate-900 dark:text-white">Strikethrough</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <code className="text-slate-800 dark:text-slate-200 font-mono text-xs block mb-1">
                ```code```
              </code>
              <span className="font-mono text-[11px] text-slate-900 dark:text-white">Monospace</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all"
          >
            Got It!
          </button>
        </div>
      </div>
    </Modal>
  );
};
