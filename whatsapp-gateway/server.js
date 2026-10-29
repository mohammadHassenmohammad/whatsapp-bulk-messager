const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3050;
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let qrCodeDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let connectedUser = null;
let activeBulkJob = null; // To track ongoing auto-send campaigns

function saveBulkJobState() {
  if (activeBulkJob) {
    try {
      fs.writeFileSync(path.join(AUTH_DIR, 'active_bulk_job.json'), JSON.stringify(activeBulkJob, null, 2));
    } catch (e) {}
  }
}

const logger = pino({ level: 'silent' });

async function initWhatsApp(forceNew = false) {
  if (forceNew && fs.existsSync(AUTH_DIR)) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch (e) {
      console.error('Error clearing auth dir:', e);
    }
  }

  connectionStatus = 'connecting';
  qrCodeDataUrl = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['WhatsApp Campaign Manager', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Helper: Determine if JID represents an individual direct 1-to-1 chat (not groups or channels)
    function isDirectChat(jid) {
      if (!jid) return false;
      if (jid.includes('@g.us') || jid.includes('@broadcast') || jid.includes('@newsletter')) {
        return false;
      }
      return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
    }

    // Helper: Resolve true phone number from standard JID or WhatsApp LID (Linked Identity)
    async function resolvePhoneFromJid(jid, msgObj) {
      if (!jid) return null;
      if (jid.endsWith('@s.whatsapp.net')) {
        return jid.split('@')[0].split(':')[0];
      }
      if (jid.endsWith('@lid')) {
        // 1. Check message alt fields if provided by Baileys
        const alt = msgObj?.key?.remoteJidAlt || msgObj?.key?.participantAlt;
        if (alt && alt.endsWith('@s.whatsapp.net')) {
          return alt.split('@')[0].split(':')[0];
        }
        // 2. Query Baileys signalRepository LID mapping in memory
        try {
          if (sock?.signalRepository?.lidMapping?.getPNForLID) {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
            if (pn) return pn.split('@')[0].split(':')[0];
          }
        } catch (e) {}
        // 3. Check persistent auth reverse LID mapping file
        try {
          const lidClean = jid.split('@')[0].split(':')[0];
          const reverseFile = path.join(AUTH_DIR, `lid-mapping-${lidClean}_reverse.json`);
          if (fs.existsSync(reverseFile)) {
            const raw = JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
            if (raw) return String(raw).split('@')[0].split(':')[0];
          }
        } catch (e) {}
        // 4. Fallback to raw LID identifier digits
        return jid.split('@')[0].split(':')[0];
      }
      return null;
    }

    // Helper: Recursively unwrap all WhatsApp message containers (ephemeral, viewOnce, etc.)
    function extractMessageContent(rawMessage) {
      if (!rawMessage) return '';
      let m = rawMessage;
      while (
        m?.ephemeralMessage?.message ||
        m?.viewOnceMessage?.message ||
        m?.viewOnceMessageV2?.message ||
        m?.documentWithCaptionMessage?.message
      ) {
        m =
          m.ephemeralMessage?.message ||
          m.viewOnceMessage?.message ||
          m.viewOnceMessageV2?.message ||
          m.documentWithCaptionMessage?.message;
      }

      let text = '';
      if (m.conversation) {
        text = m.conversation;
      } else if (m.extendedTextMessage?.text) {
        text = m.extendedTextMessage.text;
      } else if (m.buttonsResponseMessage?.selectedButtonId || m.buttonsResponseMessage?.selectedDisplayText) {
        text = m.buttonsResponseMessage.selectedButtonId || m.buttonsResponseMessage.selectedDisplayText;
      } else if (m.templateButtonReplyMessage?.selectedId || m.templateButtonReplyMessage?.selectedDisplayText) {
        text = m.templateButtonReplyMessage.selectedId || m.templateButtonReplyMessage.selectedDisplayText;
      } else if (m.listResponseMessage?.singleSelectReply?.selectedRowId || m.listResponseMessage?.title) {
        text = m.listResponseMessage.singleSelectReply.selectedRowId || m.listResponseMessage.title;
      } else if (m.interactiveResponseMessage) {
        const resp = m.interactiveResponseMessage;
        try {
          if (resp.nativeFlowResponseMessage?.paramsJson) {
            const parsed = JSON.parse(resp.nativeFlowResponseMessage.paramsJson);
            text = parsed.id || parsed.display_text || resp.body?.text || '';
          } else {
            text = resp.body?.text || '';
          }
        } catch (e) {
          text = resp.body?.text || '';
        }
      } else if (m.imageMessage?.caption) {
        text = m.imageMessage.caption;
      } else if (m.videoMessage?.caption) {
        text = m.videoMessage.caption;
      } else if (m.documentMessage?.caption) {
        text = m.documentMessage.caption;
      } else if (m.imageMessage) {
        text = '[Photo]';
      } else if (m.audioMessage) {
        text = '[Voice Note]';
      } else if (m.videoMessage) {
        text = '[Video]';
      } else if (m.documentMessage) {
        text = '[Document]';
      } else if (m.contactMessage || m.contactsArrayMessage) {
        text = '[Contact Card]';
      } else if (m.locationMessage || m.liveLocationMessage) {
        text = '[Location]';
      }

      return text ? text.trim() : '';
    }

    // Listen for incoming customer messages & button responses (STOP, ENQUIRE, replies)
    sock.ev.on('messages.upsert', async (m) => {
      // Process both real-time 'notify' and synchronized/catch-up 'append' events
      const messagesList = m.messages || [];
      for (const msg of messagesList) {
        if (!msg.message) continue;
        const remoteJid = msg.key.remoteJid || '';
        if (!isDirectChat(remoteJid)) continue; // Strictly allow individual customer chats only (no groups or newsletters)

        const text = extractMessageContent(msg.message);
        if (!text) continue;

        const phone = await resolvePhoneFromJid(remoteJid, msg);
        if (!phone) continue;

        const isFromMe = !!msg.key.fromMe;
        console.log(`[WhatsApp Gateway] ${isFromMe ? 'Outbound (phone sync)' : 'Inbound'} message with +${phone}: "${text}"`);

        // Forward to FastAPI backend webhook
        try {
          const resp = await fetch('http://127.0.0.1:8090/api/webhooks/incoming', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Gateway-Secret': 'local_gateway_secure_token_123',
            },
            body: JSON.stringify({
              phone,
              text,
              message_id: msg.key.id,
              timestamp: msg.messageTimestamp,
              is_from_me: isFromMe,
              remote_jid: remoteJid,
            }),
          });
          const data = await resp.json();

          // Send automatic reply on WhatsApp if triggered (only for customer inbound messages)
          if (!isFromMe && data?.auto_reply) {
            console.log(`[WhatsApp Gateway] Auto-replying to +${phone}: "${data.auto_reply}"`);
            await sock.sendMessage(remoteJid, { text: data.auto_reply });
          }
        } catch (e) {
          console.error('[WhatsApp Gateway] Inbound webhook error:', e.message);
        }
      }
    });

    // Listen for message delivery updates and read receipts (Blue Ticks)
    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        const status = update.update?.status;
        // 3 = DELIVERY_ACK (Delivered ✓✓), 4 = READ (Read/Blue Tick ✓✓)
        if (status === 3 || status === 4) {
          const remoteJid = update.key?.remoteJid || '';
          if (!isDirectChat(remoteJid)) continue;

          const phone = await resolvePhoneFromJid(remoteJid, update);
          const messageId = update.key?.id;
          const statusStr = status === 4 ? 'read' : 'delivered';

          try {
            await fetch('http://127.0.0.1:8090/api/webhooks/delivery-status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Gateway-Secret': 'local_gateway_secure_token_123',
              },
              body: JSON.stringify({ message_id: messageId, phone, status: statusStr }),
            });
          } catch (e) {}
        }
      }
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'qr_ready';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
        } catch (err) {
          console.error('QR code generation error:', err);
        }
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeDataUrl = null;
        const jid = sock.user?.id || '';
        const phone = jid.split(':')[0] || jid.split('@')[0] || '';
        connectedUser = {
          id: jid,
          phone: phone ? `+${phone}` : '',
          name: sock.user?.name || 'My WhatsApp Account',
        };
        console.log(`[WhatsApp Gateway] Successfully connected as ${connectedUser.phone}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp Gateway] Connection closed (status: ${statusCode}). Reconnect: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'disconnected';
          connectedUser = null;
          qrCodeDataUrl = null;
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
        } else if (shouldReconnect) {
          // Reconnect automatically after brief delay
          setTimeout(() => initWhatsApp(false), 3000);
        } else {
          connectionStatus = 'disconnected';
          connectedUser = null;
          qrCodeDataUrl = null;
        }
      }
    });
  } catch (error) {
    console.error('Error initializing WhatsApp socket:', error);
    connectionStatus = 'disconnected';
  }
}

// ----------------- API Endpoints -----------------

// Status endpoint
app.get('/api/session/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    user: connectedUser,
    activeBulkJob: activeBulkJob
      ? {
          campaignId: activeBulkJob.campaignId,
          total: activeBulkJob.total,
          sent: activeBulkJob.sent,
          failed: activeBulkJob.failed,
          isPaused: activeBulkJob.isPaused,
          isCancelled: activeBulkJob.isCancelled,
        }
      : null,
  });
});

// Connect / Request QR
app.post('/api/session/connect', async (req, res) => {
  if (connectionStatus === 'connected') {
    return res.json({ status: 'connected', user: connectedUser });
  }
  await initWhatsApp(false);
  res.json({ message: 'Connection initiated', status: connectionStatus });
});

// Disconnect / Logout
app.post('/api/session/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {}
  connectionStatus = 'disconnected';
  connectedUser = null;
  qrCodeDataUrl = null;
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (e) {}
  res.json({ success: true, message: 'Logged out successfully' });
});

// Helper: Dispatch message with clean Option B numbered quick reply triggers
async function sendInteractiveOrStandardMessage(sock, jid, { text, mediaUrl, buttons }) {
  let cleanBody = text || '';

  // If buttons are provided and not yet embedded as numbered triggers, format them cleanly
  if (buttons && Array.isArray(buttons) && buttons.length > 0 && !cleanBody.includes('Reply with a number:')) {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const quickReplies = buttons
      .filter((b) => b.type === 'quick_reply' || b.action === 'quick_reply' || (!b.type && !b.url))
      .map((b) => (b.text || '').trim())
      .filter(Boolean);

    const urlButtons = buttons.filter(
      (b) => (b.type === 'url' || b.action === 'url') && b.url
    );

    const blocks = [];
    if (quickReplies.length > 0) {
      const lines = quickReplies.map((t, idx) => `${numberEmojis[idx] || `${idx + 1}.`} *${t}*`);
      blocks.push(`Reply with a number:\n${lines.join('\n')}`);
    }
    if (urlButtons.length > 0) {
      const urlLines = urlButtons.map((b) => `🔗 *${b.text}*: ${b.url}`);
      blocks.push(urlLines.join('\n'));
    }
    if (blocks.length > 0) {
      cleanBody = `${cleanBody.trim()}\n\n──────────────────\n${blocks.join('\n\n')}`;
    }
  }

  // Send main message (with media/image attachment if provided)
  let result;
  if (mediaUrl) {
    result = await sock.sendMessage(jid, {
      image: { url: mediaUrl },
      caption: cleanBody,
    });
  } else {
    result = await sock.sendMessage(jid, { text: cleanBody });
  }

  return result;
}

// Send single message (text, native buttons, or image with caption)
app.post('/api/messages/send-single', async (req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(400).json({ error: 'WhatsApp Web is not connected. Please scan QR code first.' });
  }

  const { phone, message, mediaUrl, buttons } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    const result = await sendInteractiveOrStandardMessage(sock, jid, {
      text: message,
      mediaUrl,
      buttons,
    });
    res.json({ success: true, messageId: result?.key?.id });
  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
  }
});

// Bulk send automation with delay
app.post('/api/messages/send-bulk', async (req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(400).json({ error: 'WhatsApp Web is not connected. Please scan QR code first.' });
  }

  const { campaignId, recipients, minDelay = 4, maxDelay = 8 } = req.body;
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients provided' });
  }

  if (activeBulkJob && !activeBulkJob.isCancelled && activeBulkJob.sent + activeBulkJob.failed < activeBulkJob.total) {
    return res.status(409).json({ error: 'Another campaign is already currently dispatching.' });
  }

  activeBulkJob = {
    campaignId,
    total: recipients.length,
    sent: 0,
    failed: 0,
    isPaused: false,
    isCancelled: false,
  };
  saveBulkJobState();

  // Run bulk dispatcher in background asynchronously
  (async () => {
    for (let i = 0; i < recipients.length; i++) {
      if (activeBulkJob.isCancelled) {
        console.log(`[WhatsApp Gateway] Bulk campaign ${campaignId} cancelled by user.`);
        break;
      }

      while (activeBulkJob.isPaused && !activeBulkJob.isCancelled) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const rec = recipients[i];
      const cleanPhone = (rec.phone || '').replace(/\D/g, '');
      const jid = `${cleanPhone}@s.whatsapp.net`;
      const media = rec.media_url || rec.mediaUrl;
      const recButtons = rec.buttons;

      try {
        const result = await sendInteractiveOrStandardMessage(sock, jid, {
          text: rec.message,
          mediaUrl: media,
          buttons: recButtons,
        });

        activeBulkJob.sent += 1;
        saveBulkJobState();
        const messageKeyId = result?.key?.id;

        // Notify FastAPI backend of confirmed send + store message_id for delivery receipt tracking
        try {
          await fetch(`http://127.0.0.1:8090/api/campaigns/${campaignId}/recipients/${rec.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'sent',
              message_id: messageKeyId,
              notes: 'Automated direct dispatch via linked WhatsApp Web'
            }),
          });
        } catch (e) {
          console.error('FastAPI update failed:', e.message);
        }
      } catch (err) {
        console.error(`Failed to send to ${cleanPhone}:`, err.message);
        activeBulkJob.failed += 1;
        saveBulkJobState();
        try {
          await fetch(`http://127.0.0.1:8090/api/campaigns/${campaignId}/recipients/${rec.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed', error_message: err.message }),
          });
        } catch (e) {}
      }

      // Safe Delay between messages (Random between minDelay and maxDelay seconds)
      if (i < recipients.length - 1 && !activeBulkJob.isCancelled) {
        const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    // Finished
    try {
      if (fs.existsSync(path.join(AUTH_DIR, 'active_bulk_job.json'))) {
        fs.unlinkSync(path.join(AUTH_DIR, 'active_bulk_job.json'));
      }
    } catch (e) {}
  })();

  res.json({
    success: true,
    message: `Started automated sending for ${recipients.length} recipients.`,
    campaignId,
  });
});

// Pause active bulk send
app.post('/api/messages/pause-bulk', (req, res) => {
  if (activeBulkJob) {
    activeBulkJob.isPaused = true;
  }
  res.json({ success: true, isPaused: true, message: 'Automated sending paused' });
});

// Resume active bulk send
app.post('/api/messages/resume-bulk', (req, res) => {
  if (activeBulkJob) {
    activeBulkJob.isPaused = false;
  }
  res.json({ success: true, isPaused: false, message: 'Automated sending resumed' });
});

// Cancel active bulk send
app.post('/api/messages/cancel-bulk', (req, res) => {
  if (activeBulkJob) {
    activeBulkJob.isCancelled = true;
  }
  try {
    if (fs.existsSync(path.join(AUTH_DIR, 'active_bulk_job.json'))) {
      fs.unlinkSync(path.join(AUTH_DIR, 'active_bulk_job.json'));
    }
  } catch (e) {}
  res.json({ success: true, message: 'Automated sending cancelled' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[WhatsApp Gateway] Running on http://127.0.0.1:${PORT} (bound to loopback only)`);
  // Attempt to restore existing bulk job state if available
  if (fs.existsSync(path.join(AUTH_DIR, 'active_bulk_job.json'))) {
    try {
      activeBulkJob = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, 'active_bulk_job.json'), 'utf8'));
    } catch (e) {}
  }
  // Attempt to restore existing session if available
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    initWhatsApp(false);
  }
});
