import { adviseOnIssues } from "@/lib/issue-oversight-server";
import type { IssueBrief } from "@/lib/desk-warnings";
import { connection } from "next/server";

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const brief = parseBrief(body);
  if (!brief) return Response.json({ error: "Expected stock, delivery, and margin totals only." }, { status: 400 });
  const result = await adviseOnIssues(brief);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

function parseBrief(value: unknown): IssueBrief | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { brief?: unknown };
  const brief = body.brief;
  if (!brief || typeof brief !== "object") return null;
  if (JSON.stringify(brief).length > 8000) return null;
  if (containsPersonalData(brief)) return null;
  const row = brief as Record<string, unknown>;
  const throughDate = dateText(row.throughDate);
  const leadDate = dateText(row.leadDate);
  const box = parseBox(row.boxSize4);
  const otherShortages = parseShortages(row.otherShortages);
  const clashes = parseClashes(row.clashes);
  const marginRisks = parseMargins(row.marginRisks);
  if (!throughDate || !leadDate || !box || !otherShortages || !clashes || !marginRisks) return null;
  return { throughDate, leadDate, boxSize4: box, otherShortages, clashes, marginRisks };
}

function parseBox(value: unknown): IssueBrief["boxSize4"] | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const requiredByDate = finite(row.requiredByDate);
  const stock = finite(row.stock);
  const deficit = finite(row.deficit);
  const fortnightRequired = finite(row.fortnightRequired);
  const fortnightDeficit = finite(row.fortnightDeficit);
  if (requiredByDate === null || stock === null || deficit === null || fortnightRequired === null || fortnightDeficit === null) return null;
  return { requiredByDate, stock, deficit, fortnightRequired, fortnightDeficit };
}

function parseShortages(value: unknown): IssueBrief["otherShortages"] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const rows: IssueBrief["otherShortages"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const label = shortText(row.label, 80);
    const required = finite(row.required);
    const stock = finite(row.stock);
    const deficit = finite(row.deficit);
    const horizon = dateText(row.horizon);
    if (!label || required === null || stock === null || deficit === null || !horizon) return null;
    rows.push({ label, required, stock, deficit, horizon });
  }
  return rows;
}

function parseClashes(value: unknown): IssueBrief["clashes"] | null {
  if (!Array.isArray(value) || value.length > 4) return null;
  const rows: IssueBrief["clashes"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const date = dateText(row.date);
    const area = shortText(row.area, 40);
    const drops = finite(row.drops);
    const withinMinutes = finite(row.withinMinutes);
    if (!date || !area || drops === null || withinMinutes === null || !Array.isArray(row.districts) || row.districts.length > 6) return null;
    const districts: string[] = [];
    for (const district of row.districts) {
      const name = shortText(district, 40);
      if (!name) return null;
      districts.push(name);
    }
    rows.push({ date, area, drops, withinMinutes, districts });
  }
  return rows;
}

function parseMargins(value: unknown): IssueBrief["marginRisks"] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const rows: IssueBrief["marginRisks"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const item = shortText(row.item, 80);
    const marginPercent = finite(row.marginPercent);
    const profit = finite(row.profit);
    if (!item || marginPercent === null || profit === null) return null;
    rows.push({ item, marginPercent, profit });
  }
  return rows;
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -1e6 || value > 1e6) return null;
  return value;
}

function dateText(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function shortText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > max) return "";
  return text;
}

function containsPersonalData(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /@|password|token|api[_-]?key|street|postcode|\b\d{10,}\b/i.test(text);
}
