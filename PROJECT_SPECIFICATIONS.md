# WhatsApp Campaign Manager — Complete Software Specifications & Architecture Document

> **Document Purpose**: This document provides an exhaustive, end-to-end breakdown of the WhatsApp Campaign Manager codebase, including system architecture, database models, frontend interfaces, backend APIs, automation gateway, security mechanisms, and current limitations. It is formatted to be directly shared with AI assistants (such as ChatGPT/Claude) for feature expansion, architectural review, and roadmap generation.

---

## 1. Executive Summary

**WhatsApp Campaign Manager** is a free, local-first, privacy-centric web application designed for small-to-medium businesses, marketers, and sales teams. It enables managing customer contact books, segmenting audiences, crafting personalized dynamic message templates, running multi-step broadcast campaigns, tracking inbound customer replies/inquiries, and dispatching messages via two distinct modes:
1. **Manual Mode**: Compliant, zero-risk Click-to-Chat (`https://wa.me/...`) links opened one by one in WhatsApp Web/Desktop.
2. **Automated Gateway Mode**: Zero-subscription automated background sending powered by an embedded Baileys WhatsApp Web socket gateway with QR-code linking, smart randomized anti-ban delays, delivery status receipts (delivered/read "blue ticks"), and automated keyword responses (`STOP`, `START`, `ENQUIRE`).

All contact data, message contents, and history remain strictly local on the user's computer inside a local SQLite database with zero third-party cloud data exposure.

---

## 2. Technology Stack & System Architecture

