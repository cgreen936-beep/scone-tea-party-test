import { adviceMoneyFigures, adviseBusiness, type AdvicePrompt, type BusinessAdvice } from "@/lib/business-advice";
import type { BusinessOverview } from "@/lib/business-overview";

export interface AdvisorResult {
  source: "local" | "llm";
  advice: BusinessAdvice;
}

/**
 * Figures always come from the snapshot Sarah already has on screen.
 * A language model may tighten the wording only when a local key exists,
 * and only when it keeps every pound amount from the local notes.
 * No customer names, addresses, or emails are accepted here.
 */
export async function adviseFromSnapshot(overview: BusinessOverview, prompt: AdvicePrompt): Promise<AdvisorResult> {
  const local = adviseBusiness(overview, prompt);
  const rewritten = await rewriteAdvice(overview, local);
  if (!rewritten) return { source: "local", advice: local };
  return { source: "llm", advice: { prompt, ...rewritten } };
}

async function rewriteAdvice(
  overview: BusinessOverview,
  local: BusinessAdvice,
): Promise<{ paragraphs: string[]; points: string[] } | null> {
  const openAi = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openAi && !anthropic) return null;
  const brief = publicBrief(overview, local);
  try {
    const text = openAi ? await openAiAdvice(openAi, brief) : await anthropicAdvice(anthropic ?? "", brief);
    return acceptAdvice(text, local);
  } catch {
    return null;
  }
}

function publicBrief(overview: BusinessOverview, local: BusinessAdvice) {
  return {
    task: local.prompt,
    year: overview.year,
    today: overview.today,
    scheduledOrderCount: overview.scheduledCount,
    historicalOrderCount: overview.historicalCount,
    canceledLeftOut: overview.canceledLeftOut,
    spanDays: overview.spanDays,
    sales: overview.sales.toFixed(2),
    directCosts: overview.direct.toFixed(2),
    ingredients: overview.ingredients.toFixed(2),
    cupsDirectBoxes: overview.boxes.toFixed(2),
    pots: overview.pots.toFixed(2),
    ovenElectricity: overview.electricity.toFixed(2),
    labour: overview.labour.toFixed(2),
    overheadMonthly: overview.overheadMonthly.toFixed(2),
    overheadForSpan: overview.overheadForSpan.toFixed(2),
    overheadYearToDate: overview.overheadYearToDate.toFixed(2),
    overheadAnnual: overview.overheadAnnual.toFixed(2),
    extras: overview.extrasBook.toFixed(2),
    netProfit: overview.book.profit.toFixed(2),
    marginPercent: overview.book.marginPercent.toFixed(1),
    activeVat: overview.book.vatAmount.toFixed(2),
    registeredProfit: overview.book.registeredProfit.toFixed(2),
    yearToDateProfit: overview.yearToDate.profit.toFixed(2),
    fullYearRunRateProfit: overview.fullYearRunRate.profit.toFixed(2),
    localParagraphs: local.paragraphs,
    localPoints: local.points,
  };
}

function acceptAdvice(text: string, local: BusinessAdvice): { paragraphs: string[]; points: string[] } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { paragraphs?: unknown; points?: unknown };
  if (!Array.isArray(record.paragraphs) || !Array.isArray(record.points)) return null;
  const paragraphs = record.paragraphs.filter((item): item is string => typeof item === "string").map((item) => item.trim());
  const points = record.points.filter((item): item is string => typeof item === "string").map((item) => item.trim());
  if (paragraphs.length === 0 || paragraphs.length > 6 || points.length === 0 || points.length > 8) return null;
  if (paragraphs.some((item) => item.length > 700) || points.some((item) => item.length > 400)) return null;
  const joined = `${paragraphs.join(" ")} ${points.join(" ")}`;
  if (/@|https?:|postcode|password|token/i.test(joined)) return null;
  for (const figure of adviceMoneyFigures(local)) {
    if (!joined.includes(figure)) return null;
  }
  return { paragraphs, points };
}

async function openAiAdvice(key: string, brief: unknown): Promise<string> {
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
            "You help a UK caterer organise profit, year-end categories, and VAT questions. She is not VAT-registered. Use only the figures supplied. Do not invent customers, addresses, emails, or costs. Keep every pound amount exactly as written with the £ sign and two decimals. Reply with JSON {\"paragraphs\":[\"...\"],\"points\":[\"...\"]}. Say that final accounts are signed off with her accountant.",
        },
        { role: "user", content: JSON.stringify(brief) },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

async function anthropicAdvice(key: string, brief: unknown): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 900,
      temperature: 0,
      system:
        "You help a UK caterer organise profit, year-end categories, and VAT questions. She is not VAT-registered. Use only the figures supplied. Do not invent customers, addresses, emails, or costs. Keep every pound amount exactly as written with the £ sign and two decimals. Reply with JSON only: {\"paragraphs\":[\"...\"],\"points\":[\"...\"]}. Say that final accounts are signed off with her accountant.",
      messages: [{ role: "user", content: JSON.stringify(brief) }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  return payload.content?.[0]?.text ?? "";
}
