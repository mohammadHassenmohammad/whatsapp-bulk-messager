import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  Send,
  MessageSquare,
  CheckCheck,
  SkipForward,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';

export const Analytics = () => {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics(days);
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#64748b'];

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const {
    total_customers,
    verified_consent_count,
    unverified_consent_count,
    opted_out_count,
    total_categories,
    total_campaigns,
    total_chats_opened,
    total_confirmed_sents,
    total_delivered = 0,
    total_read = 0,
    total_inquiries = 0,
    new_inquiries = 0,
    total_skipped,
    customer_growth,
    category_distribution,
    campaign_timeline,
  } = data || {};

  const funnelData = [
    { name: 'Dispatched', count: total_confirmed_sents || 0, fill: '#3b82f6' },
    { name: 'Delivered (✓✓)', count: total_delivered || 0, fill: '#10b981' },
    { name: 'Read (Blue Tick)', count: total_read || 0, fill: '#06b6d4' },
    { name: 'Leads / Replies', count: total_inquiries || 0, fill: '#8b5cf6' },
  ];

  const consentData = [
    { name: 'Verified Consent', count: verified_consent_count || 0, fill: '#10b981' },
    { name: 'Unverified', count: unverified_consent_count || 0, fill: '#f59e0b' },
    { name: 'Opted Out (Suppressed)', count: opted_out_count || 0, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Outreach Analytics & Delivery Tracking
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time delivery receipts (✓✓), blue ticks, lead conversions, and audience health
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          {[
            { label: '7 Days', val: 7 },
            { label: '30 Days', val: 30 },
            { label: '90 Days', val: 90 },
            { label: '1 Year', val: 365 },
          ].map((d) => (
            <button
              key={d.val}
              onClick={() => setDays(d.val)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                days === d.val
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Audience"
          value={total_customers}
          subtext="Locally stored contacts"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Campaigns"
          value={total_campaigns}
          subtext="Executed outreach"
          icon={Send}
          color="purple"
        />
        <StatCard
          title="Dispatched"
          value={total_confirmed_sents}
          subtext="Sent to WhatsApp"
          icon={CheckCheck}
          color="indigo"
        />
        <StatCard
          title="Delivered (✓✓)"
          value={total_delivered}
          subtext="Delivered to device"
          icon={CheckCheck}
          color="teal"
        />
        <StatCard
          title="Read (Blue Tick)"
          value={total_read}
          subtext="Opened by recipient"
          icon={MessageSquare}
          color="amber"
        />
        <StatCard
          title="Leads & Replies"
          value={total_inquiries}
          subtext={`${new_inquiries} pending response`}
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Real-time Tracking Notice */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Info className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-900 dark:text-white block">
            Real-Time Delivery & Consent Tracking:
          </span>
          <p className="leading-relaxed">
            Message delivery events (status 3 = double ticks) and read events (status 4 = blue ticks) are received via the active WhatsApp gateway session and permanently recorded in your local SQLite database. Customers who reply <strong className="text-rose-400">STOP</strong> are immediately set to <strong className="text-rose-400">Opted Out</strong> and excluded from all future campaigns automatically.
          </p>
        </div>
      </div>

      {/* Charts Row 1: Funnel & Customer Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outreach Queue Performance Bar Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Manual Outreach Breakdown
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Chats opened vs confirmed sends vs skipped recipients
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Growth Timeline */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Audience Ingestion Over Time
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            New contact additions during the selected timeframe
          </p>

          <div className="h-64 w-full">
            {customer_growth && customer_growth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={customer_growth}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
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
                    fill="url(#areaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No additions in selected timeframe"
                description="Import contacts or expand your date range."
                className="h-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Consent Breakdown & Category Spread */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consent Status Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Consent & Suppression Status
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Verified permission vs unverified vs opted-out suppression
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={consentData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {consentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Audience Segments
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Customer distribution across organized categories
          </p>

          <div className="h-64 w-full">
            {category_distribution && category_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={category_distribution} layout="vertical">
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    width={100}
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
                  <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No categories"
                description="Assign contacts to categories to visualize segments."
                className="h-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
