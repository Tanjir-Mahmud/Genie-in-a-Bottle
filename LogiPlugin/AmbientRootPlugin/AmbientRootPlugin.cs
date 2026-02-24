using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Loupedeck;
using AmbientRootPlugin.Core;
using AmbientRootPlugin.Bridges;

namespace AmbientRootPlugin
{
    /// <summary>
    /// Genie in a Bottle — Main Plugin Entry Point
    /// 
    /// Transforms the MX Creative Console + MX Master 4 into a sentient AI cockpit.
    /// Wires together: PersonaManager, HapticEngine, ToneDial,
    /// UnipileMessagingBridge, and SmartHomeBridge.
    /// </summary>
    public class AmbientRootPlugin : Plugin
    {
        // --- Core Modules ---
        private readonly PersonaManager _personaManager = new();
        private readonly HapticEngine _hapticEngine = new();
        private readonly ToneDial _toneDial = new();

        // --- Bridges ---
        private UnipileMessagingBridge? _messagingBridge;
        private SmartHomeBridge? _smartHomeBridge;

        // --- Timers ---
        private System.Timers.Timer? _heartbeatTimer;
        private System.Timers.Timer? _focusModeTimer;

        // --- Plugin Configuration ---
        public override bool HasNoApplication => true;
        public override bool UsesApplicationApiOnly => true;

        // ================================================================
        // LIFECYCLE
        // ================================================================

        public override void Load()
        {
            Console.WriteLine("╔══════════════════════════════════════════╗");
            Console.WriteLine("║  🧞 Genie in a Bottle — Plugin Loaded   ║");
            Console.WriteLine("╚══════════════════════════════════════════╝");

            // --- Wire Events ---
            _personaManager.PersonaChanged += OnPersonaChanged;
            _toneDial.ToneLevelChanged += OnToneLevelChanged;

            // --- Initialize Messaging Bridge ---
            _messagingBridge = new UnipileMessagingBridge(_hapticEngine);
            _messagingBridge.MessageReceived += OnMessageReceived;
            _ = _messagingBridge.ConnectAsync(); // Fire-and-forget async

            // --- Initialize Smart Home Bridge ---
            try
            {
                var config = LoadSmartHomeConfig();
                _smartHomeBridge = new SmartHomeBridge(_hapticEngine, config);
                Console.WriteLine("[INIT] Smart Home Bridge initialized (local-first).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[INIT] Smart Home Bridge skipped: {ex.Message}");
            }

            // --- Heartbeat Timer (hourly alive pulse) ---
            _heartbeatTimer = new System.Timers.Timer(60 * 60 * 1000); // 1 hour
            _heartbeatTimer.Elapsed += (s, e) => _hapticEngine.TriggerWaveform("heartbeat");
            _heartbeatTimer.AutoReset = true;
            _heartbeatTimer.Enabled = true;

            // --- Focus Mode Check Timer (every 5 minutes) ---
            _focusModeTimer = new System.Timers.Timer(5 * 60 * 1000);
            _focusModeTimer.Elapsed += async (s, e) =>
            {
                if (_smartHomeBridge != null)
                    await _smartHomeBridge.CheckFocusMode();
            };
            _focusModeTimer.AutoReset = true;
            _focusModeTimer.Enabled = true;

            // Set default persona
            _personaManager.SetActivePersona("creative_genie");

            Console.WriteLine("[INIT] All modules loaded. Waiting for hardware events...");
        }

        // ================================================================
        // LCD KEYPAD HANDLERS
        // ================================================================

        /// <summary>
        /// Called when a display key on the LCD Keypad is pressed.
        /// Routes to PersonaManager for persona switching.
        /// </summary>
        public void OnKeyDown(string actionId)
        {
            var personaId = _personaManager.MapActionToPersonaId(actionId);
            if (personaId != null)
            {
                _personaManager.SetActivePersona(personaId);
                _hapticEngine.TriggerWaveform("task_complete"); // Crisp confirmation tap
            }
            else
            {
                Console.WriteLine($"[KEYPAD] Unknown action: {actionId}");
            }
        }

