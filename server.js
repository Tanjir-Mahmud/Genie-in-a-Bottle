require('dotenv').config({ override: true });
const express = require('express');
const axios = require('axios');
const http = require('http');
const WebSocket = require('ws');
const { saveMessage, saveSession } = require('./db');
const { processMessage } = require('./agent');
const cors = require('cors');
const ngrok = require('@ngrok/ngrok');

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;
const wsPort = process.env.WS_PORT || 3001;

// --- Unipile Configuration ---
const unipileApiKey = process.env.UNIPILE_API_KEY?.trim();
const unipileDsn = process.env.UNIPILE_DSN?.trim(); // e.g., https://api1.unipile.com:12345

// --- Global State ---
let currentContext = 'Home'; // Default context
let currentPersona = 'Concise Taskmaster'; // Default persona
let publicWebhookUrl = null; // Will be set by ngrok

app.use(express.json());

// ═══════════════════════════════════════════════
// Privacy-First: PII & Sensitive Data Redaction
// ═══════════════════════════════════════════════

/**
 * Scrubs sensitive data from message content before
 * it is broadcast to the UI or persisted to the database.
 * All redaction happens SERVER-SIDE before any data leaves the pipeline.
 */
function redactPII(text) {
    if (!text || typeof text !== 'string') return text;

    let redacted = text;

    // 1. Passwords — match keyword + separator + EVERYTHING until next comma, period, space-word, or end of string
    //    Handles: "password:- agau4##@", "pass= hello123", "pwd is myP@ss!"
    redacted = redacted.replace(
        /(?:password|passwd|pass|pwd|paswrd|pasword)\s*(?::|is|=|-|–)\s*\S+(?:\s+\S+)*/gi,
        function (match) {
            // Only redact up to the next comma/period break to avoid eating the whole message
            const endIdx = match.search(/,|\.\s|;\s/);
            if (endIdx > 0) {
                return '[PASSWORD REDACTED]' + match.substring(endIdx);
            }
            return '[PASSWORD REDACTED]';
        }
    );

    // 2. API Keys / Tokens (before other patterns to avoid partial matches)
    redacted = redacted.replace(
        /(?:api[_-]?key|token|secret|bearer|auth)\s*(?::|=|is)\s*\S{8,}/gi,
        '[API_KEY REDACTED]'
    );

    // 3. Email Addresses (full emails AND partial like "user@" with no domain)
    redacted = redacted.replace(
        /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]*[a-zA-Z0-9]*/g,
        '[EMAIL REDACTED]'
    );

    // 4. PINs / OTPs (before phone/card to avoid conflicts)
    redacted = redacted.replace(
        /(?:pin|otp|code|cvv|cvc)\s*(?::|is|=|-|–)\s*\d{3,8}/gi,
        '[PIN REDACTED]'
    );

    // 5. Social Security Numbers (XXX-XX-XXXX)
    redacted = redacted.replace(
        /\b\d{3}-\d{2}-\d{4}\b/g,
        '[SSN REDACTED]'
    );

    // 6. Phone Numbers (international +XX and local 0XX formats, 10-15 digits)
    redacted = redacted.replace(
        /(?:\+\d{1,4}[\s.-]?\d{4,14}|\b0\d{9,13}\b)/g,
        '[PHONE REDACTED]'
    );

    // 7. Credit/Debit Card Numbers (4 groups of 4 digits with separators)
    redacted = redacted.replace(
        /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
        '[CARD REDACTED]'
    );
    // 16-digit continuous card numbers
    redacted = redacted.replace(
        /\b\d{16}\b/g,
        '[CARD REDACTED]'
    );

    // 8. Bank Account / IBAN Numbers
    redacted = redacted.replace(
        /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
        '[IBAN REDACTED]'
    );

    // 9. Bitcoin / Crypto Wallet Addresses
    redacted = redacted.replace(
        /\b(?:1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}\b/g,
        '[CRYPTO_ADDR REDACTED]'
    );

    // 10. IP Addresses
    redacted = redacted.replace(
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        '[IP REDACTED]'
    );

    return redacted;
}

// --- Messaging Bridge: Unipile Account Linking ---

/**
 * Hosted Auth Flow
 * Generates a Unipile Hosted Authentication URL for Slack or Messenger.
 */
