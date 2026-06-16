// RallyPoint Assistant — reply generation.
// Uses Anthropic's API when ANTHROPIC_API_KEY is set; otherwise falls back
// to lightweight templated replies so the feature works before the key exists.

export const ASSISTANT_SYSTEM_PROMPT = `You are the RallyPoint Assistant, a friendly, upbeat guide inside the RallyPoint app — a social app that connects people 18-30 through real-life events (casual meetups, bowling nights, etc).

Your job: help users find or plan something to do, nudge them toward joining or hosting events, and keep the app feeling alive. Keep replies short (1-3 sentences), warm, and conversational — never robotic or corporate. You can suggest event ideas, ask what they're in the mood for, or point them to the Map/Events tab. You are clearly an AI assistant, not a real person — never pretend otherwise. Don't make up specific event names, times, or attendee counts you don't actually have.`

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function generateAssistantReply(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (apiKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: ASSISTANT_SYSTEM_PROMPT,
          messages: [...history, { role: 'user', content: userMessage }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data?.content?.[0]?.text
        if (text) return text.trim()
      }
    } catch {
      // fall through to template fallback
    }
  }

  return templateReply(userMessage)
}

// Fallback used until ANTHROPIC_API_KEY is configured.
function templateReply(message: string): string {
  const m = message.toLowerCase()

  if (/\b(hi|hey|hello|sup|yo)\b/.test(m)) {
    return "Hey! 👋 I'm the RallyPoint Assistant. Want help finding something to do nearby, or thinking about hosting your own event?"
  }
  if (/bored|nothing to do|what.?s happening/.test(m)) {
    return "Check the Map tab — tap a pin to see what's nearby, or search a city to see everything happening there. If it's quiet, you could be the one to kick something off!"
  }
  if (/host|create|start an event/.test(m)) {
    return "Love that energy. Hit the Rally tab to set one up — pick a venue, a time, and whether it's casual or ticketed. Takes under a minute."
  }
  if (/thanks|thank you/.test(m)) {
    return "Anytime! Go rally something up. 🎉"
  }

  return "I'm running in basic mode right now (no AI key configured yet), but I can still point you around — try the Map tab for what's nearby or the Rally tab to host something."
}