        // ================================================================
        // DIAL / ENCODER HANDLER
        // ================================================================

        /// <summary>
        /// Called when the MX Creative Dial is rotated.
        /// Routes to ToneDial for AI style adjustment.
        /// </summary>
        public void OnEncoderRotate(string actionId, int ticks)
        {
            if (actionId == "tone_dial")
            {
                _toneDial.OnRotate(ticks);
                _hapticEngine.TriggerWaveform("ai_thinking"); // Tactile dial feedback
            }
            else
            {
                // Rotary Recall: scroll through message history
                var msg = _messagingBridge?.RotaryRecall(ticks);
                if (msg != null)
                {
                    UpdateGenieBubble(msg.Summary);
                    SetPlatformColor(msg.Platform);
                }
            }
        }

        // ================================================================
        // EVENT HANDLERS
        // ================================================================

        private void OnPersonaChanged(Models.Persona persona)
        {
            Console.WriteLine($"[PLUGIN] Active persona: {persona.DisplayName}");

            // Update LCD key visuals
            // SDK Integration Point: device.SetKeyImage(actionId, bitmap);

            // If Smart Home Warden is activated, enable proactive home control
            if (persona.Id == "smart_home_warden")
            {
                Console.WriteLine("[PLUGIN] Smart Home Warden active — enabling proactive automation.");
            }
        }

        private void OnToneLevelChanged(float level)
        {
            Console.WriteLine($"[PLUGIN] Tone Dial updated → Style: {_toneDial.CurrentStyle}, AI Temp: {_toneDial.AiTemperature:F1}");

            // SDK Integration Point: Update radial overlay on dial display
            // device.SetDialOverlay(level, _toneDial.CurrentStyle);
        }

        private void OnMessageReceived(Models.MessagePayload message)
        {
            Console.WriteLine($"[PLUGIN] New message from {message.Sender}: {message.Summary}");

            // Update Genie Status Ring
            UpdateGenieBubble(message.Summary);

            // Set platform LED color
            SetPlatformColor(message.Platform);
        }

        // ================================================================
        // HARDWARE DISPLAY HELPERS
        // ================================================================

        private void UpdateGenieBubble(string summary)
        {
            Console.WriteLine($"[HARDWARE] Updating Genie Bubble: {summary}");
            // SDK Integration Point:
            // var bmp = RenderTextToBitmap(summary);
            // device.SetActionImage("genie_status", bmp);
        }

        private void SetPlatformColor(string platform)
        {
            string color = platform switch
            {
                "telegram" => "#2CA5E0",
                "slack"    => "#4A154B",
                "facebook" => "#0084FF",
                "whatsapp" => "#25D366",
                _          => "#FFFFFF"
            };
            Console.WriteLine($"[HARDWARE] Setting LED Color for {platform}: {color}");
            // SDK Integration Point:
            // device.SetLedColor(color);
        }

        // ================================================================
        // CONFIGURATION
        // ================================================================

        private SmartHomeConfig LoadSmartHomeConfig()
        {
            // In production, load from appsettings.json
            return new SmartHomeConfig
            {
                HomeAssistantUrl = "http://homeassistant.local:8123",
                BearerToken = "YOUR_LONG_LIVED_ACCESS_TOKEN",
                FocusMode = new FocusModeConfig
                {
                    Enabled = true,
                    WorkDurationMinutes = 120,
                    DimBrightnessPercent = 40,
                    TargetTemperatureCelsius = 22.0,
                    LightEntityId = "light.office_lamp",
                    ClimateEntityId = "climate.office_thermostat"
                }
            };
        }

        // ================================================================
        // CLEANUP
        // ================================================================

        public override void Unload()
        {
            Console.WriteLine("[PLUGIN] Genie in a Bottle shutting down...");
            _heartbeatTimer?.Dispose();
            _focusModeTimer?.Dispose();
            _messagingBridge?.Disconnect();
        }
    }
}