### 2.1 Component Breakdown

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|                         React 18 + Vite + Tailwind CSS                            |
|                            (Runs on http://localhost:5180)                        |
+----------------------------------------+------------------------------------------+
                                         |
                       Vite Proxy (/api -> :8090, /gateway -> :3050)
                                         |
        +--------------------------------+--------------------------------+
        |                                                                 |
        v                                                                 v
+-------------------------------+               +----------------------------------+
|      BACKEND API SERVICE      |               |     WHATSAPP GATEWAY SERVICE     |
|   Python 3.10+ / FastAPI      |  Webhooks     |        Node.js / Express         |
|   SQLAlchemy ORM + Pydantic   |<--------------|     @whiskeysockets/baileys      |
|   SQLite Local Database       | (Status/Reply)|  Multi-File Auth Credentials     |
| (Runs on http://127.0.0.1:8090)|               |  (Runs on http://127.0.0.1:3050)  |
+-------------------------------+               +----------------------------------+
```

### 2.2 Technologies Used
- **Frontend**:
  - React 18.3 (Functional components & Hooks)
  - Vite 5.4 (Build tool & dev server with reverse proxying)
  - Tailwind CSS 3.4 (Modern responsive utility styling & custom dark mode tokens)
  - Lucide React (Crisp iconography)
  - Recharts 2.12 (Interactive SVG charts for analytics)
  - React Router DOM 6.26 (Client-side page routing)
- **Backend**:
  - Python 3.10+ with FastAPI (Asynchronous high-performance REST API)
  - SQLAlchemy 2.0 (Relational ORM)
  - SQLite (Zero-configuration local embedded database: `whatsapp_campaign.db`)
  - Pydantic v2 (Input validation and serialization schemas)
  - Uvicorn (ASGI web server)
  - Pytest (Comprehensive test suite)
- **WhatsApp Gateway**:
  - Node.js 18+ & Express
  - `@whiskeysockets/baileys` (Open-source WhatsApp Web protocol implementation)
  - `qrcode` (Terminal & Base64 QR code generator for browser pairing)
  - Multi-file authentication state stored locally in `auth_info_baileys/`

---

## 3. Database Architecture & Data Models

### 3.1 Entity Relationship Summary

The local SQLite schema consists of 7 primary relational tables:

```
[ Categories ] 1 -----< N [ Customers ] 1 -----< N [ CampaignRecipients ] >----- N [ Campaigns ]
                               |                              |
                               |                              +-----< 1 [ MessageTemplates ]
                               v
                     [ CustomerInquiries ]
                               ^
                     [ CampaignActivityLogs ]
                               
                     [ AppSettings ] (Key-Value)
```

### 3.2 Detailed Model Schemas

#### 1. `Category` (`categories`)
- `id` (Integer, Primary Key)
- `name` (String 100, Unique, Indexed): e.g., "VIP Customers", "New Leads", "Retail"
- `description` (String 255, Nullable)
- `color` (String 20): Hex color badge (e.g. `#10b981`, `#3b82f6`)
- `created_at`, `updated_at` (DateTime)
- *Relationships*: `customers` (One-to-Many)

#### 2. `Customer` (`customers`)
- `id` (Integer, Primary Key)
- `full_name` (String 150, Indexed)
- `phone` (String 30, Unique, Indexed): Normalized digits without `+` (E.164 standard)
- `formatted_phone` (String 40): Human-readable formatted string (e.g., `+1 555 123 4567`)
- `email` (String 255, Nullable, Indexed)
- `category_id` (ForeignKey `categories.id`, `SET NULL` on delete)
- `company` (String 150, Nullable)
- `tags` (String 500, Nullable): Comma-separated tag list
- `consent_status` (String 30): `"verified"`, `"unverified"`, or `"opted_out"`
- `consent_source` (String 100, Nullable): e.g., "Web Form", "CSV Import", "In Store"
- `consent_date` (DateTime, Nullable)
- `is_suppressed` (Boolean, Default `False`): Suppression flag for opted-out or blocked numbers
- `notes` (Text, Nullable)
- `created_at`, `updated_at` (DateTime)

#### 3. `MessageTemplate` (`message_templates`)
- `id` (Integer, Primary Key)
- `name` (String 150, Indexed)
- `body` (Text): Content with merge variables (`{name}`, `{company}`, `{category}`, `{phone}`)
- `description` (String 255, Nullable)
- `category` (String 100, Nullable): e.g., "Promotional", "Follow-up", "Transactional"
- `header_type` (String 30, Default `"none"`): `"none"` or `"image"`
- `header_media_url` (Text, Nullable): Relative or public URL to media header
- `buttons_json` (Text, Nullable): JSON array of interactive quick-reply buttons (e.g. `[{"id":"ENQUIRE","text":"ENQUIRE"},{"id":"STOP","text":"STOP"}]`)
- `created_at`, `updated_at` (DateTime)

#### 4. `Campaign` (`campaigns`)
- `id` (Integer, Primary Key)
- `name` (String 150, Indexed)
- `description` (Text, Nullable)
- `notes` (Text, Nullable)
- `template_id` (ForeignKey `message_templates.id`, `SET NULL`)
- `message_body_snapshot` (Text): Snapshot of template text at time of campaign creation
- `header_media_url` (Text, Nullable)
- `buttons_json` (Text, Nullable)
- `status` (String 30): `"draft"`, `"in_progress"`, `"completed"`, `"cancelled"`
- **Aggregated Real-Time Metrics**:
  - `total_recipients` (Integer)
  - `opened_count` (Integer)
  - `sent_count` (Integer)
  - `delivered_count` (Integer — WhatsApp double gray tick)
  - `read_count` (Integer — WhatsApp double blue tick)
  - `replied_count` (Integer — Customers who replied)
  - `opt_out_count` (Integer — Customers who replied STOP)
  - `skipped_count` (Integer)
  - `failed_count` (Integer)
- `created_at`, `updated_at` (DateTime)

#### 5. `CampaignRecipient` (`campaign_recipients`)
- `id` (Integer, Primary Key)
- `campaign_id` (ForeignKey `campaigns.id`, Cascade Delete)
- `customer_id` (ForeignKey `customers.id`, `SET NULL`)
- `recipient_name` (String 150)
- `recipient_phone` (String 30): Clean digits
- `recipient_company` (String 150, Nullable)
- `recipient_category` (String 100, Nullable)
- `personalized_message` (Text): Fully resolved message text with recipient's actual details
- `click_to_chat_url` (Text): Fully percent-encoded RFC 3986 `https://wa.me/...` URL
- `media_url` (Text, Nullable)
- `message_id` (String 100, Nullable, Indexed): WhatsApp message identifier for tracking receipts
- `status` (String 30): `"prepared"`, `"opened"`, `"sent"`, `"delivered"`, `"read"`, `"skipped"`, `"failed"`
- `opened_at`, `confirmed_sent_at`, `delivered_at`, `read_at`, `replied_at`, `skipped_at` (DateTime)
- `reply_text` (Text, Nullable): Text of inbound reply from recipient
- `error_message` (Text, Nullable)
- `notes` (Text, Nullable)

#### 6. `CustomerInquiry` (`customer_inquiries`)
- `id` (Integer, Primary Key)
- `customer_id` (ForeignKey `customers.id`, `SET NULL`)
- `phone` (String 30, Indexed)
- `customer_name` (String 150)
- `inquiry_type` (String 50): `"enquire"`, `"stop"`, `"start"`, `"general_reply"`
- `message_text` (Text)
- `status` (String 30): `"new"`, `"contacted"`, `"resolved"`
- `campaign_id` (Integer, Nullable)
- `created_at`, `updated_at` (DateTime)

#### 7. `CampaignActivityLog` (`campaign_activity_logs`)
- `id` (Integer, Primary Key)
- `campaign_id` (ForeignKey `campaigns.id`, Cascade Delete)
- `recipient_id` (Integer, Nullable)
- `action` (String 50): e.g., `"created"`, `"opened"`, `"marked_sent"`, `"delivered"`, `"read"`, `"replied"`, `"opt_out"`, `"skipped"`
- `details` (Text, Nullable)
- `created_at` (DateTime)

#### 8. `AppSetting` (`app_settings`)
- `key` (String 100, Primary Key)
- `value` (Text)
- `description` (String 255, Nullable)
- `updated_at` (DateTime)

---

## 4. Complete Feature Breakdown

### Module 1: Contact & Audience Directory (`Customers.jsx`)
- **Full-Text Search & Filtering**: Instant search across customer name, phone number, company, and tags. Filter by category or consent status (`verified`, `unverified`, `opted_out`).
- **Safety Toggling**: Single-click toggle to suppress or un-suppress contacts from all future broadcasts.
- **Direct Chat Launcher**: Launch a 1-on-1 WhatsApp chat with any contact instantly with an empty or custom prompt.
- **Contact Details Modal**: Add or update full profile, company, tags, consent source, and free-form customer notes.
- **Export to CSV**: Instant export of all filtered customer records with automatic spreadsheet injection protection (CWE-1236).

### Module 2: CSV & Excel Smart Importer (`ImportContacts.jsx`)
- **Drag-and-Drop File Upload**: Supports both `.csv` and `.xlsx` formats.
- **Intelligent Auto-Mapping**: Automatically detects and pairs column headers with fields (`name`, `phone`, `email`, `company`, `category`, `consent`).
- **Phone Number Normalization Engine**: Strips spaces, dashes, symbols, and adds/validates international country codes (E.164 compliant).
- **Duplicate Handling Rules**: User selects policy:
  - *Skip Duplicates*: Preserves existing record untouched.
  - *Update Existing*: Updates missing fields, tags, and category.
- **Sanitization Against Formula Injection**: Prefixes cells starting with `=`, `+`, `-`, `@` with a single quote `'` to prevent spreadsheet code execution when exported.
- **Real-Time Validation Preview**: Highlights invalid phone numbers, blank fields, and categorized previews before database execution.

### Module 3: Audience Categories (`Categories.jsx`)
- Custom category creation with custom name, description, and visual color palette picker.
- Dynamic contact counter showing real-time distribution across categories.
- Safety check: Prevents deletion of categories currently assigned to contacts without explicit reassignment.

### Module 4: Dynamic Message Template Builder (`Templates.jsx`)
- **Variable Interpolation**: Click-to-insert placeholder buttons:
  - `{name}` — Recipient's full name
  - `{company}` — Recipient's business or organization
  - `{category}` — Audience category label
  - `{phone}` — Contact's phone number
- **Media Header Support**: Attach an image header (`header_type: "image"`) uploaded directly to `/uploads/`.
- **Interactive Quick-Reply Buttons**: Add interactive action buttons (e.g. `ENQUIRE`, `STOP`, `CALL ME`) rendered directly in WhatsApp.
- **Live WhatsApp Bubble Simulation**: Visual preview with WhatsApp green chat bubble, formatted typography, emoji picker support, and live character counter.

### Module 5: Multi-Step Campaign Wizard (`CampaignWizard.jsx`)
1. **Step 1: Campaign Metadata**: Name, internal description, campaign objectives.
2. **Step 2: Audience Selection & Opt-Out Suppression**:
   - Filter by one or more Categories, or pick individual contacts.
   - **Automated Opt-Out Suppression**: Automatically filters out suppressed contacts and contacts who previously sent `STOP`.
3. **Step 3: Template & Personalization Preview**:
   - Select saved template or write custom copy.
   - Carousel view showing exact rendered personalized message for individual recipients before initializing.
4. **Step 4: Safety & Review**:
   - Compliance notice regarding WhatsApp spam guidelines.
   - Dispatch summary and confirmation button to initialize the campaign queue.

### Module 6: Dual-Mode Dispatch Queue (`CampaignQueue.jsx`)

#### Mode A: Compliant Manual Dispatch (Zero Ban Risk)
- Displays individual dispatch cards one by one.
- **"Open WhatsApp Chat" Button**: Opens `https://wa.me/<number>?text=<encoded_text>` in WhatsApp Web or native WhatsApp Desktop.
- **"Mark as Sent" Button**: Confirms outreach, records timestamp, increments metrics, and advances queue.
- **"Skip Recipient" Button**: Allows skipping cold or unready leads with internal reason logging.

#### Mode B: ⚡ Automated Background Gateway Dispatch
- Connects directly to the embedded Baileys Node.js socket.
- **Randomized Anti-Ban Delays**: Configurable pacing (e.g., 8–18 seconds randomized delay between messages) to emulate human sending behavior.
- **Batch Sending**: Automatically handles media header images and interactive quick-reply buttons.
- **Pause / Resume / Cancel Controls**: Real-time control during active bulk jobs.
- **Live Progress Bar**: Dynamic tracking of sent, failed, and remaining queue items.

### Module 7: Inbound WhatsApp Webhook & Auto-Replies (`webhooks.py` + `server.js`)
- Listens to incoming WhatsApp messages and interactive button responses:
  - **`STOP` / `UNSUBSCRIBE` / `OPTOUT`**: Automatically flags the customer as `is_suppressed = True`, updates `consent_status = "opted_out"`, increments campaign opt-out count, and sends confirmation: *"You have been successfully unsubscribed from our updates. Reply START anytime to re-subscribe."*
  - **`START` / `RESUBSCRIBE`**: Re-enables the contact and verifies consent.
  - **`ENQUIRE` / `INTERESTED` / `PRICE` / `INFO`**: Flags recipient as `replied`, increments campaign `replied_count`, creates a record in `CustomerInquiry`, and sends an instant acknowledgment.
  - **General Replies**: Logged to campaign recipient notes and inquiry inbox.

### Module 8: Inquiries & Response Inbox (`Inquiries.jsx`)
- Dedicated inbox displaying all inbound messages, button selections, and customer questions.
- Categorized by inquiry type (`enquire`, `stop`, `start`, `general_reply`).
- Status workflow: Move inquiries from `new` -> `contacted` -> `resolved`.
- Direct 1-click WhatsApp reply launcher to follow up with leads immediately.

### Module 9: Delivery Tracking & Blue Tick Receipts
- Gateway listens to WhatsApp message update acks:
  - Status 3 (`DELIVERY_ACK`): Records delivery timestamp (`delivered_at`) and double-check status.
  - Status 4 (`READ`): Records read timestamp (`read_at`) and blue tick receipt.
- Campaign metrics display true delivery rates and open/read rates.

### Module 10: Observability & Analytics (`Analytics.jsx` & `Overview.jsx`)
- Recharts visualizations:
  - Campaign Performance Comparison (Sent vs. Delivered vs. Read vs. Replied vs. Opt-outs).
  - Audience Growth & Category Breakdown (Pie/Donut charts).
  - Inbound Engagement Funnel.
- Quick stats: Total Audience, Total Broadcasts, Active Leads, Unsubscribe Rate.

### Module 11: Settings, Backup & Security (`Settings.jsx`)
- **JSON Full Snapshot Export**: 1-click download of all customers, categories, templates, campaigns, and inquiries in a single JSON payload.
- **Transaction-Safe Restore**: Validated schema upload to restore database snapshots across machines.
- **Anti-Ban Tuning**: Configurable delay ranges and daily sending limits.
- **WhatsApp Web Session Manager**: Displays QR code pairing modal, active connected phone number, and logout/reset buttons.

---

## 5. API Route Specifications

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Search, filter, and paginate customers |
| `POST` | `/api/customers` | Create new customer contact |
| `GET` | `/api/customers/{id}` | Get customer details and history |
| `PUT` | `/api/customers/{id}` | Update customer record |
| `DELETE` | `/api/customers/{id}` | Delete customer record |
| `POST` | `/api/customers/import` | Multipart CSV/Excel upload with column mapping |
| `GET` | `/api/customers/export` | Download sanitized CSV of customer roster |
| `POST` | `/api/customers/{id}/toggle-suppression` | Toggle opt-out suppression flag |
| `GET` | `/api/categories` | List all categories with customer counts |
| `POST` | `/api/categories` | Create category with color tag |
| `PUT` | `/api/categories/{id}` | Update category |
| `DELETE` | `/api/categories/{id}` | Delete category (with safety check) |
| `GET` | `/api/templates` | List all message templates |
| `POST` | `/api/templates` | Create template with variables and buttons |
| `PUT` | `/api/templates/{id}` | Update template |
| `DELETE` | `/api/templates/{id}` | Delete template |
| `POST` | `/api/templates/preview` | Render preview of template with dummy/sample contact |
| `POST` | `/api/media/upload` | Upload header image (`multipart/form-data`) |
| `GET` | `/api/campaigns` | List all campaigns with aggregated metrics |
| `POST` | `/api/campaigns` | Initialize campaign and build personalized recipient queue |
| `GET` | `/api/campaigns/{id}` | Get campaign details, recipient roster, and activity logs |
| `POST` | `/api/campaigns/{id}/recipients/{r_id}/open` | Mark recipient as opened (`wa.me` opened) |
| `POST` | `/api/campaigns/{id}/recipients/{r_id}/send` | Confirm manual send for recipient |
| `POST` | `/api/campaigns/{id}/recipients/{r_id}/skip` | Skip recipient with notes |
| `POST` | `/api/campaigns/{id}/cancel` | Cancel active campaign |
| `GET` | `/api/campaigns/{id}/export` | Export campaign recipient status log as CSV |
| `GET` | `/api/inquiries` | List all inbound customer inquiries with filters |
| `PUT` | `/api/inquiries/{id}/status` | Update inquiry status (`new`, `contacted`, `resolved`) |
| `GET` | `/api/analytics/overview` | Overall dashboard metrics and charts data |
| `GET` | `/api/settings/backup` | Download full JSON database snapshot |
| `POST` | `/api/settings/restore` | Restore database from JSON backup file |
| `POST` | `/api/webhooks/incoming` | Webhook for incoming WhatsApp message/reply |
| `POST` | `/api/webhooks/delivery-status` | Webhook for delivered/read receipt updates |
| `GET` | `/gateway/api/session/status` | Check Baileys connection state and active job |
| `POST` | `/gateway/api/session/init` | Trigger fresh QR code generation |
| `POST` | `/gateway/api/session/logout` | Disconnect WhatsApp session and clear credentials |
| `POST` | `/gateway/api/campaign/auto-send` | Launch automated background bulk sending |
| `POST` | `/gateway/api/campaign/auto-send/pause` | Pause active bulk sending job |
| `POST` | `/gateway/api/campaign/auto-send/resume` | Resume paused bulk sending job |
| `POST` | `/gateway/api/campaign/auto-send/cancel` | Terminate active bulk sending job |

---

## 6. Current Technical Limitations & Bottlenecks

1. **Baileys Unofficial Protocol Risk**: Baileys interfaces with the WhatsApp Web multi-device socket. While highly cost-effective (free, no Cloud API fees), sending high volumes of unsolicited messages quickly can cause WhatsApp to flag or temporarily ban the phone number.
2. **Single-Account Gateway**: The current gateway handles one linked WhatsApp session at a time (stored in `auth_info_baileys/`). Multiple team members or multi-number load-balancing is not yet supported.
3. **Local SQLite Concurrency**: SQLite is excellent for zero-config single-user local deployment, but concurrent multi-user write transactions are constrained compared to PostgreSQL/MySQL.
4. **No Native AI Copilot / LLM Response Generation**: Templates require manual composition; inbound customer inquiries currently rely on static keyword parsing (`STOP`, `START`, `ENQUIRE`) rather than an intelligent LLM conversational agent.
5. **No Visual Workflow Builder**: Campaigns are linear one-time broadcasts. There is currently no multi-step drip sequencing (e.g., "Wait 2 days -> if not read, send follow-up").

---

## 7. Ready-to-Use Prompt to Share with ChatGPT

*Copy and paste the text below directly into ChatGPT along with this document:*

```markdown
I have a production-ready, local-first WhatsApp Campaign Management Web Application built with React 18, Vite, Tailwind CSS, FastAPI (Python), SQLite, and a Node.js Baileys WhatsApp Gateway.

Attached above is the complete technical specification, data model architecture, and feature breakdown of my project.

Based on this architecture, please provide me with:
1. Feature Expansion Recommendations: What high-value features are missing that modern CRM/marketing platforms (like HubSpot, ManyChat, Wati, or Brevo) offer?
2. AI & LLM Integrations: How can I integrate local or cloud LLMs (e.g. OpenAI / Claude / Ollama) to add smart template generation, dynamic sentiment analysis on customer replies, and an autonomous AI customer support auto-responder?
3. Drip & Automated Workflow Engine: How can I architect multi-day drip campaigns and event-driven automation (e.g. follow-up after 48h if unread)?
4. Architecture & Scalability Enhancements: How can I introduce multi-number account rotation, warm-up schedules to prevent WhatsApp bans, and support for the Official WhatsApp Cloud API as a secondary backend provider?
5. Monetization & Packaging: If I want to package or distribute this software to local businesses or clients, what packaging models (Electron desktop app, Docker self-hosted SaaS, or multi-tenant cloud) should I consider?

Please provide detailed, actionable, and prioritized suggestions.
```
