'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Moon,
  Sun,
  Lightbulb,
  Fan,
  Thermometer,
  Settings,
  ShieldCheck,
  MessageSquare,
  Volume2,
  X,
  Send,
  History,
  RefreshCw,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ════════════════════════════════════════
// Types
// ════════════════════════════════════════

interface LogEntry {
  id: number;
  platform: string;
  sender: string;
  content: string;
  summary?: string;
  urgency?: string;
  timestamp: string;
}

// ════════════════════════════════════════
// Main Component
// ════════════════════════════════════════

export default function GenieDashboard() {
  // --- State ---
  const [step, setStep] = useState<'onboarding' | 'dashboard'>('onboarding');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [context, setContext] = useState('Work');
  const [persona, setPersona] = useState('Concise Taskmaster');
  const [toneValue, setToneValue] = useState(30);
  const [useLocalAi, setUseLocalAi] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Smart Home state
  const [lightsOn, setLightsOn] = useState(true);
  const [fanOn, setFanOn] = useState(false);
  const [acTemp, setAcTemp] = useState(24);

  // Genie Alert state
  const [genieAlert, setGenieAlert] = useState<LogEntry | null>(null);

  // ════════════════════════════════════════
  // Lifecycle
  // ════════════════════════════════════════

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const savedIdentity = localStorage.getItem('ambient_root_linked');
      if (savedIdentity) {
        setStep('dashboard');
      }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('linked') === 'true') {
        localStorage.setItem('ambient_root_linked', JSON.stringify({ provider: 'unipile', linked_at: new Date().toISOString() }));
        setStep('dashboard');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('error') === 'auth_failed') {
        alert('Authentication failed or was cancelled.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // --- API Calls ---

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('Status fetch failed');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Logs fetch failed');
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setUseLocalAi(data.useLocalAi);
    } catch (e) {
      console.error('Config fetch failed');
    }
  };

  const updateContext = async (newContext: string) => {
    try {
      await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: newContext }),
      });
      setContext(newContext);
    } catch (e) {
      console.error('Context update failed');
    }
  };

  const updatePersona = async (newPersona: string) => {
    try {
      await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: newPersona }),
      });
      setPersona(newPersona);
    } catch (e) {
      console.error('Persona update failed');
    }
  };

  const toggleLocalAi = async (enabled: boolean) => {
    try {
      await fetch('/api/config/toggle-local-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setUseLocalAi(enabled);
    } catch (e) {
      console.error('Local AI toggle failed');
    }
  };

  const handleOnboarding = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/auth/link-account/telegram`);
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      }
    } catch (e) {
      alert('Pairing failed. Check server status.');
    }
    setIsLoading(false);
  };

  const simulateMessage = async () => {
    try {
      await fetch('http://127.0.0.1:3001/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'message_received',
          account_type: 'TELEGRAM',
          message: "Hey there! Hope you're having a good day at home. We've got a little something that's come up at the office, and we could really use your help with it soon. Would you be able to make your way in as quickly as you can? Once you're here, the first step is to please log into the office dashboard. Thanks a bunch!",
          sender: { attendee_name: 'Boss' },
          attachments: []
        }),
      });
    } catch (e) {
      console.error('Simulate failed');
    }
  };

  // --- Smart Home & Hardware Bridge ---

  const toggleSmartHome = async (device: string, newState: any) => {
    try {
      await fetch('/api/smart-home/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, state: newState }),
      });
    } catch (e) {
      console.error('Smart home toggle failed');
    }
  };

  const updateToneDial = async (level: number) => {
    try {
      await fetch('/api/tone-dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
    } catch (e) {
      console.error('Tone dial update failed');
    }
  };

  // --- WebSocket + Polling ---
  useEffect(() => {
    if (step === 'dashboard') {
      fetchStatus();
      fetchLogs();
      fetchConfig();
      const interval = setInterval(fetchStatus, 5000);

      let ws: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let isCleaned = false;

      const connectWs = () => {
        if (isCleaned) return;
        ws = new WebSocket('ws://localhost:3002/?client=dashboard');

        ws.onopen = () => console.log('[WS] Connected');

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'PRIVACY_LOG_UPDATE') {
              const entry: LogEntry = {
                id: Date.now(),
                platform: payload.platform,
                sender: payload.sender || 'Unknown',
                content: payload.content,
                summary: payload.summary || '',
                urgency: payload.urgency || 'Low',
                timestamp: payload.timestamp || new Date().toISOString(),
              };
              setLogs((prev) => [entry, ...prev]);
              setGenieAlert(entry);
            }
          } catch (e) {
            console.error('[WS] Parse error', e);
          }
        };

        ws.onclose = () => {
          if (!isCleaned) {
            reconnectTimer = setTimeout(connectWs, 5000);
          }
        };

        ws.onerror = () => ws?.close();
      };

      connectWs();

      return () => {
        isCleaned = true;
        clearInterval(interval);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        ws?.close();
      };
    }
  }, [step]);

  // ════════════════════════════════════════
  // Onboarding Screen
  // ════════════════════════════════════════

  if (step === 'onboarding') {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="genie-card w-full max-w-md flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <Zap className="text-primary" size={32} />
            </div>
            <h1 className="text-2xl font-bold">Genie in a Bottle</h1>
            <p className="text-foreground/50 text-sm text-center">Unified AI Hardware Bridge for Logitech MX</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={isClient ? handleOnboarding : undefined}
              disabled={isLoading || !isClient}
              className="genie-btn genie-btn-primary disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={18} /> : 'Link Telegram Account'}
            </button>
            <button
              onClick={() => { localStorage.setItem('ambient_root_linked', 'true'); setStep('dashboard'); }}
              className="genie-btn genie-btn-ghost"
            >
              Skip & Go to Dashboard <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3 px-2 pb-2">
            <ShieldCheck className="text-primary shrink-0" size={18} />
            <p className="text-[11px] text-foreground/40 leading-relaxed">
              All PII is scrubbed locally before generating summaries.
            </p>
          </div>
        </motion.div>
      </main>
    );
  }

  // ════════════════════════════════════════
  // Dashboard (3-Column Layout)
  // ════════════════════════════════════════

  return (
    <>
      <main className="min-h-screen p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-6 max-w-[1400px] mx-auto">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex flex-col gap-5">

            {/* Status Hub */}
            <div className="genie-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="text-primary" size={18} />
                  <h2 className="font-bold text-sm">Status Hub</h2>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${context === 'Work'
                  ? 'text-primary bg-primary/10 border-primary/30'
                  : 'text-accent-green bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                  {context} Mode
                </span>
              </div>

              {/* Work / Home Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateContext('Work')}
                  className={`context-btn ${context === 'Work' ? 'context-btn-active' : 'context-btn-inactive'}`}
                >
                  <Sun size={20} />
                  Work
                </button>
                <button
                  onClick={() => updateContext('Home')}
                  className={`context-btn ${context === 'Home' ? 'context-btn-active' : 'context-btn-inactive'}`}
                >
                  <Moon size={20} />
                  Home
                </button>
              </div>
            </div>

            {/* Smart Home */}
            <div className="genie-card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="text-[#ffd700]" size={18} />
                <h2 className="font-bold text-sm">Smart Home</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { const next = !lightsOn; setLightsOn(next); toggleSmartHome('Lights', { on: next }); }}
                  className={`smart-tile ${lightsOn ? 'smart-tile-active' : ''}`}
                >
                  <Lightbulb size={22} />
                  <span className="text-xs font-medium">Lights</span>
                </button>
                <button
                  onClick={() => { const next = !fanOn; setFanOn(next); toggleSmartHome('Fan', { on: next }); }}
                  className={`smart-tile ${fanOn ? 'smart-tile-active' : ''}`}
                >
                  <Fan size={22} className={fanOn ? 'animate-spin' : ''} />
                  <span className="text-xs font-medium">Fan</span>
                </button>
                <button
                  onClick={() => { const next = acTemp === 24 ? 22 : 24; setAcTemp(next); toggleSmartHome('AC', { temperature: next }); }}
                  className="smart-tile smart-tile-active"
                >
                  <Thermometer size={22} />
                  <span className="text-xs font-medium text-primary">AC: {acTemp}°C</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="smart-tile"
                >
                  <Settings size={22} />
                  <span className="text-xs font-medium">Settings</span>
                </button>
              </div>
            </div>

            {/* Tone Dial */}
            <div className="genie-card">
              <div className="flex items-center gap-2 mb-5">
                <Volume2 className="text-foreground/60" size={18} />
                <h2 className="font-bold text-sm">The Tone Dial</h2>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={toneValue}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setToneValue(val);
                  updateToneDial(val);
                  if (val < 50) {
                    updatePersona('Concise Taskmaster');
                  } else {
                    updatePersona('Empathetic Companion');
                  }
                }}
                className="tone-slider"
              />

              <div className="flex justify-between mt-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${persona === 'Concise Taskmaster' ? 'text-primary' : 'text-foreground/30'}`}>
                  Taskmaster
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${persona === 'Empathetic Companion' ? 'text-[#b066ff]' : 'text-foreground/30'}`}>
                  Companion
                </span>
              </div>
            </div>

          </div>

          {/* ═══ CENTER COLUMN ═══ */}
          <div className="flex flex-col gap-5">

            {/* Genie Alert */}
            <div className="genie-card flex-1 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">

              {/* Background glow */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/5 blur-3xl" />
              </div>

              {/* Header */}
              <div className="relative z-10 flex flex-col items-center gap-2 mb-2">
                <h2 className="text-2xl font-black tracking-wide italic">GENIE ALERT</h2>
                <div className="w-16 h-1 rounded-full bg-primary" />
              </div>

              {/* Shield Icon */}
              <div className="relative z-10 my-6">
                <ShieldCheck size={64} className="text-foreground/15 shield-glow" />
              </div>

              {/* Alert Content */}
              <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6 w-full max-w-md">
                <AnimatePresence mode="wait">
                  {genieAlert ? (
                    <motion.div
                      key={genieAlert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="genie-card !bg-surface/80 w-full text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase text-primary">{genieAlert.platform}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${genieAlert.urgency === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                          }`}>{genieAlert.urgency}</span>
                      </div>
                      <p className="text-xs text-foreground/70">{genieAlert.sender}:</p>
                      <p className="text-sm text-foreground/90 leading-relaxed mt-1">
                        {genieAlert.content?.substring(0, 200)}{(genieAlert.content?.length || 0) > 200 ? '...' : ''}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <MessageSquare size={40} className="text-foreground/15 soft-pulse" />
                      <p className="text-sm text-foreground/30">Waiting for incoming context...</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Simulate Button */}
              <button
                onClick={simulateMessage}
                className="genie-btn genie-btn-primary mt-8 relative z-10"
              >
                <Send size={14} />
                Simulate Telegram Message
              </button>
            </div>

          </div>

          {/* ═══ RIGHT COLUMN ═══ */}
          <div className="flex flex-col gap-5">

            {/* Audit Log */}
            <div className="genie-card !p-0 flex flex-col h-full max-h-[calc(100vh-80px)] overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <History size={14} className="text-foreground/40" />
                <h2 className="font-bold text-sm">Audit Log</h2>
              </div>

              <div className="flex-1 overflow-y-auto px-4">
                {logs.length > 0 ? logs.map((log: LogEntry, idx: number) => (
                  <div key={`${log.id}-${idx}`} className="audit-entry">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-primary/80">{log.platform}</span>
                      <span className="text-[10px] text-foreground/30">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.urgency && (
                      <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full mb-1 ${log.urgency === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                        }`}>{log.urgency}</span>
                    )}
                    <p className="text-xs text-foreground/70 leading-relaxed line-clamp-4">
                      {log.content}
                    </p>
                  </div>
                )) : (
                  <div className="py-12 flex flex-col items-center gap-3 text-foreground/20">
                    <RefreshCw className="soft-pulse" size={20} />
                    <span className="text-xs">No logs yet</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* ═══ SETTINGS MODAL ═══ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-border transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Platform Connections */}
              <div className="flex flex-col gap-4 mb-6">
                <h3 className="text-xs font-bold uppercase text-foreground/40 tracking-wider">Platform Connections</h3>

                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status?.telegram === 'Connected' ? 'bg-green-500 glow-green' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">Telegram</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${status?.telegram === 'Connected' ? 'text-green-400' : 'text-red-400'}`}>
                    {status?.telegram || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status?.unipile === 'Connected' ? 'bg-green-500 glow-green' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">Slack / Facebook</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${status?.unipile === 'Connected' ? 'text-green-400' : 'text-red-400'}`}>
                    {status?.unipile || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${status?.logitech === 'Connected' ? 'bg-green-500 glow-green' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">Logitech Hardware</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${status?.logitech === 'Connected' ? 'text-green-400' : 'text-red-400'}`}>
                    {status?.logitech === 'Connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* AI Config */}
              <div className="flex flex-col gap-4 mb-6">
                <h3 className="text-xs font-bold uppercase text-foreground/40 tracking-wider">AI Engine</h3>

                <div className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Local-First AI</span>
                    <span className="text-[10px] text-foreground/40">Ollama Inference</span>
                  </div>
                  <button
                    onClick={() => toggleLocalAi(!useLocalAi)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${useLocalAi ? 'bg-primary' : 'bg-border'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"
                      animate={{ x: useLocalAi ? 20 : 0 }}
                    />
                  </button>
                </div>
              </div>

              {/* Account */}
              <button
                onClick={() => {
                  localStorage.removeItem('ambient_root_linked');
                  setStep('onboarding');
                  setShowSettings(false);
                }}
                className="genie-btn genie-btn-ghost w-full text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40"
              >
                Switch Account
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
