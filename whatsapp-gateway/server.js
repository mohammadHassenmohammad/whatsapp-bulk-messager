const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
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

    // Listen for incoming customer messages & button responses (STOP, ENQUIRE, replies)
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        if (!msg.message || msg.key.fromMe) continue; // Skip messages sent by ourselves
        const remoteJid = msg.key.remoteJid || '';
        if (!remoteJid.endsWith('@s.whatsapp.net')) continue; // Strictly allow individual customer chats only (no groups or newsletters)
        
        const phone = remoteJid.split('@')[0].split(':')[0];
        let text = '';
        if (msg.message.conversation) {
          text = msg.message.conversation;
        } else if (msg.message.extendedTextMessage?.text) {
          text = msg.message.extendedTextMessage.text;
        } else if (msg.message.buttonsResponseMessage?.selectedButtonId) {
          text = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message.templateButtonReplyMessage?.selectedId) {
          text = msg.message.templateButtonReplyMessage.selectedId;
        } else if (msg.message.listResponseMessage?.singleSelectReply?.selectedRowId) {
          text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
        }

        if (!text) continue;
        console.log(`[WhatsApp Gateway] Inbound message from +${phone}: "${text}"`);

        // Forward to FastAPI backend webhook
        try {
          const resp = await fetch('http://127.0.0.1:8090/api/webhooks/incoming', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Gateway-Secret': 'local_gateway_secure_token_123'
            },
            body: JSON.stringify({
              phone,
              text,
              message_id: msg.key.id,
              timestamp: msg.messageTimestamp,
            }),
          });
          const data = await resp.json();
          
          // Send automatic reply on WhatsApp if triggered (e.g. for STOP unsubscribe or ENQUIRE confirmation)
          if (data?.auto_reply) {
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
          const phone = remoteJid.split('@')[0].split(':')[0];
          const messageId = update.key?.id;
          const statusStr = status === 4 ? 'read' : 'delivered';

          try {
            await fetch('http://127.0.0.1:8090/api/webhooks/delivery-status', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Gateway-Secret': 'local_gateway_secure_token_123'
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

// Send single message (text or image with caption)
app.post('/api/messages/send-single', async (req, res) => {
  if (connectionStatus !== 'connected' || !sock) {
    return res.status(400).json({ error: 'WhatsApp Web is not connected. Please scan QR code first.' });
  }

  const { phone, message, mediaUrl, buttons } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required' });
  }

  let finalMessage = message;
  if (buttons && Array.isArray(buttons) && buttons.length > 0) {
    const btnLines = buttons.map((b) =>
      b.type === 'url' && b.url ? `🔗 *${b.text}*: ${b.url}` : `👉 Reply *${b.text}*`
    );
    if (!finalMessage.includes(btnLines[0])) {
      finalMessage = `${finalMessage.trim()}\n\n──────────────────\n${btnLines.join('\n')}`;
    }
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    let result;
    if (mediaUrl) {
      result = await sock.sendMessage(jid, {
        image: { url: mediaUrl },
        caption: finalMessage,
      });
    } else {
      result = await sock.sendMessage(jid, { text: finalMessage });
    }
    res.json({ success: true, messageId: result.key.id });
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
      let finalMsg = rec.message;
      if (rec.buttons && Array.isArray(rec.buttons) && rec.buttons.length > 0) {
        const btnLines = rec.buttons.map((b) =>
          b.type === 'url' && b.url ? `🔗 *${b.text}*: ${b.url}` : `👉 Reply *${b.text}*`
        );
        if (!finalMsg.includes(btnLines[0])) {
          finalMsg = `${finalMsg.trim()}\n\n──────────────────\n${btnLines.join('\n')}`;
        }
      }

      try {
        let result;
        if (media) {
          result = await sock.sendMessage(jid, {
            image: { url: media },
            caption: finalMsg,
          });
        } else {
          result = await sock.sendMessage(jid, { text: finalMsg });
        }
        activeBulkJob.sent += 1;
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
  // Attempt to restore existing session if available
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    initWhatsApp(false);
  }
});
