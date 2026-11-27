import { overseeIssues, type IssueAdvice } from "@/lib/issue-oversight";
import type { IssueBrief } from "@/lib/desk-warnings";

export interface IssueOversightResult {
  source: "local" | "llm";
  advice: IssueAdvice;
}

/**
 * The same local-first advisor path as the yearly accounts notes.
 * A language-model key may tighten the wording only when it keeps the box deficit,
 * the clash count, and the lead-time date. Otherwise the desk figures stand.
 */
export async function adviseOnIssues(brief: IssueBrief): Promise<IssueOversightResult> {
  const local = overseeIssues(brief);
  const rewritten = await rewriteIssues(brief, local);
  if (!rewritten) return { source: "local", advice: local };
  return { source: "llm", advice: rewritten };
}

async function rewriteIssues(brief: IssueBrief, local: IssueAdvice): Promise<IssueAdvice | null> {
  const openAi = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openAi && !anthropic) return null;
  try {
    const text = openAi ? await openAiIssues(openAi, brief, local) : await anthropicIssues(anthropic ?? "", brief, local);
    return acceptIssues(text, brief, local);
  } catch {
    return null;
  }
}

function acceptIssues(text: string, brief: IssueBrief, local: IssueAdvice): IssueAdvice | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { paragraphs?: unknown; points?: unknown };
  if (!Array.isArray(record.paragraphs) || !Array.isArray(record.points)) return null;
  const paragraphs = record.paragraphs.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4);
  const points = record.points.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6);
  if (paragraphs.length === 0 || points.length === 0) return null;
  const joined = `${paragraphs.join(" ")} ${points.join(" ")}`;
  if (!joined.includes(String(brief.boxSize4.deficit))) return null;
  if (!joined.includes(brief.leadDate) && !joined.includes(String(brief.boxSize4.fortnightDeficit))) return null;
  for (const clash of brief.clashes) {
    if (!joined.includes(String(clash.drops))) return null;
  }
  if (joined.length > 2500) return null;
  if (/@|password|token|api[_-]?key|street|postcode/i.test(joined)) return null;
  if (paragraphs.join(" ").length < 40) return local;
  return { paragraphs, points };
}

async function openAiIssues(key: string, brief: IssueBrief, local: IssueAdvice): Promise<string> {
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
            "You help a UK caterer act on stock, delivery timing, and margin warnings. Use only the figures supplied. Do not invent customers, addresses, emails, or costs. Keep the box deficit, fortnight deficit, and drop counts exactly. Reply with JSON {\"paragraphs\":[\"...\"],\"points\":[\"...\"]}.",
        },
        { role: "user", content: JSON.stringify({ brief, paragraphs: local.paragraphs, points: local.points }) },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "";
}

async function anthropicIssues(key: string, brief: IssueBrief, local: IssueAdvice): Promise<string> {
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
        "You help a UK caterer act on stock, delivery timing, and margin warnings. Use only the figures supplied. Do not invent customers, addresses, emails, or costs. Keep the box deficit, fortnight deficit, and drop counts exactly. Reply with JSON only: {\"paragraphs\":[\"...\"],\"points\":[\"...\"]}.",
      messages: [{ role: "user", content: JSON.stringify({ brief, paragraphs: local.paragraphs, points: local.points }) }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  return payload.content?.[0]?.text ?? "";
}
