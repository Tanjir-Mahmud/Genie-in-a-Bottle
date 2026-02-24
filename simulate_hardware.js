/**
 * ═══════════════════════════════════════════════════
 *  🧞 Genie in a Bottle — Logitech Hardware Simulator
 * ═══════════════════════════════════════════════════
 *
 * This script simulates the Logitech MX Creative Console + MX Master 4
 * by connecting to the backend WebSocket as a HARDWARE client.
 *
 * What it proves:
 *  ✅ Dashboard shows "Connected" for Logitech Hardware
 *  ✅ Haptic waveforms are received and logged
 *  ✅ NEW_MESSAGE payloads are correctly routed to hardware
 *  ✅ Rotary Recall, Persona switching, and Tone Dial logic works
 *
 * Usage:
 *   node simulate_hardware.js
 */

const WebSocket = require('ws');

// ═══════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════

const WS_URL = 'ws://localhost:3002'; // No ?client=dashboard → registers as hardware
const RECONNECT_DELAY = 5000;

// ═══════════════════════════════════════════════════
// Haptic Waveform Definitions (mirrors HapticEngine.cs)
// ═══════════════════════════════════════════════════

const WAVEFORMS = {
    ai_thinking: { name: 'AI Thinking', pulseMs: 200, gapMs: 100, repeats: 3, icon: '🔄' },
    task_complete: { name: 'Task Complete', pulseMs: 50, gapMs: 80, repeats: 2, icon: '✅' },
    heartbeat: { name: 'Heartbeat', pulseMs: 150, gapMs: 200, repeats: 2, icon: '💓' },
    urgent_alert: { name: 'Urgent Alert', pulseMs: 80, gapMs: 60, repeats: 3, icon: '🚨' },
    double_pulse: { name: 'Double Pulse', pulseMs: 60, gapMs: 80, repeats: 2, icon: '📳' },
    silent: { name: 'Silent', pulseMs: 0, gapMs: 0, repeats: 0, icon: '🔇' },
};

// ═══════════════════════════════════════════════════
// Persona Definitions (mirrors PersonaManager.cs)
// ═══════════════════════════════════════════════════

const PERSONAS = {
    persona_creative: { id: 'creative_genie', name: 'Creative Genie 🎨', haptic: 'ai_thinking' },
    persona_techLead: { id: 'tech_lead', name: 'Technical Lead ⚙️', haptic: 'task_complete' },
    persona_smartHome: { id: 'smart_home_warden', name: 'Smart Home Warden 🏠', haptic: 'heartbeat' },
};

// ═══════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════

let messageHistory = [];
let historyIndex = -1;
let toneLevel = 0.3;
let activePersona = 'creative_genie';
let messageCount = 0;

// ═══════════════════════════════════════════════════
// Simulated Haptic Feedback
// ═══════════════════════════════════════════════════

function triggerHaptic(waveformName) {
    const wf = WAVEFORMS[waveformName] || WAVEFORMS.silent;

    if (wf.pulseMs === 0) {
        console.log(`  ${wf.icon}  [HAPTIC] Silent — message queued without vibration.`);
        return;
    }

    const totalMs = (wf.pulseMs * wf.repeats) + (wf.gapMs * (wf.repeats - 1));
    const pattern = Array(wf.repeats).fill(`${wf.pulseMs}ms`).join(` → ${wf.gapMs}ms gap → `);

    console.log(`  ${wf.icon}  [HAPTIC] ${wf.name}: ${pattern}`);
    console.log(`     └─ MX Master 4 would vibrate for ${totalMs}ms total`);
}

// ═══════════════════════════════════════════════════
// Platform Color Mapping (mirrors SetPlatformColor)
// ═══════════════════════════════════════════════════

function getPlatformColor(platform) {
    const colors = {
        telegram: { hex: '#2CA5E0', name: 'Sky Blue', icon: '🔵' },
        slack: { hex: '#4A154B', name: 'Aubergine', icon: '🟣' },
        facebook: { hex: '#0084FF', name: 'Messenger Blue', icon: '🔷' },
        whatsapp: { hex: '#25D366', name: 'WhatsApp Green', icon: '🟢' },
    };
    return colors[platform] || { hex: '#FFFFFF', name: 'White', icon: '⚪' };
}

