const GEMINI_API_URL = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models"
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

const createSystemPrompt = (mode, tone) => {
    if (mode === "smart-replies") {
        return "Generate exactly 3 short reply suggestions for a chat conversation. Respond with JSON in the shape {\"replies\":[\"...\",\"...\",\"...\"]}. Keep each reply under 90 characters."
    }

    if (mode === "translate") {
        return "Translate the user's text into the requested language. Respond with JSON in the shape {\"text\":\"...\",\"sourceLanguage\":\"...\",\"targetLanguage\":\"...\"}. Return only the translation in text."
    }

    return `Rewrite the user's message in a ${tone} tone. Respond with JSON in the shape {"text":"..."}. Preserve the original intent, keep it concise, and do not add quotes.`
}

const parseJsonString = (value) => {
    if (!value) {
        throw new Error("Gemini returned no content")
    }

    return JSON.parse(value)
}

const callGemini = async ({ mode, tone, messages, text, targetLanguage }) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured")
    }

    const prompt = mode === "smart-replies"
        ? `Conversation:\n${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`
        : mode === "translate"
            ? `Translate this message to ${targetLanguage}:\n${text}`
            : `Rewrite this message:\n${text}`

    const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: createSystemPrompt(mode, tone) }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API error: ${errorText}`)
    }

    const data = await response.json()
    const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim()
    return parseJsonString(content)
}

export const getSmartReplies = async (req, res) => {
    try {
        const { messages = [] } = req.body

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "Conversation messages are required" })
        }

        const normalizedMessages = messages
            .slice(-8)
            .map((message) => ({
                role: message.role === "assistant" ? "assistant" : "user",
                content: String(message.content || "").trim()
            }))
            .filter((message) => message.content)

        const result = await callGemini({
            mode: "smart-replies",
            messages: normalizedMessages
        })

        res.status(200).json({ replies: Array.isArray(result.replies) ? result.replies.slice(0, 3) : [] })
    } catch (error) {
        console.log("Error in getSmartReplies controller:", error.message)
        res.status(500).json({ error: error.message || "Failed to generate smart replies" })
    }
}

export const rewriteMessage = async (req, res) => {
    try {
        const { text = "", tone = "polite" } = req.body

        if (!text.trim()) {
            return res.status(400).json({ error: "Text is required" })
        }

        const result = await callGemini({
            mode: "rewrite",
            tone,
            text: text.trim()
        })

        res.status(200).json({ text: result.text || text.trim() })
    } catch (error) {
        console.log("Error in rewriteMessage controller:", error.message)
        res.status(500).json({ error: error.message || "Failed to rewrite message" })
    }
}

export const translateMessage = async (req, res) => {
    try {
        const { text = "", targetLanguage = "English" } = req.body

        if (!text.trim()) {
            return res.status(400).json({ error: "Text is required" })
        }

        const result = await callGemini({
            mode: "translate",
            text: text.trim(),
            targetLanguage
        })

        res.status(200).json({
            text: result.text || text.trim(),
            sourceLanguage: result.sourceLanguage || "",
            targetLanguage: result.targetLanguage || targetLanguage
        })
    } catch (error) {
        console.log("Error in translateMessage controller:", error.message)
        res.status(500).json({ error: error.message || "Failed to translate message" })
    }
}
