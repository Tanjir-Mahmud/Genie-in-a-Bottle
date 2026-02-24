namespace AmbientRootPlugin.Core;

/// <summary>
/// Interactive Tone Dial mapped to the MX Creative Console dial.
/// Allows the user to physically rotate the dial to adjust the AI's
/// response style from "Concise" (0.0) to "Creative" (1.0).
/// </summary>
public class ToneDial
{
    // --- Events ---
    public event Action<float>? ToneLevelChanged;

    // --- State ---
    public float ToneLevel { get; private set; } = 0.3f; // Default: slightly concise
    public string CurrentStyle => ToneLevel switch
    {
        <= 0.3f => "Concise",
        <= 0.6f => "Balanced",
        _       => "Creative"
    };

    /// <summary>
    /// Maps the AI temperature parameter from the tone level.
    /// </summary>
    public float AiTemperature => ToneLevel switch
    {
        <= 0.3f => 0.1f,
        <= 0.6f => 0.5f,
        _       => 0.9f
    };

    /// <summary>
    /// Handle encoder rotation from the MX Creative Dial.
    /// Each tick adjusts ±0.1, clamped to [0.0, 1.0].
    /// </summary>
    public void OnRotate(int ticks)
    {
        float previous = ToneLevel;
        ToneLevel = Math.Clamp(ToneLevel + (ticks * 0.1f), 0.0f, 1.0f);

        // Round to 1 decimal place to avoid floating point drift
        ToneLevel = MathF.Round(ToneLevel, 1);

        if (Math.Abs(ToneLevel - previous) > 0.001f)
        {
            Console.WriteLine($"[TONE DIAL] Level: {ToneLevel:F1} ({CurrentStyle}) → AI Temperature: {AiTemperature:F1}");
            ToneLevelChanged?.Invoke(ToneLevel);
        }
    }

    /// <summary>
    /// Generate system prompt modifier based on current tone level.
    /// Appended to the active persona's base system prompt.
    /// </summary>
    public string GetPromptModifier() => ToneLevel switch
    {
        <= 0.3f => "Be extremely brief. Use bullet points. No filler. Clinical precision.",
        <= 0.6f => "Be balanced and professional. Clear explanations with moderate detail.",
        _       => "Be creative and expansive. Explore multiple angles. Use metaphors and analogies."
    };
}