// ═══════════════════════════════════════════════════
// Message Handler
// ═══════════════════════════════════════════════════

function handleMessage(data) {
    const payload = JSON.parse(data);

    if (payload.type === 'CONNECTED') {
        console.log(`\n  ✅ [CONNECTED] ${payload.message}\n`);
        return;
    }

    // Skip UI-only payloads (same as UnipileMessagingBridge.cs)
    if (payload.type === 'PRIVACY_LOG_UPDATE') return;

    // ─────────────── CONTEXT CHANGE ───────────────
    if (payload.type === 'CONTEXT_CHANGE') {
        const icon = payload.context === 'Work' ? '💼' : '🏠';
        const color = payload.context === 'Work' ? 'WORK MODE' : 'HOME MODE';
        console.log('');
        console.log('  ╔═══════════════════════════════════════════════╗');
        console.log(`  ║  ${icon} CONTEXT SWITCH → ${color}              ║`);
        console.log('  ╚═══════════════════════════════════════════════╝');
        if (payload.context === 'Work') {
            console.log('  📡 Priority: Slack messages | Telegram queued');
            console.log('  🔔 Focus Mode timer started');
        } else {
            console.log('  📡 Priority: Telegram/Facebook | Slack queued');
            console.log('  🏡 Focus Mode disabled, lights restored');
        }
        triggerHaptic('task_complete');
        console.log('');
        return;
    }

    // ─────────────── SMART HOME UPDATE ───────────────
    if (payload.type === 'SMART_HOME_UPDATE') {
        const device = payload.device;
        const state = payload.state;
        let icon, stateText;

        switch (device) {
            case 'Lights':
                icon = state.on ? '💡' : '🌑';
                stateText = state.on ? 'ON' : 'OFF';
                break;
            case 'Fan':
                icon = state.on ? '🌀' : '⭕';
                stateText = state.on ? 'ON (spinning)' : 'OFF';
                break;
            case 'AC':
                icon = '❄️';
                stateText = `${state.temperature}°C`;
                break;
            default:
                icon = '⚙️';
                stateText = JSON.stringify(state);
        }

        console.log('');
        console.log('  ┌─── 🏠 Smart Home Update ─────────────────────┐');
        console.log(`  │  ${icon}  ${device} → ${stateText}`);
        console.log('  └───────────────────────────────────────────────┘');

        if (device === 'Lights') {
            if (state.on) {
                console.log('  💡 [HOME ASSISTANT] light.office_lamp → turn_on (brightness: 100%)');
            } else {
                console.log('  🌑 [HOME ASSISTANT] light.office_lamp → turn_off');
            }
        } else if (device === 'Fan') {
            console.log(`  🌀 [HOME ASSISTANT] fan.office → ${state.on ? 'turn_on' : 'turn_off'}`);
        } else if (device === 'AC') {
            console.log(`  ❄️  [HOME ASSISTANT] climate.office_thermostat → set_temperature: ${state.temperature}°C`);
        }

        triggerHaptic('task_complete');
        console.log('');
        return;
    }

    // ─────────────── PERSONA CHANGE ───────────────
    if (payload.type === 'PERSONA_CHANGE') {
        const isTaskmaster = payload.persona === 'Concise Taskmaster';
        const icon = isTaskmaster ? '⚡' : '💜';
        activePersona = isTaskmaster ? 'tech_lead' : 'creative_genie';
        console.log('');
        console.log('  ┌─── 🎭 Persona Switch ────────────────────────┐');
        console.log(`  │  ${icon}  ${payload.persona}`);
        console.log(`  │  AI Style: ${isTaskmaster ? 'Brief, clinical, objective' : 'Friendly, empathic, natural'}`);
        console.log('  └───────────────────────────────────────────────┘');
        triggerHaptic('task_complete');
        console.log('');
        return;
    }

    // ─────────────── TONE DIAL UPDATE ───────────────
    if (payload.type === 'TONE_DIAL_UPDATE') {
        toneLevel = payload.level / 100;
        const bar = '█'.repeat(Math.round(payload.level / 5)) + '░'.repeat(20 - Math.round(payload.level / 5));
        console.log('');
        console.log('  ┌─── 🎛️  Tone Dial Update ─────────────────────┐');
        console.log(`  │  [${bar}] ${payload.level}%`);
        console.log(`  │  Style: ${payload.style} | AI Temp: ${payload.temperature}`);
        console.log('  └───────────────────────────────────────────────┘');
        triggerHaptic('ai_thinking');
        console.log('');
        return;
    }

    // ─────────────── NEW MESSAGE ───────────────
    if (payload.type === 'NEW_MESSAGE') {
        messageCount++;
        const color = getPlatformColor(payload.platform);

        console.log('');
        console.log('  ╔═══════════════════════════════════════════════╗');
        console.log(`  ║  📨 NEW MESSAGE #${messageCount}                          ║`);
        console.log('  ╠═══════════════════════════════════════════════╣');
        console.log(`  ║  Platform:  ${color.icon} ${payload.platform?.toUpperCase()}`);
        console.log(`  ║  Sender:    ${payload.sender}`);
        console.log(`  ║  Summary:   ${payload.summary}`);
        console.log(`  ║  Urgency:   ${payload.urgency === 'High' ? '🔴 HIGH' : '🟢 LOW'}`);
        console.log(`  ║  VIP:       ${payload.isVip ? '⭐ YES' : '—'}`);
        console.log(`  ║  Haptic:    ${payload.haptic_type}`);
        console.log(`  ║  LED Color: ${color.hex} (${color.name})`);
        console.log('  ╚═══════════════════════════════════════════════╝');

        // Trigger haptic feedback
        triggerHaptic(payload.haptic_type);

        // Save to history (Rotary Recall — mirrors UnipileMessagingBridge.cs)
        messageHistory.unshift(payload);
        if (messageHistory.length > 10) messageHistory.pop();
        historyIndex = 0;

        // LCD Genie Bubble update
        console.log(`  🫧 [LCD] Genie Bubble updated: "${payload.summary}"`);
        console.log('');
    }
}

