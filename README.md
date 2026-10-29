# WhatsApp Campaign Manager — Free, Local-First Application

A privacy-focused, zero-subscription dashboard for managing customer contacts, audience categories, personalized message templates, and WhatsApp outreach queues.

Built with a **React (Vite) + Tailwind CSS** frontend, a **Python (FastAPI) + SQLite** backend, and an optional **Node.js/Baileys** local linked gateway.

---

## 🌟 Key Architecture & Principles

- **100% Local-First & Zero Paid Subscriptions**: All customer records, campaign history, messages, and analytics remain stored locally on your machine in SQLite (`whatsapp_campaign.db`).
- **Zero AI / Deterministic Business Logic**: No Ollama, no local LLMs, no OpenAI/Anthropic/Gemini APIs, and no AI copilots. All message templates, intent classification, suggestions, and auto-replies use deterministic rule-based algorithms.
- **Dual Sending Modes**:
  - **Manual Click-to-Chat Mode**: Adheres strictly to the official WhatsApp URL standard (`https://wa.me/<number>?text=<url_encoded_text>`). Opening a link pre-fills the message; explicit user confirmation is tracked with timestamps.
  - **Automated Linked-Session Gateway (Baileys)**: Local Node.js background gateway on `127.0.0.1:3050`. Links to your phone via standard WhatsApp Web multi-device QR code. Includes rate pacing, bounded retry limits, state persistence, and webhook security.
- **Strict Webhook Security**: Gateway-to-backend webhooks require `X-Gateway-Secret` authentication.
- **Relational Integrity & Auto-Migrations**: SQLite foreign-key enforcement is enabled on all connections. Database migrations run automatically on startup to update schemas without data loss. Full database integrity verified via `PRAGMA integrity_check`.
- **Consent & Compliance Guardrails**: Opt-out keywords (`STOP`, `UNSUBSCRIBE`) automatically flag contacts as suppressed, block further campaign queueing, log audit trails in `consent_audit_logs`, and cannot be overridden by routine CSV imports.

---

## 🚀 Quick Start (Windows)

### Option A: One-Click Startup (Recommended)

Simply double-click:
```cmd
start.bat
```
or run in PowerShell:
```powershell
.\start.ps1
```

This launches all three services bound to loopback:
1. **Backend API**: `http://127.0.0.1:8090` (FastAPI + SQLite)
2. **WhatsApp Gateway**: `http://127.0.0.1:3050` (Baileys Multi-Device)
3. **Frontend Dashboard**: `http://localhost:5180` (React Vite)

---

### Option B: Manual Startup

