namespace AmbientRootPlugin.Core;

/// <summary>
/// Haptic Intelligence Engine for the MX Master 4.
/// Defines named waveform patterns and triggers them via the Loupedeck SDK.
/// Waveform timings are configurable via appsettings.json.
/// </summary>
public class HapticEngine
{
    // --- Waveform Definitions ---

    private readonly Dictionary<string, WaveformPattern> _waveforms = new()
    {
        ["ai_thinking"] = new WaveformPattern(
            Name: "AI Thinking",
            Description: "Sustained low-frequency vibration while AI processes",
            PulseDurationMs: 200,
            GapMs: 100,
            Repeats: 3
        ),
        ["task_complete"] = new WaveformPattern(
            Name: "Task Complete",
            Description: "Crisp double-tap when AI finishes generating",
            PulseDurationMs: 50,
            GapMs: 80,
            Repeats: 2
        ),
        ["heartbeat"] = new WaveformPattern(
            Name: "Heartbeat",
            Description: "Hourly alive pulse confirming system is running",
            PulseDurationMs: 150,
            GapMs: 200,
            Repeats: 2
        ),
        ["urgent_alert"] = new WaveformPattern(
            Name: "Urgent Alert",
            Description: "Strong triple-pulse for high-priority VIP messages",
            PulseDurationMs: 80,
            GapMs: 60,
            Repeats: 3
        ),
        ["double_pulse"] = new WaveformPattern(
            Name: "Double Pulse",
            Description: "Standard notification for high-urgency messages",
            PulseDurationMs: 60,
            GapMs: 80,
            Repeats: 2
        ),
        ["silent"] = new WaveformPattern(
            Name: "Silent",
            Description: "No haptic feedback — message silently queued",
            PulseDurationMs: 0,
            GapMs: 0,
            Repeats: 0
        )
    };

    /// <summary>
    /// Trigger a named haptic waveform on the MX Master 4.
    /// In a real SDK integration, this would call the LogiHaptics API.
    /// </summary>
    public void TriggerWaveform(string waveformName)
    {
        if (!_waveforms.TryGetValue(waveformName, out var pattern))
        {
            Console.WriteLine($"[HAPTIC] Unknown waveform: {waveformName}");
            return;
        }

        if (pattern.PulseDurationMs == 0)
        {
            Console.WriteLine($"[HAPTIC] Silent — message queued without feedback.");
            return;
        }

        Console.WriteLine($"[HAPTIC] Triggering '{pattern.Name}': {pattern.Repeats}x pulse ({pattern.PulseDurationMs}ms on, {pattern.GapMs}ms gap)");

        // SDK Integration Point:
        // In production, replace this with actual Loupedeck/LogiHaptics API calls:
        // device.TriggerHapticFeedback(pattern.PulseDurationMs, pattern.Repeats);
        for (int i = 0; i < pattern.Repeats; i++)
        {
            // Simulate haptic pulse timing
            Thread.Sleep(pattern.PulseDurationMs);
            if (i < pattern.Repeats - 1)
                Thread.Sleep(pattern.GapMs);
        }

        Console.WriteLine($"[HAPTIC] '{pattern.Name}' complete.");
    }

    /// <summary>
    /// Update waveform timings from appsettings.json configuration.
    /// </summary>
    public void ConfigureWaveform(string name, int pulseDurationMs, int gapMs, int repeats)
    {
        if (_waveforms.ContainsKey(name))
        {
            _waveforms[name] = _waveforms[name] with
            {
                PulseDurationMs = pulseDurationMs,
                GapMs = gapMs,
                Repeats = repeats
            };
            Console.WriteLine($"[HAPTIC] Reconfigured '{name}': {repeats}x ({pulseDurationMs}ms/{gapMs}ms)");
        }
    }

    /// <summary>
    /// Get all available waveform names.
    /// </summary>
    public IEnumerable<string> GetWaveformNames() => _waveforms.Keys;
}

/// <summary>
/// Defines a single haptic waveform pattern.
/// </summary>
public record WaveformPattern(
    string Name,
    string Description,
    int PulseDurationMs,
    int GapMs,
    int Repeats
);
