namespace AmbientRootPlugin.Models;

/// <summary>
/// Represents a Home Assistant entity for smart home control.
/// Used by SmartHomeBridge to track device states.
/// </summary>
public record SmartHomeDevice
{
    public string EntityId { get; init; } = "";      // "light.office_lamp"
    public string State { get; init; } = "unknown";  // "on", "off", "unavailable"
    public string FriendlyName { get; init; } = "";
    public string Domain { get; init; } = "";        // "light", "climate", "switch"

    /// <summary>
    /// Additional attributes from HA (brightness, temperature, etc.)
    /// </summary>
    public Dictionary<string, object>? Attributes { get; init; }
}
