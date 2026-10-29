import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Smile,
  Tag,
  CheckCheck,
  Sparkles,
  Info,
  Image,
  Upload,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  PhoneCall,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

// Helper to format WhatsApp markdown into React-safe HTML
export function renderWhatsAppFormattedText(text = '', sampleContext = {}) {
  if (!text) return '';

  // 1. Substitute variables (preserve tag if not provided in context, never fabricate fake names)
  let processed = text
    .replace(/\{name\}/g, sampleContext.name || '{name}')
    .replace(/\{company\}/g, sampleContext.company || '{company}')
    .replace(/\{category\}/g, sampleContext.category || '{category}')
    .replace(/\{phone\}/g, sampleContext.phone || '{phone}');

  // 2. Escape HTML
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Monospace: ```text```
  processed = processed.replace(
    /```([^`]+)```/g,
    '<code class="bg-black/10 dark:bg-white/15 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>'
  );

  // 4. Bold: *text* (word boundary or space aware)
  processed = processed.replace(
    /(^|[\s\W])\*([^*\n]+)\*($|[\s\W])/g,
    '$1<strong>$2</strong>$3'
  );

  // 5. Italic: _text_
  processed = processed.replace(
    /(^|[\s\W])_([^_\n]+)_($|[\s\W])/g,
    '$1<em>$2</em>$3'
  );

  // 6. Strikethrough: ~text~
  processed = processed.replace(
    /(^|[\s\W])~([^~\n]+)~($|[\s\W])/g,
    '$1<del class="opacity-75">$2</del>$3'
  );

  // 7. URLs auto-link styling
  processed = processed.replace(
    /(https?:\/\/[^\s]+)/g,
    '<span class="text-blue-600 dark:text-blue-400 underline font-medium">$1</span>'
  );

  // 8. Line breaks
  processed = processed.replace(/\n/g, '<br />');

  return processed;
}

export const WhatsAppMessageEditor = ({
  value = '',
  onChange,
  headerMediaUrl = '',
  onMediaChange = null,
  buttons = [],
  onButtonsChange = null,
  sampleContext = {},
  placeholder = 'Type your WhatsApp message here...',
  rows = 5,
  showPreview = true,
  recipientName = '',
  allowMedia = true,
  allowButtons = true,
}) => {
  const toast = useToast();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showButtonBuilder, setShowButtonBuilder] = useState(false);

  const displayName = recipientName || sampleContext?.name || '';
  const popularEmojis = ['👋', '✨', '🚀', '💬', '📅', '🎉', '🏷️', '🎁', '✅', '📞', '📍', '💡', '❤️', '🔥'];

  const insertTextAtCursor = (before, after = '') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = before + selected + after;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      el.focus();
      const cursorTarget = start + before.length + selected.length;
      el.setSelectionRange(cursorTarget, cursorTarget);
    }, 10);
  };

  const insertVariable = (tag) => {
    insertTextAtCursor(`{${tag}}`);
  };

  const insertEmoji = (emoji) => {
    insertTextAtCursor(emoji);
  };

  // Image upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await api.uploadMedia(file);
      if (res?.url && onMediaChange) {
        onMediaChange(res.url);
        toast.success('Photo uploaded successfully');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  // Button actions
  const addQuickButton = (type, text, extra = '') => {
    if (!onButtonsChange) return;
    const newBtn = {
      id: Date.now().toString(),
      type, // 'quick_reply' | 'url' | 'call'
      text,
      url: type === 'url' ? (extra || 'https://example.com') : undefined,
      phone: type === 'call' ? (extra || '+1234567890') : undefined,
    };
    onButtonsChange([...buttons, newBtn]);
  };

  const removeButton = (btnId) => {
    if (!onButtonsChange) return;
    onButtonsChange(buttons.filter((b) => b.id !== btnId));
  };

  const updateButtonText = (btnId, newText) => {
    if (!onButtonsChange) return;
    onButtonsChange(
      buttons.map((b) => (b.id === btnId ? { ...b, text: newText } : b))
    );
  };

  const updateButtonUrl = (btnId, newUrl) => {
    if (!onButtonsChange) return;
    onButtonsChange(
      buttons.map((b) => (b.id === btnId ? { ...b, url: newUrl } : b))
    );
  };

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 text-xs">
      {/* Editor Box */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
        {/* Formatting & Media Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-xs">
          {/* Format style buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              title="Bold (*text*)"
              onClick={() => insertTextAtCursor('*', '*')}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors font-bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Italic (_text_)"
              onClick={() => insertTextAtCursor('_', '_')}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Strikethrough (~text~)"
              onClick={() => insertTextAtCursor('~', '~')}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Monospace (```code```)"
              onClick={() => insertTextAtCursor('```', '```')}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors font-mono"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

            {/* Quick Variables */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-medium mr-0.5">Tags:</span>
              <button
                type="button"
                onClick={() => insertVariable('name')}
                className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold transition-colors"
              >
                +&#123;name&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable('company')}
                className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-[10px] font-semibold transition-colors"
              >
                +&#123;company&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable('category')}
                className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 text-[10px] font-semibold transition-colors"
              >
                +&#123;category&#125;
              </button>
            </div>

            {allowMedia && onMediaChange && (
              <>
                <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                <button
                  type="button"
                  onClick={() => setShowMediaInput(!showMediaInput)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    headerMediaUrl
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200'
                      : 'bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span>{headerMediaUrl ? 'Header Photo Added' : '+ Add Photo'}</span>
                </button>
              </>
            )}

            {allowButtons && onButtonsChange && (
              <button
                type="button"
                onClick={() => setShowButtonBuilder(!showButtonBuilder)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  buttons.length > 0
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200'
                    : 'bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{buttons.length > 0 ? `Buttons (${buttons.length})` : '+ Add Buttons'}</span>
              </button>
            )}
          </div>

          {/* Quick Emojis strip */}
          <div className="flex items-center gap-0.5 overflow-x-auto max-w-[180px] sm:max-w-none">
            {popularEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-xs transition-colors shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Media (Photo) Attachment Panel */}
        {allowMedia && onMediaChange && (showMediaInput || headerMediaUrl) && (
          <div className="p-3 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-emerald-600" />
                <span>Header Media (Photo / Product Banner)</span>
              </span>
              {headerMediaUrl && (
                <button
                  type="button"
                  onClick={() => onMediaChange('')}
                  className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Paste Image URL (e.g. https://... or leave blank to upload)"
                value={headerMediaUrl}
                onChange={(e) => onMediaChange(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden"
              />

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Buttons Builder Panel */}
        {allowButtons && onButtonsChange && (showButtonBuilder || buttons.length > 0) && (
          <div className="p-3 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Interactive Buttons (Actions & Tracking)</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addQuickButton('quick_reply', 'ENQUIRE')}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[10px]"
                >
                  + ENQUIRE
                </button>
                <button
                  type="button"
                  onClick={() => addQuickButton('quick_reply', 'STOP')}
                  className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[10px]"
                >
                  + STOP (Opt-out)
                </button>
                <button
                  type="button"
                  onClick={() => addQuickButton('url', 'Shop now', 'https://')}
                  className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-[10px]"
                >
                  + URL Link
                </button>
              </div>
            </div>

            {/* Configured Buttons List */}
            {buttons.length > 0 && (
              <div className="space-y-1.5">
                {buttons.map((btn) => (
                  <div
                    key={btn.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                      {btn.type === 'quick_reply' ? 'Quick Reply' : 'URL Button'}
                    </span>
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => updateButtonText(btn.id, e.target.value)}
                      placeholder="Button Title (e.g. STOP or ENQUIRE)"
                      className="px-2 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex-1 outline-hidden"
                    />
                    {btn.type === 'url' && (
                      <input
                        type="url"
                        value={btn.url || ''}
                        onChange={(e) => updateButtonUrl(btn.id, e.target.value)}
                        placeholder="https://yourstore.com"
                        className="px-2 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex-1 outline-hidden"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeButton(btn.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Remove Button"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden resize-y leading-relaxed font-sans placeholder:text-slate-400"
        />

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>{value.length} characters</span>
            <span>•</span>
            <span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Use <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">*bold*</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">_italic_</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">~strike~</code>
          </span>
        </div>
      </div>

      {/* Live WhatsApp Chat Bubble Preview (Matching User Screenshot) */}
      {showPreview && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/70 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp Message Preview {displayName ? `(${displayName})` : ''}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Live Simulation</span>
          </div>

          {/* Authentic WhatsApp Chat Background */}
          <div className="p-4 rounded-xl bg-[#e5ddd5] dark:bg-[#0b141a] bg-opacity-70 dark:bg-opacity-90 min-h-[120px] flex flex-col justify-end">
            <div className="max-w-[85%] sm:max-w-[70%] self-end">
              <div className="relative rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] shadow-sm text-xs leading-relaxed overflow-hidden">
                {/* Header Media Image Banner */}
                {headerMediaUrl && (
                  <div className="relative w-full max-h-48 overflow-hidden bg-slate-200 dark:bg-slate-800">
                    <img
                      src={headerMediaUrl}
                      alt="Header Preview"
                      className="w-full h-44 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Message Body Content */}
                <div className="px-3.5 py-2.5">
                  {value.trim() ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderWhatsAppFormattedText(value, sampleContext),
                      }}
                    />
                  ) : (
                    <span className="italic text-slate-400 dark:text-slate-400 text-xs">
                      Message preview will appear here as you type...
                    </span>
                  )}

                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500 dark:text-emerald-200/80">
                    <span>{currentTime}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  </div>
                </div>

                {/* Interactive Action Buttons (WhatsApp native card buttons) */}
                {buttons && buttons.length > 0 && (
                  <div className="border-t border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10 bg-white/40 dark:bg-black/20">
                    {buttons.map((btn) => (
                      <div
                        key={btn.id}
                        className="py-2 px-3 text-center text-xs font-semibold text-[#00a884] dark:text-[#00a884] flex items-center justify-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        {btn.type === 'url' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : btn.text.toUpperCase().includes('STOP') ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5" />
                        )}
                        <span>{btn.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