app.get('/api/auth/link-account/:provider', async (req, res) => {
    const { provider } = req.params; // 'slack' or 'facebook' or 'telegram'
    console.log(`[AUTH] Received Request for Auth URL. Provider: ${provider}`);

    if (!unipileApiKey || !unipileDsn) {
        return res.status(500).json({ error: 'Unipile credentials missing' });
    }

    try {
        const uppercaseProvider = provider.toUpperCase();
        console.log(`[AUTH] Calling Unipile to create Hosted Auth link for TYPE: ${uppercaseProvider}`);
        console.log(`[AUTH] RAW DSN VALUE: ${JSON.stringify(unipileDsn)}`);
        console.log(`[AUTH] API KEY VALUE: ${JSON.stringify(unipileApiKey)}`);

        const expiresOn = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

        const response = await axios.post(`${unipileDsn}/api/v1/hosted/accounts/link`, {
            type: 'create',
            providers: '*', // Let user select the provider
            api_url: unipileDsn,
            expiresOn: expiresOn,
            notify_url: publicWebhookUrl ? `${publicWebhookUrl}/webhook` : undefined,
            success_redirect_url: `http://localhost:3000/?linked=true`,
            failure_redirect_url: `http://localhost:3000/?error=auth_failed`
        }, {
            headers: { 'X-API-KEY': unipileApiKey }
        });

        console.log(`[AUTH] Success! Unipile returned URL: ${response.data.url}`);
        res.json({ url: response.data.url });
    } catch (error) {
        console.error('Unipile Auth Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate linking URL' });
    }
});

app.get('/auth/success', (req, res) => res.redirect('http://localhost:3000/?linked=true'));
app.get('/auth/failure', (req, res) => res.redirect('http://localhost:3000/?error=auth_failed'));

// --- Unified Webhook ---

/**
 * Webhook endpoint for Unipile
 */
app.post('/webhook', async (req, res) => {
    const data = req.body;
    res.status(200).send('OK');

    // 1. Webhook Normalization Logic:
    // Listen for the Unipile event message_received
    if (data.event !== 'message_received') return;

    // 3. Exact Unipile JSON Mapping with Attachment Support
    let rawMessageContent = data?.message || data?.data?.message || {};
    let extracted_text = typeof rawMessageContent === 'string' ? rawMessageContent : rawMessageContent?.text;

    // If no direct text, check for attachments with captions
    const attachments = data?.attachments || data?.data?.attachments || rawMessageContent?.attachments;
    if (!extracted_text) {
        if (attachments && attachments.length > 0) {
            // Unipile often puts image captions in the 'description' or 'text' of the attachment
            const attach = attachments[0];
            const caption = attach.description || attach.text || attach.name || '';
            extracted_text = caption ? `[Media: ${attach.type || 'attachment'}] ${caption}` : `[Media: ${attach.type || 'attachment'}]`;
        } else {
            extracted_text = '[Message]';
        }
    }

    const extracted_name = data?.sender?.attendee_name || 'Unknown';
    const provider = (data?.payload?.account_type || data?.account_type || 'telegram').toLowerCase();

    console.log(`[WEBHOOK] Normalized: provider=${provider}, sender=${extracted_name}, text=${extracted_text.substring(0, 40).replace(/\n/g, ' ')}...`);

    const normalizedObject = {
        provider: provider,
        raw_text: extracted_text,
        sender: extracted_name
    };

    // 4. Empty Check Guardrail
    if (!normalizedObject.raw_text || normalizedObject.raw_text === '[Attachment]' || normalizedObject.raw_text === '[Message]' || normalizedObject.raw_text === '') {
        console.log(`> Skipping empty/media-only packet.`);
        return;
    }

    try {
        // 2. Intelligence Pipeline Trigger
        // Pass this normalized object directly to the agent.js
        const aiOutput = await processMessage(normalizedObject.raw_text, normalizedObject.provider, normalizedObject.sender, currentContext, currentPersona);

        if (aiOutput) {
            // 3. Privacy-First Persistence
            // Apply PII redaction before persisting or broadcasting
            const redactedContent = redactPII(normalizedObject.raw_text);
            const redactedAiContent = redactPII(aiOutput.original_content);

            const savedData = {
                provider: normalizedObject.provider,
                sender: normalizedObject.sender,
                content: redactedContent,
                redacted_content: redactedAiContent,
                urgency: aiOutput.urgency
            };

            await saveMessage(savedData);
            console.log(`Saved ${normalizedObject.provider} message from ${normalizedObject.sender}`);

            // 5. Haptic Differentiation Logic
            let haptic_type = 'silent';
            if (aiOutput.isVip) {
                haptic_type = 'heartbeat';
            } else if (aiOutput.urgency === 'High' && currentContext === 'Work') {
                haptic_type = 'double_pulse';
            } else if (aiOutput.urgency === 'High') {
                haptic_type = 'double_pulse';
            }

            // 4a. Real-time UI Broadcast (PRIVACY_LOG_UPDATE for dashboard)
            // Content is redacted — raw PII never reaches the frontend
            const uiPayload = {
                type: 'PRIVACY_LOG_UPDATE',
                platform: normalizedObject.provider,
                sender: normalizedObject.sender,
                content: redactedContent,
                summary: redactPII(aiOutput.summary),
                urgency: aiOutput.urgency,
                isVip: aiOutput.isVip,
                reply: aiOutput.suggested_reply,
                timestamp: new Date().toISOString()
            };

            // 4b. Hardware Broadcast (NEW_MESSAGE for C# plugin)
            const hardwarePayload = {
                type: 'NEW_MESSAGE',
                platform: normalizedObject.provider,
                sender: normalizedObject.sender,
                summary: aiOutput.summary,
                urgency: aiOutput.urgency,
                isVip: aiOutput.isVip,
                haptic_type: haptic_type,
                timestamp: new Date().toISOString()
            };

            broadcastToHardware(uiPayload, hardwarePayload);
        }
    } catch (err) {
        console.error('Failed to process webhook:', err.message);
    }
});


