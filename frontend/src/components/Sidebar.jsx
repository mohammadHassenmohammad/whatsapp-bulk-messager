import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderTree,
  Send,
  FileText,
  History,
  BarChart3,
  Settings,
  MessageSquare,
  ShieldCheck,
  Zap,
  BookOpen,
  Flame,
  CheckSquare,
  X
} from 'lucide-react';
import { useQuickChat } from '../context/QuickChatContext';
import { api } from '../services/api';

export const Sidebar = ({ isOpen, onClose }) => {
  const { openQuickChat, openComplianceGuide } = useQuickChat();
  const [inquiryCounts, setInquiryCounts] = useState({ total: 0, new: 0 });

  useEffect(() => {
    const fetchCounts = () => {
      api.getInquiryCounts()
        .then((res) => setInquiryCounts(res || { total: 0, new: 0 }))
        .catch(() => {});
    };
    fetchCounts();
    const timer = setInterval(fetchCounts, 10000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Contacts & Leads', to: '/customers', icon: Users },
    {
      name: 'Inbox',
      to: '/inbox',
      icon: MessageSquare,
      badge: inquiryCounts.new > 0 ? `${inquiryCounts.new} new` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    },
    { name: 'Campaigns', to: '/campaigns', icon: Send },
    { name: 'Templates', to: '/templates', icon: FileText },
    { name: 'Reports', to: '/reports', icon: BarChart3 },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-md shadow-emerald-500/20">
            <MessageSquare className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight block">
              WhatsApp
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase block">
              Campaign Manager
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3.5">
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Quick Tools Separator */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Quick Tools
          </span>
        </div>

        <button
          onClick={() => {
            if (onClose) onClose();
            openQuickChat();
          }}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all text-left"
        >
          <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Quick WhatsApp</span>
        </button>

        <button
          onClick={() => {
            if (onClose) onClose();
            openComplianceGuide();
          }}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all text-left"
        >
          <BookOpen className="w-5 h-5 text-slate-500 shrink-0" />
          <span>Outreach Guide</span>
        </button>
      </nav>

      {/* Local-First & Privacy Badge */}
      <div className="p-4 m-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Local SQLite Mode</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
          Zero API subscription fees. All customer records stored locally.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
