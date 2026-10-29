import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { QuickChatProvider } from './context/QuickChatContext';
import { DashboardLayout } from './layouts/DashboardLayout';

import { Overview } from './pages/Overview';
import { Customers } from './pages/Customers';
import { ImportContacts } from './pages/ImportContacts';
import { Categories } from './pages/Categories';
import { Templates } from './pages/Templates';
import { CampaignWizard } from './pages/CampaignWizard';
import { CampaignQueue } from './pages/CampaignQueue';
import { CampaignHistory } from './pages/CampaignHistory';
import { CampaignDetail } from './pages/CampaignDetail';
import { Inbox } from './pages/Inbox';
import { Tasks } from './pages/Tasks';
import { Inquiries } from './pages/Inquiries';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QuickChatProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<DashboardLayout />}>
                  {/* 1. Overview */}
                  <Route index element={<Overview />} />

                  {/* 2. Contacts & Leads */}
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/import" element={<ImportContacts />} />
                  <Route path="categories" element={<Categories />} />

                  {/* 3. Inbox (Unified 2-Way CRM Messages) */}
                  <Route path="inbox" element={<Inbox />} />
                  <Route path="inquiries" element={<Inbox />} />

                  {/* 4. Campaigns */}
                  <Route path="campaigns" element={<CampaignHistory />} />
                  <Route path="campaigns/new" element={<CampaignWizard />} />
                  <Route path="campaigns/:id/queue" element={<CampaignQueue />} />
                  <Route path="campaigns/history" element={<CampaignHistory />} />
                  <Route path="campaigns/:id" element={<CampaignDetail />} />
                  <Route path="templates" element={<Templates />} />

                  {/* 5. Tasks & Automations */}
                  <Route path="tasks" element={<Tasks />} />

                  {/* 6. Reports */}
                  <Route path="reports" element={<Analytics />} />
                  <Route path="analytics" element={<Analytics />} />

                  {/* 7. Settings */}
                  <Route path="settings" element={<Settings />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </QuickChatProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