/**
 * Standardized Hardware Broadcaster
 * Sends both UI and hardware payloads to all connected clients.
 */
function broadcastToHardware(uiPayload, hardwarePayload) {
    console.log(`[HARDWARE] Broadcasting alert: ${hardwarePayload.summary} (haptic: ${hardwarePayload.haptic_type})`);
    broadcastAlert(uiPayload);
    broadcastAlert(hardwarePayload);
}

/**
 * @deprecated Use /auth/link-account/slack
 */
app.get('/auth/slack', (req, res) => {
    // Boilerplate for Slack OAuth redirect
    const { code } = req.query;
    if (code) {
        console.log('Received Slack OAuth code:', code);
        // In a real app, exchange this code for an access token
        return res.send('Slack Linked! You can close this tab.');
    }
    res.send('Slack Auth Endpoint');
});

app.get('/auth/messenger', (req, res) => {
    // Boilerplate for Messenger/Facebook OAuth redirect
    res.send('Messenger Auth Endpoint');
});

// --- Dashboard API Endpoints ---

/**
 * Get current context
 */
app.get('/api/context', (req, res) => {
    res.json({ context: currentContext });
});

/**
 * Update current context
 */
app.post('/api/context', (req, res) => {
    const { context } = req.body;
    if (context === 'Home' || context === 'Work') {
        currentContext = context;
        console.log(`[CONTEXT] Switched to ${currentContext}`);
        // Broadcast to hardware clients
        broadcastAlert({ type: 'CONTEXT_CHANGE', context: currentContext, timestamp: new Date().toISOString() });
        res.json({ success: true, context: currentContext });
    } else {
        res.status(400).json({ error: 'Invalid context. Use "Home" or "Work".' });
    }
});

/**
 * Get Privacy Audit Logs
 */
