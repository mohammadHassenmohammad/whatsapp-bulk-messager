# WhatsApp Campaign Manager — Free, Local-First Web Application

A privacy-focused, zero-subscription dashboard for managing customer contacts, audience categories, personalized message templates, and manual WhatsApp outreach queues.

Built with a **React (Vite) + Tailwind CSS** frontend and a **Python (FastAPI) + SQLite** backend.

---

## 🌟 Key Features

- **Local-First & Zero Paid APIs**: No WhatsApp Cloud API subscription or third-party paid aggregators required. All customer data and campaign records remain stored locally on your machine in SQLite (`whatsapp_campaign.db`).
- **Official Click-to-Chat Format**: Adheres strictly to the official WhatsApp URL standard (`https://wa.me/<number>?text=<url_encoded_text>`).
- **Guided CSV & Excel Importer**: Drag-and-drop file upload, intelligent column mapping auto-detection, phone number normalization, duplicate prevention, and CSV formula injection sanitization.
- **Audience Categorization & Tags**: Group contacts into custom categories (New Leads, VIP, Retail, etc.) with custom color coding and reassignment safeguards.
- **Dynamic Message Templates**: Insert variables such as `{name}`, `{company}`, `{category}`, and `{phone}` with live WhatsApp chat bubble simulation and character count.
- **Multi-Step Campaign Wizard**:
  1. Campaign details and internal notes.
  2. Audience selection with automated opt-out suppression and strict consent filters.
  3. Template composition and real-time per-recipient message preview.
  4. Final review and compliance acknowledgement.
- **Manual Sending Queue**:
  - One-by-one dispatch review cards.
  - One-click launch of WhatsApp Web or desktop with prefilled text.
  - Explicit "Mark as Sent" confirmation with timestamps.
  - "Skip Recipient" and "Cancel Campaign" actions.
- **Campaign History & Detail Reports**: Full timeline records, status tracking (`prepared`, `opened`, `sent`, `skipped`), and downloadable CSV export reports.
- **Analytics & Observability**: Real charts built with Recharts displaying audience growth, category distribution, and queue progress without fabricated delivery or read rates.
- **Backup & Restore**: Instant full JSON database export and schema-validated restore with transaction safety.

---

## ⚠️ Important WhatsApp & Compliance Notice

- **Manual Review Required**: Opening a chat via `wa.me` pre-fills the message in WhatsApp Web or the WhatsApp desktop client. You must review and press the send button in WhatsApp yourself.
- **No Automatic Delivery Guarantees**: Opening a chat or clicking "Mark as Sent" records your manual outreach confirmation in the local database. It does not interface with WhatsApp internal delivery status.
- **Safe Outreach Practices**: WhatsApp enforces platform guidelines against unsolicited spam. Always ensure your contacts have consented to receive messages. This software does not implement CAPTCHA bypass, automation concealment, or account rotation workarounds.

---

## 🚀 Quick Start Guide (Windows PowerShell)

### Prerequisites

