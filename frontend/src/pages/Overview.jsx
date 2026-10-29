import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  FolderTree,
  Send,
  MessageSquare,
  CheckCheck,
  UserPlus,
  Upload,
  FilePlus,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Zap,
  BookOpen,
  Flame,
  Clock,
  Ban
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { api } from '../services/api';
import { useQuickChat } from '../context/QuickChatContext';
import { StatCard } from '../components/StatCard';
import { CampaignStatusBadge, ConsentBadge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export const Overview = () => {
  const { openQuickChat, openComplianceGuide } = useQuickChat();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData(days);
  }, [days]);

  const fetchDashboardData = async (selectedDays = 30) => {
    try {
      setLoading(true);
      const res = await api.getAnalytics(selectedDays);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <h3 className="font-semibold text-sm">Failed to connect to backend server</h3>
        </div>
        <p className="text-xs text-rose-600 dark:text-rose-300 mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    total_customers = 0,
    eligible_contacts_count = 0,
    verified_consent_count = 0,
    total_categories = 0,
    total_campaigns = 0,
    active_campaigns_count = 0,
    total_chats_opened = 0,
    total_confirmed_sents = 0,
    total_delivered = 0,
    total_read = 0,
    total_replied = 0,
    total_skipped = 0,
    total_failed = 0,
    total_inquiries = 0,
    new_inquiries = 0,
    tasks_due_today = 0,
    tasks_overdue = 0,
    customer_growth = [],
    category_distribution = [],
    recent_campaigns = [],
    recent_customers = [],
    recent_inquiries = [],
  } = data || {};

  const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Welcome & Quick Action Shortcuts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold tracking-tight">
              WhatsApp Outreach Hub
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Local SQLite Database
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Deterministic, privacy-respecting contact management, personalized outreach queues, and real delivery tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value={7} className="bg-slate-900 text-white">Last 7 Days</option>
              <option value={30} className="bg-slate-900 text-white">Last 30 Days</option>
              <option value={90} className="bg-slate-900 text-white">Last 90 Days</option>
              <option value={365} className="bg-slate-900 text-white">Last 365 Days</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => openQuickChat()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-sm"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Quick Send</span>
          </button>
          <Link
            to="/customers/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-all shadow-sm"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Contacts</span>
          </Link>
          <Link
            to="/campaigns/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid - Complete Real Data from SQLite */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
        <StatCard
          title="Total Contacts"
          value={total_customers}
          subtext="In local database"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Eligible Contacts"
          value={eligible_contacts_count}
          subtext="Consent & unsuppressed"
          icon={ShieldCheck}
          color="emerald"
        />
        <StatCard
          title="Active Campaigns"
          value={active_campaigns_count}
          subtext={`Of ${total_campaigns} total`}
          icon={Send}
          color="indigo"
        />
        <StatCard
          title="Messages Sent"
          value={total_confirmed_sents}
          subtext="Accepted by provider"
          icon={CheckCheck}
          color="teal"
        />
        <StatCard
          title="Delivered / Read"
          value={`${total_delivered} / ${total_read}`}
          subtext="Verified receipts"
          icon={MessageSquare}
          color="amber"
        />
        <StatCard
          title="Inbound Inquiries"
          value={total_inquiries}
          subtext={`${new_inquiries} open / new`}
          icon={Flame}
          color="purple"
        />
        <StatCard
          title="Tasks Due / Late"
          value={`${tasks_due_today} / ${tasks_overdue}`}
          subtext="Today vs overdue"
          icon={Clock}
          color="rose"
        />
        <StatCard
          title="Failed / Skipped"
          value={`${total_failed} / ${total_skipped}`}
          subtext="Errors & opt-outs"
          icon={Ban}
          color="slate"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Growth Over Time */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Customer Additions (Last 30 Days)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New contacts added or imported locally
              </p>
            </div>
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>

          <div className="h-64 w-full">
            {customer_growth && customer_growth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={customer_growth}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#growthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No trend data yet"
                description="Import contacts or add customers to see registration trends."
                className="h-full"
              />
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
            Category Distribution
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Audience spread across groups
          </p>

          <div className="h-64 w-full">
            {category_distribution && category_distribution.some((c) => c.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={category_distribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {category_distribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={FolderTree}
                title="No category members"
                description="Categorize contacts to see distribution charts."
                className="h-full"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {category_distribution?.slice(0, 4).map((c, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: c.color || PIE_COLORS[idx % PIE_COLORS.length] }}
                ></span>
                <span>{c.name} ({c.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Campaigns & Recent Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Campaigns
            </h3>
            <Link
              to="/campaigns/history"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recent_campaigns && recent_campaigns.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent_campaigns.map((cmp) => (
                <div key={cmp.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <Link
                      to={`/campaigns/${cmp.id}`}
                      className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      {cmp.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{cmp.total_recipients} recipients</span>
                      <span>•</span>
                      <span>{cmp.sent_count} confirmed sent</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CampaignStatusBadge status={cmp.status} />
                    <Link
                      to={`/campaigns/${cmp.id}`}
                      className="text-xs px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description="Create your first campaign to begin reaching out."
              actionLabel="Create Campaign"
              onAction={() => window.location.href = '#/campaigns/new'}
            />
          )}
        </div>

        {/* Recent Customers */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recently Added Customers
            </h3>
            <Link
              to="/customers"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recent_customers && recent_customers.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent_customers.map((c) => (
                <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                      {c.full_name}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{c.formatted_phone}</span>
                      <span>•</span>
                      <span className="text-slate-400">{c.category || 'General'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConsentBadge status={c.consent_status} />
                    <button
                      type="button"
                      onClick={() =>
                        openQuickChat({
                          customer: {
                            id: c.id,
                            full_name: c.full_name,
                            phone: c.phone || c.formatted_phone,
                            formatted_phone: c.formatted_phone,
                            company: c.company,
                            category_name: c.category,
                          },
                        })
                      }
                      title="Send WhatsApp message"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add or import contacts to manage your audience."
              actionLabel="Import Contacts"
              onAction={() => window.location.href = '#/customers/import'}
            />
          )}
        </div>
      </div>

      {/* Live Inquiries & Replies Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Leads & Customer Replies
            </h3>
            {new_inquiries > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {new_inquiries} new
              </span>
            )}
          </div>
          <Link
            to="/inquiries"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>View All Leads & Opt-Outs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recent_inquiries && recent_inquiries.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent_inquiries.map((inq) => (
              <div key={inq.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {inq.customer_name || 'Customer'}
                    </span>
                    <span className="text-xs font-mono text-emerald-500">{inq.phone}</span>
                    {inq.inquiry_type === 'enquire' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Flame className="w-3 h-3 text-emerald-400" />
                        Lead
                      </span>
                    ) : inq.inquiry_type === 'stop' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <Ban className="w-3 h-3 text-rose-400" />
                        Opted Out
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400">
                        <MessageSquare className="w-3 h-3" />
                        Reply
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 max-w-2xl">
                    "{inq.message_text}"
                  </p>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(inq.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      openQuickChat({
                        phone: inq.phone,
                        customer: {
                          full_name: inq.customer_name,
                          phone: inq.phone,
                        },
                        message: inq.inquiry_type === 'enquire'
                          ? `Hello ${inq.customer_name}, thank you for reaching out regarding our offer! How can I help you today?`
                          : `Hello ${inq.customer_name}, how can I help you today?`,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>Reply</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No leads or replies yet"
            description="When customers reply to campaigns or tap interactive template buttons (like ENQUIRE or STOP), their details and messages will stream here in real-time."
          />
        )}
      </div>
    </div>
  );
};
