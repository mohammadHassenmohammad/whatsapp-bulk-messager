import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Moon,
  Sun,
  Plus,
  Search,
  CheckCircle2,
  Database,
  Zap,
  BookOpen,
  MessageSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useQuickChat } from '../context/QuickChatContext';
import { api } from '../services/api';
import { WhatsAppConnectModal } from './WhatsAppConnectModal';

export const Navbar = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { openQuickChat, openComplianceGuide } = useQuickChat();

  const [globalSearch, setGlobalSearch] = useState('');
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsUser, setWsUser] = useState(null);

  useEffect(() => {
    const checkGateway = async () => {
      const data = await api.getGatewayStatus();
      if (data && data.status === 'connected') {
        setIsWsConnected(true);
        setWsUser(data.user);
      } else {
        setIsWsConnected(false);
        setWsUser(null);
      }
    };
    checkGateway();
    const interval = setInterval(checkGateway, 4000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = (pathname) => {
    if (pathname === '/') return 'Overview';
    if (pathname.startsWith('/inquiries')) return 'Leads & Customer Replies';
    if (pathname.startsWith('/customers/import')) return 'Import Contacts';
    if (pathname.startsWith('/customers')) return 'Customers';
    if (pathname.startsWith('/categories')) return 'Categories';
    if (pathname === '/campaigns/new') return 'New Campaign Wizard';
    if (pathname.includes('/queue')) return 'Sending Queue';
    if (pathname.startsWith('/campaigns/history')) return 'Campaign History';
    if (pathname.startsWith('/campaigns')) return 'Campaigns';
    if (pathname.startsWith('/templates')) return 'Message Templates';
    if (pathname.startsWith('/analytics')) return 'Analytics';
    if (pathname.startsWith('/settings')) return 'Settings';
    return 'Dashboard';
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/customers?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      {/* Middle: Global Search */}
      <div className="hidden lg:flex items-center max-w-xs w-full">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers, phones..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-hidden"
          />
        </form>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Send Button */}
        <button
          onClick={() => openQuickChat()}
          title="Send a quick WhatsApp message to any contact or number"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all shadow-xs"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" />
          <span className="hidden sm:inline">Quick Send</span>
        </button>

        {/* Safety & Outreach Guide */}
        <button
          onClick={openComplianceGuide}
          title="Best practices and ban prevention tips"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        >
          <BookOpen className="w-4 h-4 text-slate-500" />
          <span className="hidden md:inline">Guide</span>
        </button>

        {/* WhatsApp Web Session Button */}
        <button
          onClick={() => setConnectModalOpen(true)}
          title={isWsConnected ? `Connected as ${wsUser?.phone}` : 'Click to link WhatsApp Web'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
            isWsConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="max-w-[130px] truncate">
            {isWsConnected ? `${wsUser?.phone || 'Linked'}` : 'Link WhatsApp'}
          </span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Contextual Primary Action */}
        <Link
          to="/campaigns/new"
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Campaign</span>
        </Link>
      </div>

      <WhatsAppConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
    </header>
  );
};
