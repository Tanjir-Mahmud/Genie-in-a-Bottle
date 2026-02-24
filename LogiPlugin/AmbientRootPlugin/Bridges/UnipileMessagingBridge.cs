using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json;
using AmbientRootPlugin.Core;
using AmbientRootPlugin.Models;

namespace AmbientRootPlugin.Bridges;

/// <summary>
/// Unified Messaging Bridge connecting to the Node.js backend via WebSocket.
/// Receives NEW_MESSAGE payloads from Unipile (Telegram, Slack, WhatsApp)
/// and routes haptic feedback to the MX Master 4.
/// </summary>
public class UnipileMessagingBridge
{
    // --- Events ---
    public event Action<MessagePayload>? MessageReceived;

    // --- Dependencies ---
    private readonly HapticEngine _hapticEngine;
    private readonly string _webSocketUrl;

    // --- Internal State ---
    private ClientWebSocket _webSocket = new();
    private CancellationTokenSource _cts = new();
    private readonly List<MessagePayload> _messageHistory = new();
    private int _historyIndex = -1;

    public IReadOnlyList<MessagePayload> MessageHistory => _messageHistory.AsReadOnly();
    public int HistoryIndex => _historyIndex;

    public UnipileMessagingBridge(HapticEngine hapticEngine, string webSocketUrl = "ws://localhost:3002")
    {
        _hapticEngine = hapticEngine;
        _webSocketUrl = webSocketUrl;
    }

    /// <summary>
    /// Start the WebSocket connection with auto-reconnect.
    /// Runs as a background task — never blocks the plugin Load().
    /// </summary>
    public async Task ConnectAsync()
    {
        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                if (_webSocket.State == WebSocketState.Aborted || _webSocket.State == WebSocketState.Closed)
                {
                    _webSocket.Dispose();
                    _webSocket = new ClientWebSocket();
                }

                var uri = new Uri(_webSocketUrl);
                await _webSocket.ConnectAsync(uri, _cts.Token);
                Console.WriteLine($"[MESSAGING] Connected to backend at {_webSocketUrl}");

                // Subtle vibration on successful connection
                _hapticEngine.TriggerWaveform("task_complete");

                await ReceiveLoop();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MESSAGING] Connection error: {ex.Message}. Retrying in 5 seconds...");
                try { await Task.Delay(5000, _cts.Token); } catch { break; }
            }
        }
    }

    private async Task ReceiveLoop()
    {
        var buffer = new byte[1024 * 4];
        while (_webSocket.State == WebSocketState.Open)
        {
            var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, _cts.Token);
                return;
            }

            var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
            HandleMessage(json);
        }
    }

    private void HandleMessage(string json)
    {
        try
        {
            var raw = JsonConvert.DeserializeObject<dynamic>(json);
            if (raw == null) return;

            string type = raw.type ?? "";

            // Skip UI-only messages
            if (type == "PRIVACY_LOG_UPDATE" || type == "CONNECTED") return;

            if (type == "NEW_MESSAGE")
            {
                var payload = new MessagePayload
                {
                    Type = type,
                    Platform = raw.platform ?? "unknown",
                    Sender = raw.sender ?? "Unknown",
                    Summary = raw.summary ?? "No Summary",
                    Urgency = raw.urgency ?? "Low",
                    IsVip = raw.isVip ?? false,
                    HapticType = raw.haptic_type ?? "silent",
                    Timestamp = raw.timestamp ?? ""
                };

                // Save to history for Rotary Recall
                _messageHistory.Insert(0, payload);
                if (_messageHistory.Count > 10) _messageHistory.RemoveAt(10);
                _historyIndex = 0;

                Console.WriteLine($"[MESSAGING] Alert: {payload.Summary} (Urgency: {payload.Urgency}, VIP: {payload.IsVip}, Haptic: {payload.HapticType})");

                // Trigger haptic feedback
                _hapticEngine.TriggerWaveform(payload.HapticType);

                // Notify subscribers (PersonaManager, UI, etc.)
                MessageReceived?.Invoke(payload);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[MESSAGING] Parse error: {ex.Message}");
        }
    }

    /// <summary>
    /// Scroll through message history via Rotary Recall (encoder rotation).
    /// </summary>
    public MessagePayload? RotaryRecall(int ticks)
    {
        if (_messageHistory.Count == 0) return null;

        _historyIndex = Math.Clamp(_historyIndex + ticks, 0, _messageHistory.Count - 1);
        var msg = _messageHistory[_historyIndex];

        Console.WriteLine($"[MESSAGING] Rotary Recall: {msg.Summary} ({_historyIndex + 1}/{_messageHistory.Count})");
        return msg;
    }

    /// <summary>
    /// Gracefully disconnect.
    /// </summary>
    public void Disconnect()
    {
        _cts.Cancel();
        _webSocket.Dispose();
    }
}
