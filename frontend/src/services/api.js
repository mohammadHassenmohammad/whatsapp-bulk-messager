const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = options.headers || {};

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  // Handle blob or json
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'null') {
      query.append(k, v);
    }
  });
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const api = {
  // Customers
  getCustomers: (params = {}) => request(`/customers${toQueryString(params)}`),
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  bulkCategorize: (customer_ids, category_id) =>
    request('/customers/bulk/categorize', { method: 'POST', body: JSON.stringify({ customer_ids, category_id }) }),
  bulkConsent: (customer_ids, consent_status) =>
    request('/customers/bulk/consent', { method: 'POST', body: JSON.stringify({ customer_ids, consent_status }) }),
  bulkDelete: (customer_ids) =>
    request('/customers/bulk/delete', { method: 'POST', body: JSON.stringify({ customer_ids }) }),
  uploadImportFile: (formData) => request('/customers/import/upload', { method: 'POST', body: formData }),
  confirmImport: (data) => request('/customers/import/confirm', { method: 'POST', body: JSON.stringify(data) }),
  exportCustomersCsvUrl: (categoryId, consentStatus) => {
    const query = new URLSearchParams();
    if (categoryId) query.append('category_id', categoryId);
    if (consentStatus) query.append('consent_status', consentStatus);
    return `${BASE_URL}/customers/export/csv?${query.toString()}`;
  },

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/categories/${id}?${query}`, { method: 'DELETE' });
  },

  // Templates
  getTemplates: (search) => request(`/templates${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (data) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  duplicateTemplate: (id) => request(`/templates/${id}/duplicate`, { method: 'POST' }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  previewTemplate: (body, context) =>
    request('/templates/preview', { method: 'POST', body: JSON.stringify({ body, context }) }),

  // Campaigns
  getCampaigns: (params = {}) => request(`/campaigns${toQueryString(params)}`),
  previewCampaignSelection: (data) =>
    request('/campaigns/preview-selection', { method: 'POST', body: JSON.stringify(data) }),
  createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  getCampaign: (id) => request(`/campaigns/${id}`),
  updateRecipientStatus: (campaignId, recipientId, data) =>
    request(`/campaigns/${campaignId}/recipients/${recipientId}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelCampaign: (id) => request(`/campaigns/${id}/cancel`, { method: 'POST' }),
  deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
  exportCampaignCsvUrl: (id) => `${BASE_URL}/campaigns/${id}/export/csv`,

  // Analytics
  getAnalytics: (days = 30) => request(`/analytics?days=${days}`),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),
  exportBackup: () => request('/settings/backup/export'),
  restoreBackup: (formData) => request('/settings/backup/restore', { method: 'POST', body: formData }),
  resetAllData: (confirmation) =>
    request('/settings/reset', { method: 'POST', body: JSON.stringify({ confirmation }) }),

  // WhatsApp Web Baileys Gateway
  getGatewayStatus: async () => {
    try {
      const res = await fetch('/gateway/api/session/status');
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  },
  connectGateway: async () => {
    const res = await fetch('/gateway/api/session/connect', { method: 'POST' });
    return await res.json();
  },
  disconnectGateway: async () => {
    const res = await fetch('/gateway/api/session/disconnect', { method: 'POST' });
    return await res.json();
  },
  sendDirectSingle: async (phone, message, mediaUrl = null) => {
    const res = await fetch('/gateway/api/messages/send-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, mediaUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send');
    }
    return await res.json();
  },
  sendBulkDirect: async (campaignId, recipients, minDelay = 4, maxDelay = 8) => {
    const res = await fetch('/gateway/api/messages/send-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, recipients, minDelay, maxDelay }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start automated send');
    }
    return await res.json();
  },
  cancelBulkDirect: async () => {
    const res = await fetch('/gateway/api/messages/cancel-bulk', { method: 'POST' });
    return await res.json();
  },
  pauseBulkDirect: async () => {
    const res = await fetch('/gateway/api/messages/pause-bulk', { method: 'POST' });
    return await res.json();
  },
  resumeBulkDirect: async () => {
    const res = await fetch('/gateway/api/messages/resume-bulk', { method: 'POST' });
    return await res.json();
  },
  retryFailedRecipients: (campaignId) => request(`/campaigns/${campaignId}/retry-failed`, { method: 'POST' }),
  getPendingRecipients: (campaignId) => request(`/campaigns/${campaignId}/pending`),

  // Provider Abstraction & Meta Cloud API
  getProviders: () => request('/providers'),
  getProviderHealth: () => request('/providers/health'),
  switchProvider: (provider) => request('/providers/switch', { method: 'POST', body: JSON.stringify({ provider }) }),
  saveCloudApiConfig: (config) => request('/providers/cloud-config', { method: 'POST', body: JSON.stringify(config) }),

  // Media Upload
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to upload image');
    }
    return await res.json();
  },

  // Customer Inquiries & Leads
  getInquiries: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.inquiry_type && params.inquiry_type !== 'all') query.append('inquiry_type', params.inquiry_type);
    if (params.limit) query.append('limit', params.limit);
    return await request(`/inquiries?${query.toString()}`);
  },
  getInquiryCounts: async () => {
    return await request('/inquiries/counts');
  },
  updateInquiryStatus: async (id, status) => {
    return await request(`/inquiries/${id}/status?status=${encodeURIComponent(status)}`, {
      method: 'PUT',
    });
  },
  deleteInquiry: async (id) => {
    return await request(`/inquiries/${id}`, {
      method: 'DELETE',
    });
  },

  // CRM: Follow-Up Tasks
  getTasks: (params = {}) => request(`/crm/tasks${toQueryString(params)}`),
  createTask: (data) => request('/crm/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/crm/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/crm/tasks/${id}`, { method: 'DELETE' }),

  // CRM: 2-Way Conversations & Messaging
  getConversations: (params = {}) => request(`/crm/conversations${toQueryString(params)}`),
  getConversation: (id) => request(`/crm/conversations/${id}`),
  sendConversationReply: (id, data) => request(`/crm/conversations/${id}/reply`, { method: 'POST', body: JSON.stringify(data) }),
  updateConversationStatus: (id, status) => request(`/crm/conversations/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // CRM: Lead Stages & Timelines
  updateCustomerLeadStage: (id, stage) => request(`/crm/customers/${id}/lead-stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
  getCustomerTimeline: (id) => request(`/crm/customers/${id}/timeline`),

  // AI & Local Automation
  getAiStatus: () => request('/ai/status'),
  draftAiTemplate: (data) => request('/ai/draft-template', { method: 'POST', body: JSON.stringify(data) }),
  classifyAiReply: (data) => request('/ai/classify-reply', { method: 'POST', body: JSON.stringify(data) }),
  suggestAiReplies: (data) => request('/ai/suggest-replies', { method: 'POST', body: JSON.stringify(data) }),
  summarizeAiThread: (data) => request('/ai/summarize-thread', { method: 'POST', body: JSON.stringify(data) }),
  runAiInactivityCheck: (data = {}) => request('/ai/run-inactivity-check', { method: 'POST', body: JSON.stringify(data) }),
};

