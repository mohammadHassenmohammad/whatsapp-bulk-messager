import React from 'react';

export const Badge = ({ children, variant = 'neutral', size = 'sm', className = '' }) => {
  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs font-semibold',
  };

  const variants = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    brand: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeStyles[size]} ${variants[variant] || variants.neutral} ${className}`}
    >
      {children}
    </span>
  );
};

export const ConsentBadge = ({ status }) => {
  if (status === 'verified') {
    return <Badge variant="success">Verified Consent</Badge>;
  }
  if (status === 'opted_out') {
    return <Badge variant="danger">Opted Out (Suppressed)</Badge>;
  }
  return <Badge variant="warning">Unverified</Badge>;
};

export const CampaignStatusBadge = ({ status }) => {
  if (status === 'completed') {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === 'in_progress') {
    return <Badge variant="brand">In Progress</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="danger">Cancelled</Badge>;
  }
  return <Badge variant="neutral">Draft</Badge>;
};

export const RecipientStatusBadge = ({ status }) => {
  if (status === 'sent') {
    return <Badge variant="success">Manually Sent</Badge>;
  }
  if (status === 'opened') {
    return <Badge variant="brand">Chat Opened</Badge>;
  }
  if (status === 'skipped') {
    return <Badge variant="neutral">Skipped</Badge>;
  }
  if (status === 'failed') {
    return <Badge variant="danger">Failed</Badge>;
  }
  return <Badge variant="info">Prepared</Badge>;
};
