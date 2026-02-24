const { ChatOpenAI } = require("@langchain/openai");

// --- Context Helper ---

function getCurrentContext() {
    // Priority Slack during 'Work' and WhatsApp/Messenger during 'Home'
    return 'Home';
}

// --- Dynamic LLM Factory (Fix 4: Runtime toggle) ---

function createLLM() {
    const useLocalAi = process.env.USE_LOCAL_AI === 'true';
    const modelId = useLocalAi ? (process.env.LOCAL_MODEL_ID || "llama3") : "gpt-4o-mini";
    const baseUrl = useLocalAi ? (process.env.LOCAL_AI_URL || "http://localhost:11434/v1") : undefined;
    const apiKey = useLocalAi ? "ollama" : (process.env.OPENAI_API_KEY || "no-key");

    console.log(`[AI-INIT] Using ${useLocalAi ? 'Local (Ollama)' : 'Cloud (OpenAI)'} model: ${modelId}`);

    return new ChatOpenAI({
        modelName: modelId,
        apiKey: apiKey,
        ...(baseUrl && { configuration: { baseURL: baseUrl } }),
        temperature: 0,
        modelKwargs: { response_format: { type: "json_object" } }
    });
}

// --- Consolidated AI Processing ---

async function processMessage(content, platform, sender, context = 'Home', persona = 'Concise Taskmaster') {
    // Priority logic: Slack for Work, Telegram/Messenger for Home
    const isPrioritized = (context === 'Work' && platform === 'slack') ||
        (context === 'Home' && (platform === 'telegram' || platform === 'facebook'));

    // Fix 6: Queue non-prioritized messages instead of dropping them
    if (!isPrioritized) {
        console.log(`[AI-QUEUE] ${platform} not prioritized in ${context} context. Queuing silently.`);
        return {
            summary: `Queued ${platform} message`,
            urgency: "Low",
            suggested_reply: "OK",
            isVip: false,
            original_content: content,
        };
    }

    try {
        // Fix 4: Create LLM on every call so runtime toggle works
        const llm = createLLM();

        console.log(`[AI-PIPELINE] Processing message from ${sender}...`);

        // 1. Role Definition (System Prompt) & 3. Structured JSON Enforcement
        const personaInstruction = persona === 'Concise Taskmaster'
            ? "Be extremely brief, clinical, and objective-oriented. Deconstruct into executable steps."
            : "Be friendly, empathic, and use natural language with emotional context.";

        const sysPrompt = `You are the Ambient Root Sovereign Privacy Guard. You do not chat. You only output structured JSON. Your task is to redact PII and summarize messages instantly.
Persona: "${persona}". ${personaInstruction}
The output MUST strictly be JSON with exactly these keys:
{ "summary": "1-sentence recap (max 60 chars)", "urgency": "High" or "Low", "redacted_content": "Original text with passwords/PII/keys scrubbed to [REDACTED]" }`;

        // 2. Context Injection (User Message)
        const messages = [
            ["system", sysPrompt],
            ["user", "Process this message from " + sender + ": " + content]
        ];

        const response = await llm.invoke(messages);

        const result = JSON.parse(response.content);

        // Check VIP reputation natively
        const vipList = ['Boss', 'Mom', 'Emergency', 'Vera'];
        const isVip = vipList.some(vip => sender?.toLowerCase().includes(vip.toLowerCase()));

        return {
            summary: result.summary || "New message received",
            urgency: result.urgency || "Medium",
            suggested_reply: "OK",
            isVip: isVip,
            original_content: result.redacted_content || content,
        };
    } catch (error) {
        console.error("[AI-ERROR]:", error.message);
        return null;
    }
}

module.exports = {
    processMessage,
    getCurrentContext
};
