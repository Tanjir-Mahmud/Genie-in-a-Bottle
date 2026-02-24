namespace AmbientRootPlugin.Models;

/// <summary>
/// Represents an AI persona that can be activated via LCD key press.
/// Each persona carries its own system prompt, icon, and haptic profile.
/// </summary>
public record Persona(
    string Id,            // "creative_genie", "tech_lead", "smart_home_warden"
    string DisplayName,   // "Creative Genie"
    string SystemPrompt,  // Full AI instruction set for this persona
    string IconPath,      // "Assets/Icons/creative_genie.png"
    string ActiveIconPath,// "Assets/Icons/creative_genie_active.png"
    string HapticProfile  // "ai_thinking" | "task_complete" | "urgent_alert"
);
