# 🧞 Genie in a Bottle

**An Ambient AI Cockpit for the Logitech MX Creative Console & MX Master 4**

> Move notifications off the screen and into your hardware — with haptic alerts, smart home control, and a Privacy Shield that redacts PII before it ever hits the display.

[![Built with Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](https://nodejs.org)
[![Next.js Dashboard](https://img.shields.io/badge/Dashboard-Next.js%2016-000000?logo=next.js)](https://nextjs.org)
[![Logitech Plugin](https://img.shields.io/badge/Plugin-C%23%20.NET%208-512BD4?logo=dotnet)](https://dotnet.microsoft.com)
[![AI Powered](https://img.shields.io/badge/AI-GPT--4o%20%2F%20Ollama-412991?logo=openai)](https://openai.com)

---

## 🔥 The Big Problem

| Problem | The Reality |
|---------|------------|
| **App Fatigue** | Knowledge workers switch between apps **1,200+ times/day**, losing ~3 hours to refocusing |
| **Setup Friction** | 52% of users report setup difficulties; most smart systems require QR codes or developer apps |
| **Privacy Paradox** | 90% of smart device data gets intercepted; 80% of users don't understand their device's data practices |
| **Failed Hardware** | Humane AI Pin ($699) and Rabbit R1 tried to *replace* phones — and failed. Users don't want more devices |

**Genie in a Bottle solves all four** by enhancing hardware you *already own* — the Logitech MX Creative Console and MX Master 4.

---

## 💡 What It Does

### 1. Unified Messaging Bridge
Connects **Telegram, Slack, and Facebook** through Unipile. Messages are normalized, run through **GPT-4o** for AI summarization, urgency classification, and VIP detection — then delivered as hardware feedback.

### 2. Haptic Intelligence Engine
Instead of screen popups, the **MX Master 4 mouse vibrates** with distinct patterns:

| Pattern | Trigger | Feel |
|---------|---------|------|
| 💓 **Heartbeat** | VIP sender (Boss, Mom) | 2 slow pulses |
| 📳 **Double Pulse** | High urgency message | 2 quick taps |
| 🔇 **Silent** | Low priority | No vibration, silently queued |

### 3. Privacy Shield (Server-Side PII Redaction)
**10 regex patterns** scrub sensitive data *before* it reaches the UI or database:

```
Passwords → [PASSWORD REDACTED]    Credit Cards → [CARD REDACTED]
SSNs      → [SSN REDACTED]        Phone Numbers → [PHONE REDACTED] 
Emails    → [EMAIL REDACTED]       API Keys → [API_KEY REDACTED]
IBANs     → [IBAN REDACTED]       Crypto Wallets → [CRYPTO_ADDR REDACTED]
IPs       → [IP REDACTED]         PINs/OTPs → [PIN REDACTED]
```

### 4. Smart Home Automation
Via **Home Assistant REST API** (local LAN only):
- After 2 hours in Work Mode → auto-dims lights to 40%, sets thermostat to 22°C
- All traffic stays on local network — no cloud dependency

### 5. Tone Dial
Rotate the MX Creative dial to physically adjust the AI's response style:
- **Concise** (0.1 temp) → **Balanced** (0.5) → **Creative** (0.9)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  Telegram ──→ Unipile API ──→ ngrok tunnel                  │
│                                    │                         │
│  OpenAI GPT-4o-mini ◄──── LangChain.js                     │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│              NODE.JS BACKEND (port 3001)                     │
│                                                              │
│  POST /webhook ──→ Normalize ──→ AI Pipeline ──→ redactPII  │
│                                                     │        │
│                              ┌──────────────────────┤        │
│                              ▼                      ▼        │
│                         SQLite DB            WebSocket :3002 │
│                      (ambient_root.db)       ┌───────┴──┐    │
│                                              │          │    │
└──────────────────────────────────────────────┼──────────┼────┘
                                               │          │
                    ┌──────────────────────────┐│          │
                    │   NEXT.JS DASHBOARD :3000││          │
                    │  (PRIVACY_LOG_UPDATE)     ◄┘          │
                    │   3-Column Dark UI       │           │
                    └──────────────────────────┘           │
                                                           │
                    ┌──────────────────────────────────────┐│
                    │   C# LOGITECH PLUGIN                 ◄┘
                    │  (NEW_MESSAGE)                        │
                    │   HapticEngine → MX Master 4 vibrate │
                    │   PersonaManager → LCD key icons      │
                    │   ToneDial → AI temperature control   │
                    │   SmartHomeBridge → Home Assistant     │
                    └──────────────────────────────────────┘
```

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- **.NET 8 SDK** (for the Logitech plugin, optional)
- **Unipile Account** (free tier available at [unipile.com](https://unipile.com))
- **OpenAI API Key** or **Ollama** running locally

### Step 1: Clone the Repository

```bash
git clone https://github.com/Tanjir-Mahmud/Genie-in-a-Bottle.git
cd Genie-in-a-Bottle
```

### Step 2: Install Backend Dependencies

```bash
npm install
```

### Step 3: Install Dashboard Dependencies

```bash
cd dashboard
npm install
cd ..
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Unipile Messaging API
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_DSN=https://api1.unipile.com:13111

# AI Configuration (choose one)
OPENAI_API_KEY=your_openai_api_key
USE_LOCAL_AI=false
LOCAL_MODEL_ID=llama3
LOCAL_AI_URL=http://localhost:11434

# Optional: Public webhook tunnel
NGROK_AUTHTOKEN=your_ngrok_token
```

### Step 5: Start the Backend

```bash
node server.js
```

You should see:
```
Ambient Root Backend running at http://localhost:3001
WebSocket Server running at ws://localhost:3002
Connected to the local SQLite database.
🌐 [NGROK] Public Webhook URL: https://xxxxx.ngrok-free.dev/webhook
```

### Step 6: Start the Dashboard

```bash
cd dashboard
npm run dev
```

Open **http://localhost:3000** in your browser.

### Step 7: Start the Hardware Simulator (No Logitech Device Needed)

```bash
node simulate_hardware.js
```

This simulates the Logitech MX Creative Console + MX Master 4. The dashboard will show **Logitech Hardware: Connected**.

Interactive commands in the simulator:
| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Switch AI persona |
| `+` / `-` | Rotate Tone Dial |
| `n` / `p` | Scroll message history (Rotary Recall) |
| `s` | Show current state |
| `h` | Help |

---

## 📁 Project Structure

```
Genie-in-a-Bottle/
├── server.js                    # Express + WebSocket backend
├── agent.js                     # AI pipeline (OpenAI / Ollama)
├── db.js                        # SQLite persistence
├── simulate_hardware.js         # Hardware simulator (no device needed)
├── .env                         # API keys (gitignored)
├── package.json                 # Backend dependencies
│
├── dashboard/                   # Next.js 16 frontend
│   ├── src/app/
│   │   ├── page.tsx             # 3-column dashboard UI
│   │   ├── globals.css          # Dark cyberpunk theme
│   │   └── layout.tsx           # Root layout + fonts
│   └── next.config.ts           # API proxy config
│
└── LogiPlugin/                  # C# Logitech plugin
    └── AmbientRootPlugin/
        ├── AmbientRootPlugin.cs # Main plugin entry point
        ├── Core/
        │   ├── HapticEngine.cs  # 6 haptic waveform patterns
        │   ├── PersonaManager.cs # 3 AI personas
        │   └── ToneDial.cs      # Dial → AI temperature mapping
        ├── Bridges/
        │   ├── UnipileMessagingBridge.cs  # WebSocket client
        │   └── SmartHomeBridge.cs        # Home Assistant integration
        └── Models/              # Data models
```

---

## 🛡️ Privacy & Security

- **Server-side redaction**: PII is scrubbed *before* reaching the frontend or database
- **Local-first storage**: All data stays in SQLite on your machine
- **No cloud telemetry**: Zero analytics, no tracking
- **Local AI option**: Switch to Ollama for fully offline inference
- **LAN-only smart home**: Home Assistant traffic never leaves your network

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Node.js, Express, WebSocket (ws), SQLite3, dotenv |
| **AI** | LangChain.js, OpenAI GPT-4o-mini, Ollama (llama3) |
| **Messaging** | Unipile API (Telegram, Slack, Facebook) |
| **Frontend** | Next.js 16, React, TypeScript, Tailwind CSS v4, Framer Motion |
| **Plugin** | C# 12, .NET 8, Loupedeck SDK, Newtonsoft.Json |
| **Smart Home** | Home Assistant REST API |
| **Tunnel** | ngrok |

---

## 📄 License

Built for the **Logitech DevStudio Challenge 2026**.