// ═══════════════════════════════════════════════════
// Interactive Commands (stdin)
// ═══════════════════════════════════════════════════

function showHelp() {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════╗');
    console.log('  ║        🎮 HARDWARE SIMULATOR COMMANDS         ║');
    console.log('  ╠═══════════════════════════════════════════════╣');
    console.log('  ║  1 / 2 / 3   → Switch persona (LCD key)     ║');
    console.log('  ║  + / -       → Rotate Tone Dial              ║');
    console.log('  ║  n / p       → Rotary Recall (next/prev)    ║');
    console.log('  ║  s           → Show current state            ║');
    console.log('  ║  h           → Show this help                ║');
    console.log('  ║  q           → Quit                          ║');
    console.log('  ╚═══════════════════════════════════════════════╝');
    console.log('');
}

function showState() {
    const style = toneLevel <= 0.3 ? 'Concise' : toneLevel <= 0.6 ? 'Balanced' : 'Creative';
    const temp = toneLevel <= 0.3 ? 0.1 : toneLevel <= 0.6 ? 0.5 : 0.9;
    const persona = Object.values(PERSONAS).find(p => p.id === activePersona);

    console.log('');
    console.log('  ┌─── Current State ─────────────────────────┐');
    console.log(`  │  Persona:       ${persona?.name || activePersona}`);
    console.log(`  │  Tone Level:    ${toneLevel.toFixed(1)} (${style})`);
    console.log(`  │  AI Temperature: ${temp.toFixed(1)}`);
    console.log(`  │  Messages:      ${messageHistory.length} in history`);
    console.log(`  │  History Index:  ${historyIndex >= 0 ? historyIndex + 1 : '-'}/${messageHistory.length}`);
    console.log('  └───────────────────────────────────────────┘');
    console.log('');
}