#### Prerequisites
1. **Python 3.10+**: Download from [python.org](https://www.python.org/downloads/) (ensure *"Add python.exe to PATH"* is checked).
2. **Node.js 18+ & npm**: Download from [nodejs.org](https://nodejs.org/).

#### 1. Backend Setup (PowerShell Window 1)
```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software"
.\backend\venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 127.0.0.1 --port 8090
```

#### 2. WhatsApp Gateway Setup (PowerShell Window 2)
```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software\whatsapp-gateway"
node server.js
```

#### 3. Frontend Setup (PowerShell Window 3)
```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software\frontend"
npm run dev
```

Navigate to **`http://localhost:5180/`** in your browser.

---

## 🧪 Automated Test Suite

The backend includes a comprehensive 34-test suite covering:
- Database backup/restore CRM persistence and foreign-key constraints
- CSV formula sanitization and opt-out suppression safeguards
- Webhook `X-Gateway-Secret` authentication enforcement
- Customer lead stage serialization and query filtering
- Deterministic copywriting and intent rules engine (zero AI)
- Campaign recipient unique constraints and queue state transitions
- Phone number normalization (E.164 and international formats)
- Dynamic template variable extraction and rendering

To run all tests:
```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software"
.\backend\venv\Scripts\pytest backend/tests -v
```

**Result:** `34 passed in ~2.5s`

---

## 📁 Repository Structure

```
whatsapp-campaign-manager/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI endpoints (customers, campaigns, analytics, crm, ai, etc.)
│   │   ├── models/          # SQLAlchemy relational models
│   │   ├── providers/       # Baileys & Cloud API provider abstractions
│   │   ├── schemas/         # Pydantic v2 schemas
│   │   ├── services/        # Business logic & DeterministicRulesService
│   │   ├── database.py      # SQLite connection, FK pragmas & auto-migrations
│   │   └── main.py          # FastAPI application entrypoint & default seeders
│   ├── tests/               # 34 automated unit and integration tests
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components, modals, sidebar, navbar
│   │   ├── context/         # ToastContext & ThemeContext
│   │   ├── pages/           # Overview, Customers, CampaignWizard, Inbox, Tasks, Analytics
│   │   └── services/        # Real backend API client (api.js)
│   ├── package.json
│   └── vite.config.js       # Vite configuration with proxy to backend
├── whatsapp-gateway/
│   ├── server.js            # Node.js Baileys multi-device gateway
│   ├── package.json
│   └── active_bulk_job.json # Persisted bulk job state for crash recovery
├── start.bat                # 1-Click Windows batch launcher
├── start.ps1                # 1-Click PowerShell launcher
├── PROJECT_AUDIT.md         # Detailed security, architecture & bug audit
├── PROJECT_STATUS.md        # Real-time resolution report and runtime health
└── README.md
```

---

## 📋 Features & Workflows

### 1. Real-Time Overview Dashboard
- Database-backed metrics: Total Contacts, Active Campaigns, Messages Sent, Inbound Replies, Open Inquiries, and Tasks Due Today.
- Date range filtering (7, 30, 90, 365 days).
- Live customer growth and category distribution charts.

### 2. Contact Management & CSV/Excel Import
- Create, edit, and bulk-tag contacts.
- Assign lead stages (`lead`, `contacted`, `qualified`, `proposal`, `customer`, `churned`).
- Safe CSV/Excel import with auto-detected column mappings and duplicate detection.
- Formula injection protection (CWE-1236) sanitizing cells starting with `=`, `+`, `-`, or `@`.
- Opt-out protection preventing CSV imports from accidentally clearing unsubscriptions.

### 3. Campaign Creation & Multi-Step Wizard
- Step 1: Campaign details and internal notes.
- Step 2: Recipient selection with real-time opt-out count and consent filters.
- Step 3: Template selection with live variable substitution and missing variable warnings.
- Step 4: Final verification and dispatch.

### 4. Sending Modes: Manual vs. Gateway
- **Manual Mode**: Opens personalized WhatsApp Web/Desktop chat via `wa.me` links. Each send is explicitly marked by the user.
- **Gateway Mode**: Automated queue dispatch via linked Baileys session with rate pacing (configurable delay between messages) and state persistence to prevent duplicate sends on restart.

### 5. Inbound Inbox & CRM Follow-Up
- Full conversation history and inbound customer inquiries.
- Categorization of inbound messages (`stop`, `pricing`, `help`, `general`).
- Follow-up task creation with due dates, priorities, and status tracking.

### 6. Backup & Restore
- Full JSON database export covering customers, categories, campaigns, recipients, conversations, messages, follow-up tasks, and consent audit logs.
- Safe restore executed in topological foreign-key order inside an atomic SQLite transaction.

---

## 🔒 Security & Privacy Notice

1. **Local-First Boundary**: Customer data, contact phone numbers, and messages are processed strictly on `127.0.0.1` and are never sent to external servers or cloud AI providers.
2. **Safe Outreach Standards**: Respect recipient consent at all times. This software does not implement evasion techniques, CAPTCHA bypass, or account rotation workarounds.
3. **Gateway Secret**: Always maintain a strong secret in `GATEWAY_WEBHOOK_SECRET` / `X-Gateway-Secret` to secure inbound webhook communication.

---

## 📄 License

MIT License — Free and open-source for personal and business use.
