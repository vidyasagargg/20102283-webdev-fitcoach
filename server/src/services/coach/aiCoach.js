/**
 * Optional AI coach strategy using the Anthropic Messages API (JSON over HTTPS).
 * Enabled only when ANTHROPIC_API_KEY is set. The model only receives
 * computed day statistics, never names, emails or free-text notes. Its JSON reply is
 * validated with Zod; on any failure the caller falls back to the rule coach.
 */
import { z } from 'zod';

const reviewShape = z.object({
  headline: z.string().max(80),
  feedback: z.array(z.string().max(300)).min(1).max(4),
  fixes: z.array(z.string().max(300)).max(4),
  tomorrow: z.object({ session: z.string().max(60), focus: z.string().max(300) }),
  motivation: z.string().max(200),
});

const SYSTEM = `You are a direct, motivating personal trainer. You get one day's statistics for a client (JSON).
Reply with JSON only, no prose, matching:
{"headline": string, "feedback": [3-4 short lines], "fixes": [0-4 specific fixes], "tomorrow": {"session": string, "focus": one focus}, "motivation": one line}
Rules: be specific with numbers, be honest when targets are missed, vegetarian food suggestions only,
never suggest eating below minKcal, never give medical advice. If pain is true, tell them to rest and see a doctor.`;

export function createAiCoach({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  async function dailyReview(summary) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          system: SYSTEM,
          messages: [{ role: 'user', content: JSON.stringify(summary) }],
        }),
      });
      if (!res.ok) throw new Error(`AI coach HTTP ${res.status}`);
      const data = await res.json();
      const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      return reviewShape.parse(json);
    } finally {
      clearTimeout(timer);
    }
  }
  return { dailyReview };
}