Ensure you have installed:
1. **Python 3.10+**: Download from [python.org](https://www.python.org/downloads/) (Check *"Add python.exe to PATH"* during installation).
2. **Node.js 18+ & npm**: Download from [nodejs.org](https://nodejs.org/).

---

### Step 1: Open PowerShell in Project Directory

```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software"
```

---

### Step 2: Set Up Backend (FastAPI + SQLite)

1. Create a Python virtual environment:
   ```powershell
   python -m venv backend\venv
   ```

2. Activate the virtual environment:
   ```powershell
   .\backend\venv\Scripts\Activate.ps1
   ```

3. Install backend dependencies:
   ```powershell
   pip install -r backend\requirements.txt
   ```

4. Run the backend server (runs on `http://127.0.0.1:8090`):
   ```powershell
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8090 --reload
   ```

---

### Step 3: Set Up Frontend (React + Vite)

Open a **second PowerShell window**:

1. Navigate to the `frontend` folder:
   ```powershell
   cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software\frontend"
   ```

2. Install npm packages:
   ```powershell
   npm install
   ```

3. Start the development server (runs on `http://localhost:5180`):
   ```powershell
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5180/
   ```

---

### Step 4: Run WhatsApp Web Gateway (For 100% Automated Background Sending)

Open a **third PowerShell window**:

```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software\whatsapp-gateway"
node server.js
```
*The WhatsApp Web Gateway runs on `http://127.0.0.1:3050`.*

Once running:
1. Click **"Link WhatsApp (QR)"** in the top navigation bar of the web app.
2. Scan the displayed QR code with your phone (WhatsApp → Linked Devices).
3. Once linked, the top bar turns green: `🟢 WhatsApp: +<your_number>`.
4. In any campaign queue, click **"⚡ Start Auto-Send"** to send to all recipients in the background automatically!

---

## 🧪 Running Unit Tests

The backend includes a comprehensive test suite covering phone number normalization, click-to-chat encoding, CSV formula sanitization, personalization rendering, opt-out suppression, queue state transitions, and database backup/restore:

```powershell
cd "c:\Users\mdfay\OneDrive\Desktop\whatsapp software"
.\backend\venv\Scripts\pytest
```

All 14 tests will execute against SQLite in-memory databases with full isolation.

---

## 📁 Project Structure

```
whatsapp-campaign-manager/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (customers, categories, templates, campaigns, analytics, settings)
│   │   ├── models/          # SQLAlchemy database models
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # Business logic (phone_service, template_service, import_service, campaign_service)
│   │   ├── database.py      # SQLite connection & session management
│   │   └── main.py          # FastAPI application entrypoint & default seeders
│   ├── tests/               # Pytest suite
│   ├── requirements.txt     # Python dependencies
│   └── venv/                # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/      # Badges, StatCards, Modals, ConfirmDialogs, Sidebar, Navbar
│   │   ├── context/         # ToastContext & ThemeContext
│   │   ├── layouts/         # DashboardLayout
│   │   ├── pages/           # Overview, Customers, ImportContacts, Categories, Templates, CampaignWizard, CampaignQueue, CampaignHistory, CampaignDetail, Analytics, Settings
│   │   ├── services/        # api.js API client
│   │   ├── App.jsx          # Route configuration
│   │   ├── main.jsx         # React DOM entrypoint
│   │   └── index.css        # Tailwind styling & scrollbars
│   ├── package.json
│   ├── vite.config.js       # Vite config with API proxy
│   └── tailwind.config.js
├── sample_contacts.csv      # Sample spreadsheet for testing imports
├── pytest.ini
├── .env.example
└── README.md
```

---

## 📋 Walkthrough & Usage Workflows

### 1. Importing Contacts from CSV / Excel
- Click **"Import Contacts"** in the top bar or sidebar.
- Upload `sample_contacts.csv` (or your own `.xlsx` file).
- The importer automatically detects columns (`name`, `phone`, `email`, `company`, `category`, `consent`).
- Choose duplicate handling: **Skip** or **Update existing**.
- Click **Execute Import** to review the import summary.

### 2. Creating Custom Categories
- Navigate to **"Categories"**.
- Create custom categories (e.g., "Wholesale Partners", "VIP Leads", "Follow-up Required") and assign colors.
- Categories protect against accidental deletion if customers exist inside them.

### 3. Creating Personalized Message Templates
- Navigate to **"Message Templates"**.
- Click **"New Template"**.
- Click the `+{name}`, `+{company}`, or `+{category}` buttons to insert dynamic tags.
- Watch the live preview update in the simulated WhatsApp chat bubble with instant character counts.

### 4. Running a WhatsApp Campaign
1. Click **"New Campaign"**.
2. Give your campaign a name (e.g., *"VIP Autumn Update"*).
3. Select recipient categories or choose individual contacts.
4. Compose or select a saved template.
5. Review the recipient roster and safety disclaimer.
6. Click **"Initialize Sending Queue"**.

### 5. Manual Sending Queue
- The queue displays each recipient with their personalized message.
- Click **"Open WhatsApp Chat"** to open `https://wa.me/<number>?text=<encoded_text>` in WhatsApp.
- Send the message in WhatsApp.
- Click **"Mark as Sent"** to record the confirmed send timestamp and advance to the next recipient.
- Alternatively, click **"Skip Recipient"** or **"Cancel Campaign"**.

### 6. Backup & Migration
- Go to **"Settings"**.
- Click **"Download JSON Backup"** to save your entire database to a JSON file.
- Use **"Restore from JSON File"** to restore snapshots across machines.

---

## 🔒 Privacy & Security Architecture

1. **Zero External Data Uploads**: Your customer contacts, notes, and messages are processed locally on `localhost`.
2. **Formula Injection Sanitization**: All CSV exports sanitize cells starting with `=`, `+`, `-`, or `@` to neutralize CWE-1236 spreadsheet injection vulnerabilities.
3. **Safe Storage**: SQLite database file is stored in the local application directory and is never served over static routes.
4. **URL Encoding**: Click-to-chat links use strict RFC 3986 percent-encoding via `urllib.parse.quote(safe='')` to avoid link malformation.

---

## 📄 License

MIT License — Free and open-source for personal and commercial usage.
