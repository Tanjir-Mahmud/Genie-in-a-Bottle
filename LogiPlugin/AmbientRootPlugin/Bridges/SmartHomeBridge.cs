using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using AmbientRootPlugin.Core;
using AmbientRootPlugin.Models;

namespace AmbientRootPlugin.Bridges;

/// <summary>
/// Smart Home Bridge connecting to Home Assistant REST API.
/// All traffic stays on the local LAN — the Sovereign Boundary.
/// Supports proactive Focus Mode for the Smart Home Warden persona.
/// </summary>
public class SmartHomeBridge
{
    // --- Dependencies ---
    private readonly HapticEngine _hapticEngine;
    private readonly HttpClient _httpClient;

    // --- Configuration ---
    private readonly string _baseUrl;
    private readonly string _bearerToken;

    // --- Focus Mode Settings ---
    private readonly bool _focusModeEnabled;
    private readonly int _workDurationMinutes;
    private readonly int _dimBrightnessPercent;
    private readonly double _targetTemperature;
    private readonly string _lightEntityId;
    private readonly string _climateEntityId;

    // --- State ---
    private DateTime? _workModeStarted;
    private bool _focusModeActive = false;

    public SmartHomeBridge(HapticEngine hapticEngine, SmartHomeConfig config)
    {
        _hapticEngine = hapticEngine;
        _baseUrl = config.HomeAssistantUrl.TrimEnd('/');
        _bearerToken = config.BearerToken;
        _focusModeEnabled = config.FocusMode.Enabled;
        _workDurationMinutes = config.FocusMode.WorkDurationMinutes;
        _dimBrightnessPercent = config.FocusMode.DimBrightnessPercent;
        _targetTemperature = config.FocusMode.TargetTemperatureCelsius;
        _lightEntityId = config.FocusMode.LightEntityId;
        _climateEntityId = config.FocusMode.ClimateEntityId;

        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _bearerToken);
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
        _httpClient.Timeout = TimeSpan.FromSeconds(10);
    }

    /// <summary>
    /// Get the state of a specific Home Assistant entity.
    /// </summary>
    public async Task<SmartHomeDevice?> GetEntityState(string entityId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/api/states/{entityId}");
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[SMART HOME] Failed to get {entityId}: {response.StatusCode}");
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonConvert.DeserializeObject<dynamic>(json);

            return new SmartHomeDevice
            {
                EntityId = entityId,
                State = data?.state ?? "unknown",
                FriendlyName = data?.attributes?.friendly_name ?? entityId,
                Domain = entityId.Split('.')[0]
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SMART HOME] Error fetching {entityId}: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Call a Home Assistant service (e.g., light/turn_on, climate/set_temperature).
    /// </summary>
    public async Task<bool> CallService(string domain, string service, object data)
    {
        try
        {
            var content = new StringContent(
                JsonConvert.SerializeObject(data),
                Encoding.UTF8,
                "application/json"
            );

            var response = await _httpClient.PostAsync(
                $"{_baseUrl}/api/services/{domain}/{service}", content);

            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[SMART HOME] ✓ {domain}/{service} executed successfully.");
                return true;
            }

            Console.WriteLine($"[SMART HOME] ✗ {domain}/{service} failed: {response.StatusCode}");
            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SMART HOME] Error calling {domain}/{service}: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Notify the bridge that Work Mode has been activated.
    /// Starts the focus mode timer.
    /// </summary>
    public void OnWorkModeActivated()
    {
        _workModeStarted = DateTime.UtcNow;
        _focusModeActive = false;
        Console.WriteLine("[SMART HOME] Work Mode detected. Focus timer started.");
    }

    /// <summary>
    /// Notify the bridge that Home Mode has been activated.
    /// Resets focus mode and restores defaults.
    /// </summary>
    public async Task OnHomeModeActivated()
    {
        _workModeStarted = null;
        if (_focusModeActive)
        {
            _focusModeActive = false;
            Console.WriteLine("[SMART HOME] Home Mode detected. Restoring normal lighting.");
            await CallService("light", "turn_on", new { entity_id = _lightEntityId, brightness_pct = 100 });
        }
    }

    /// <summary>
    /// Called periodically to check if Focus Mode should activate.
    /// When the user has been in Work Mode for >N minutes, proactively
    /// dim lights and set comfortable temperature.
    /// </summary>
    public async Task CheckFocusMode()
    {
        if (!_focusModeEnabled || _workModeStarted == null || _focusModeActive) return;

        var elapsed = DateTime.UtcNow - _workModeStarted.Value;
        if (elapsed.TotalMinutes >= _workDurationMinutes)
        {
            _focusModeActive = true;
            Console.WriteLine($"[SMART HOME] 🧠 Focus Mode activated after {_workDurationMinutes} minutes of work.");

            // Dim lights
            await CallService("light", "turn_on", new
            {
                entity_id = _lightEntityId,
                brightness_pct = _dimBrightnessPercent
            });

            // Set comfortable temperature
            await CallService("climate", "set_temperature", new
            {
                entity_id = _climateEntityId,
                temperature = _targetTemperature
            });

            // Confirm adjustment with haptic
            _hapticEngine.TriggerWaveform("ai_thinking");

            Console.WriteLine($"[SMART HOME] Lights dimmed to {_dimBrightnessPercent}%, thermostat set to {_targetTemperature}°C.");
        }
    }
}

/// <summary>
/// Configuration record for SmartHomeBridge, loaded from appsettings.json.
/// </summary>
public record SmartHomeConfig
{
    public string HomeAssistantUrl { get; init; } = "http://homeassistant.local:8123";
    public string BearerToken { get; init; } = "";
    public FocusModeConfig FocusMode { get; init; } = new();
}

public record FocusModeConfig
{
    public bool Enabled { get; init; } = true;
    public int WorkDurationMinutes { get; init; } = 120;
    public int DimBrightnessPercent { get; init; } = 40;
    public double TargetTemperatureCelsius { get; init; } = 22.0;
    public string LightEntityId { get; init; } = "light.office_lamp";
    public string ClimateEntityId { get; init; } = "climate.office_thermostat";
}