app.get('/api/logs', (req, res) => {
    const { openDatabase } = require('./db'); // Ensure access to the database
    // This is a bit hacky, normally you'd use a shared db instance
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./ambient_root.db');

    db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

/**
 * Get System Status
 */
app.get('/api/status', async (req, res) => {
    // Fix 3: Real connectivity check via Unipile API
    let telegramStatus = 'Disconnected';
    let unipileStatus = 'Disconnected';

    if (unipileApiKey && unipileDsn) {
        try {
            const accountsRes = await axios.get(`${unipileDsn}/api/v1/accounts`, {
                headers: { 'X-API-KEY': unipileApiKey },
                timeout: 5000
            });
            const accounts = accountsRes.data?.items || accountsRes.data || [];
            unipileStatus = 'Connected';
            const hasTelegram = Array.isArray(accounts) && accounts.some(a => (a.type || a.provider || '').toLowerCase() === 'telegram');
            telegramStatus = hasTelegram ? 'Connected' : 'No Telegram Account';
        } catch (e) {
            unipileStatus = 'Error';
            telegramStatus = 'Error';
        }
    }

    let hardwareClients = 0;
    wss.clients.forEach(client => {
        if (!client.isDashboard) hardwareClients++;
    });

    res.json({
        backend: 'Live',
        telegram: telegramStatus,
        unipile: unipileStatus,
        logitech: hardwareClients > 0 ? 'Connected' : 'Ready (No device connected)'
    });
});

/**
 * Get current persona
 */
app.get('/api/persona', (req, res) => {
    res.json({ persona: currentPersona });
});

/**
 * Update current persona
 */
app.post('/api/persona', (req, res) => {
    const { persona } = req.body;
    if (persona === 'Concise Taskmaster' || persona === 'Empathetic Companion') {
        currentPersona = persona;
        console.log(`[PERSONA] Switched to ${currentPersona}`);
        // Broadcast to hardware clients
        broadcastAlert({ type: 'PERSONA_CHANGE', persona: currentPersona, timestamp: new Date().toISOString() });
        res.json({ success: true, persona: currentPersona });
    } else {
        res.status(400).json({ error: 'Invalid persona. Use "Concise Taskmaster" or "Empathetic Companion".' });
    }
});

/**
 * Smart Home Device Toggle — broadcasts to hardware clients
 */
app.post('/api/smart-home/toggle', (req, res) => {
    const { device, state } = req.body;
    console.log(`[SMART HOME] ${device} → ${JSON.stringify(state)}`);
    broadcastAlert({
        type: 'SMART_HOME_UPDATE',
        device: device,
        state: state,
        timestamp: new Date().toISOString()
    });
    res.json({ success: true, device, state });
});

/**
 * Tone Dial Update — broadcasts to hardware clients
 */
app.post('/api/tone-dial', (req, res) => {
    const { level } = req.body;
    const style = level <= 30 ? 'Concise' : level <= 60 ? 'Balanced' : 'Creative';
    const temperature = level <= 30 ? 0.1 : level <= 60 ? 0.5 : 0.9;
    console.log(`[TONE DIAL] Level: ${level} (${style})`);
    broadcastAlert({
        type: 'TONE_DIAL_UPDATE',
        level: level,
        style: style,
        temperature: temperature,
        timestamp: new Date().toISOString()
    });
    res.json({ success: true, level, style, temperature });
});

/**
 * Get system config
 */
app.get('/api/config', (req, res) => {
    res.json({
        useLocalAi: process.env.USE_LOCAL_AI === 'true',
        heartbeat: true // Always on in this version
    });
});

/**
 * Toggle Local AI (Simulated for demo, normally would update .env)
 */
app.post('/api/config/toggle-local-ai', (req, res) => {
    const { enabled } = req.body;
    process.env.USE_LOCAL_AI = enabled ? 'true' : 'false';
    console.log(`[CONFIG] Local AI toggled: ${process.env.USE_LOCAL_AI}`);
    res.json({ success: true, useLocalAi: enabled });
});

const server = http.createServer(app);

// --- Hardware Ready: WebSocket Server ---

const wss = new WebSocket.Server({ port: wsPort });

wss.on('connection', (ws, req) => {
    ws.isDashboard = req.url && req.url.includes('client=dashboard');
    if (ws.isDashboard) {
        console.log(`UI Dashboard connected on port ${wsPort}`);
    } else {
        console.log(`Logitech Hardware/Client connected on port ${wsPort}`);
    }
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Ambient Root WebSocket Active' }));
});

function broadcastAlert(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

server.listen(port, async () => {
    console.log(`Ambient Root Backend running at http://localhost:${port}`);
    console.log(`WebSocket Server running at ws://localhost:${wsPort}`);

    // --- 2. Public Webhook Bridge via ngrok ---
    try {
        const ngrokToken = process.env.NGROK_AUTHTOKEN;
        if (ngrokToken) {
            const listener = await ngrok.forward({ addr: port, authtoken: ngrokToken });
            publicWebhookUrl = listener.url();
            console.log(`\n🌐 [NGROK] Public Webhook URL: ${publicWebhookUrl}/webhook`);
            console.log(`   Copy this URL into Unipile's webhook settings.\n`);
        } else {
            console.log('[NGROK] No NGROK_AUTHTOKEN found in .env. Skipping tunnel. Add it to enable public webhooks.');
        }
    } catch (err) {
        console.error('[NGROK] Failed to start tunnel:', err.message);
    }
});
