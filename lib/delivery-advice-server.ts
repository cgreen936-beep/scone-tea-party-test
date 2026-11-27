import { planDeliveryDays, type DayRoutePlan, type RouteOrder } from "@/lib/delivery-route";

/**
 * Server-only wording pass. The miles, names, and suggested times always come
 * from the postcode planner. A language model may tighten the sentence only
 * when a local key exists, and only if it keeps those figures.
 */
export async function adviseDeliveryDays(orders: RouteOrder[]): Promise<{ source: "local" | "llm"; days: DayRoutePlan[] }> {
  const days = planDeliveryDays(orders);
  const rewritten = await rewriteSummaries(days);
  if (!rewritten) return { source: "local", days };
  return {
    source: "llm",
    days: days.map((day) => ({ ...day, summary: rewritten[day.date] ?? day.summary })),
  };
}

async function rewriteSummaries(days: DayRoutePlan[]): Promise<Record<string, string> | null> {
  const openAi = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openAi && !anthropic) return null;
  if (days.length === 0) return null;

  const brief = days.map((day) => ({
    date: day.date,
    summary: day.summary,
    bookedMiles: day.bookedMiles.toFixed(1),
    efficientMiles: day.efficientMiles.toFixed(1),
    milesSaved: day.milesSaved.toFixed(1),
    minutesSaved: day.minutesSaved,
    rings: day.rings.map((ring) => ({
      customer: ring.customer,
      company: ring.company ?? "",
      postcode: ring.postcode,
      currentWindow: ring.currentWindow,
      suggestedWindow: ring.suggestedWindow,
    })),
  }));

  try {
    const text = openAi ? await openAiNarration(openAi, brief) : await anthropicNarration(anthropic ?? "", brief);
    return acceptNarration(text, days);
  } catch {
    return null;
  }
}

function acceptNarration(text: string, days: DayRoutePlan[]): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const notes: Record<string, string> = {};
  for (const day of days) {
    const row = parsed.find((item) => item && typeof item === "object" && (item as { date?: string }).date === day.date) as
      | { summary?: string }
      | undefined;
    const summary = row?.summary?.trim();
    if (!summary || summary.length > 1200) return null;
    if (!summary.includes(day.bookedMiles.toFixed(1))) return null;
    if (!day.aligned && !summary.includes(day.milesSaved.toFixed(1))) return null;
    for (const ring of day.rings) {
      if (!summary.includes(ring.customer) || !summary.includes(ring.suggestedWindow)) return null;
    }
    notes[day.date] = summary;
  }
  return notes;
}

async function openAiNarration(key: string, brief: unknown): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Rewrite each day's delivery summary in one or two plain sentences for a UK caterer. Keep every mile figure, customer name, postcode, and time exactly as given. Return JSON {\"days\":[{\"date\":\"YYYY-MM-DD\",\"summary\":\"...\"}]}.",
        },
        { role: "user", content: JSON.stringify({ days: brief }) },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return unwrapDays(content);
}

async function anthropicNarration(key: string, brief: unknown): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 800,
      temperature: 0,
      system:
        "Rewrite each day's delivery summary in one or two plain sentences. Keep every mile figure, customer name, postcode, and time exactly as given. Reply with a JSON array only: [{\"date\":\"YYYY-MM-DD\",\"summary\":\"...\"}].",
      messages: [{ role: "user", content: JSON.stringify({ days: brief }) }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  return unwrapDays(payload.content?.[0]?.text ?? "");
}

function unwrapDays(content: string): string {
  try {
    const parsed = JSON.parse(content) as { days?: unknown };
    if (Array.isArray(parsed.days)) return JSON.stringify(parsed.days);
  } catch {
    /* The model may already have returned the array. */
  }
  return content;
}
