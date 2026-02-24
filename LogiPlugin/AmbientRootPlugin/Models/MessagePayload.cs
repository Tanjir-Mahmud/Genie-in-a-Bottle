namespace AmbientRootPlugin.Models;

/// <summary>
/// Normalized message payload received from the Node.js backend via WebSocket.
/// Maps to the NEW_MESSAGE broadcast type from server.js.
/// </summary>
public record MessagePayload
{
    public string Type { get; init; } = "NEW_MESSAGE";
    public string Platform { get; init; } = "unknown";
    public string Sender { get; init; } = "Unknown";
    public string Summary { get; init; } = "No Summary";
    public string Urgency { get; init; } = "Low";
    public bool IsVip { get; init; } = false;
    public string HapticType { get; init; } = "silent";  // "heartbeat" | "double_pulse" | "silent"
    public string Timestamp { get; init; } = "";
}
