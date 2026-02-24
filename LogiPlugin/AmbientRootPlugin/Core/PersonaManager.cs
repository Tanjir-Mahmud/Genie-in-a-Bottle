using AmbientRootPlugin.Models;

namespace AmbientRootPlugin.Core;

/// <summary>
/// Manages AI persona lifecycle. Each persona defines the AI's system prompt,
/// haptic profile, and LCD key icon. Emits PersonaChanged events consumed by
/// HapticEngine, ToneDial, and the plugin's keypad renderer.
/// </summary>
public class PersonaManager
{
    // --- Event for cross-module notification ---
    public event Action<Persona>? PersonaChanged;

    // --- State ---
    public Persona ActivePersona { get; private set; }
    public IReadOnlyList<Persona> AllPersonas => _personas.AsReadOnly();

    private readonly List<Persona> _personas;

    public PersonaManager()
    {
        _personas = new List<Persona>
        {
            new Persona(
                Id: "creative_genie",
                DisplayName: "Creative Genie",
                SystemPrompt: @"You are the Creative Genie — a brainstorming powerhouse.
You generate divergent ideas, explore unconventional angles, and inspire creative breakthroughs.
Always respond with structured JSON: { ""summary"": ""..."", ""urgency"": ""High/Low"", ""redacted_content"": ""..."" }",
                IconPath: "Assets/Icons/creative_genie.svg",
                ActiveIconPath: "Assets/Icons/creative_genie_active.svg",
                HapticProfile: "ai_thinking"
            ),

            new Persona(
                Id: "tech_lead",
                DisplayName: "Technical Lead",
                SystemPrompt: @"You are the Technical Lead — a precise engineering mind.
You review code, design architecture, and give exact answers with no filler.
Deconstruct complex goals into executable steps.
Always respond with structured JSON: { ""summary"": ""..."", ""urgency"": ""High/Low"", ""redacted_content"": ""..."" }",
                IconPath: "Assets/Icons/tech_lead.svg",
                ActiveIconPath: "Assets/Icons/tech_lead_active.svg",
                HapticProfile: "task_complete"
            ),

            new Persona(
                Id: "smart_home_warden",
                DisplayName: "Smart Home Warden",
                SystemPrompt: @"You are the Smart Home Warden — the sovereign guardian of the user's living space.
You manage Matter-compatible devices, optimize energy, and proactively adjust
lighting and climate based on user focus levels. All processing is local-first.
Always respond with structured JSON: { ""summary"": ""..."", ""urgency"": ""High/Low"", ""redacted_content"": ""..."" }",
                IconPath: "Assets/Icons/smart_home_warden.svg",
                ActiveIconPath: "Assets/Icons/smart_home_warden_active.svg",
                HapticProfile: "heartbeat"
            )
        };

        // Set default active persona
        ActivePersona = _personas[0];
    }

    /// <summary>
    /// Switch the active persona by ID. Fires PersonaChanged event.
    /// </summary>
    public bool SetActivePersona(string personaId)
    {
        var target = _personas.Find(p => p.Id == personaId);
        if (target == null)
        {
            Console.WriteLine($"[PERSONA] Unknown persona ID: {personaId}");
            return false;
        }

        ActivePersona = target;
        Console.WriteLine($"[PERSONA] Switched to: {target.DisplayName}");
        PersonaChanged?.Invoke(target);
        return true;
    }

    /// <summary>
    /// Map an action ID from the LCD keypad to a persona ID.
    /// </summary>
    public string? MapActionToPersonaId(string actionId) => actionId switch
    {
        "persona_creative"   => "creative_genie",
        "persona_techLead"   => "tech_lead",
        "persona_smartHome"  => "smart_home_warden",
        _ => null
    };
}