function handleCommand(cmd) {
    switch (cmd.trim()) {
        case '1':
            activePersona = 'creative_genie';
            console.log(`\n  🎨 [LCD KEY] Switched persona → Creative Genie`);
            triggerHaptic('task_complete');
            break;
        case '2':
            activePersona = 'tech_lead';
            console.log(`\n  ⚙️  [LCD KEY] Switched persona → Technical Lead`);
            triggerHaptic('task_complete');
            break;
        case '3':
            activePersona = 'smart_home_warden';
            console.log(`\n  🏠 [LCD KEY] Switched persona → Smart Home Warden`);
            triggerHaptic('task_complete');
            break;
        case '+':
            toneLevel = Math.min(1.0, Math.round((toneLevel + 0.1) * 10) / 10);
            const styleUp = toneLevel <= 0.3 ? 'Concise' : toneLevel <= 0.6 ? 'Balanced' : 'Creative';
            console.log(`\n  🔄 [DIAL] Tone Level: ${toneLevel.toFixed(1)} (${styleUp})`);
            triggerHaptic('ai_thinking');
            break;
        case '-':
            toneLevel = Math.max(0.0, Math.round((toneLevel - 0.1) * 10) / 10);
            const styleDown = toneLevel <= 0.3 ? 'Concise' : toneLevel <= 0.6 ? 'Balanced' : 'Creative';
            console.log(`\n  🔄 [DIAL] Tone Level: ${toneLevel.toFixed(1)} (${styleDown})`);
            triggerHaptic('ai_thinking');
            break;
        case 'n':
            if (messageHistory.length === 0) { console.log('\n  ⚠️  No messages in history.'); break; }
            historyIndex = Math.min(historyIndex + 1, messageHistory.length - 1);
            const next = messageHistory[historyIndex];
            console.log(`\n  🔁 [ROTARY RECALL] ${historyIndex + 1}/${messageHistory.length}: "${next.summary}"`);
            break;
        case 'p':
            if (messageHistory.length === 0) { console.log('\n  ⚠️  No messages in history.'); break; }
            historyIndex = Math.max(historyIndex - 1, 0);
            const prev = messageHistory[historyIndex];
            console.log(`\n  🔁 [ROTARY RECALL] ${historyIndex + 1}/${messageHistory.length}: "${prev.summary}"`);
            break;
        case 's':
            showState();
            break;
        case 'h':
            showHelp();
            break;
        case 'q':
            console.log('\n  👋 Disconnecting hardware simulator...\n');
            process.exit(0);
        default:
            console.log(`  ❓ Unknown command: "${cmd.trim()}". Type 'h' for help.`);
    }
}

// ═══════════════════════════════════════════════════
// WebSocket Connection (with auto-reconnect)
// ═══════════════════════════════════════════════════

function connect() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════╗');
    console.log('  ║  🧞 Genie in a Bottle — Hardware Simulator      ║');
    console.log('  ║  Simulates: MX Creative Console + MX Master 4   ║');
    console.log('  ╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  🔌 Connecting to ${WS_URL} as HARDWARE client...`);

    const ws = new WebSocket(WS_URL); // No ?client=dashboard

    ws.on('open', () => {
        console.log('  ✅ Hardware handshake complete!');
        console.log('  📡 Dashboard should now show: Logitech Hardware → Connected');
        console.log('');
        console.log('  Waiting for incoming messages...');
        console.log('  Type "h" for interactive commands.\n');
    });

    ws.on('message', (data) => {
        try {
            handleMessage(data.toString());
        } catch (e) {
            console.error('  ❌ Parse error:', e.message);
        }
    });

    ws.on('close', () => {
        console.log(`\n  ⚠️  Disconnected. Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
        setTimeout(connect, RECONNECT_DELAY);
    });

    ws.on('error', (err) => {
        console.error(`  ❌ Connection error: ${err.message}`);
    });
}

// ═══════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════

connect();

// Enable interactive keyboard input
process.stdin.setEncoding('utf8');
process.stdin.on('data', handleCommand);
