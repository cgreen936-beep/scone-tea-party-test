import { adviseFromSnapshot } from "@/lib/business-advisor-server";
import type { AdvicePrompt } from "@/lib/business-advice";
import type { BusinessOverview } from "@/lib/business-overview";
import { connection } from "next/server";

const PROMPTS = new Set<AdvicePrompt>(["profit", "yearly", "vat"]);

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = parseSnapshot(body);
  if (!parsed) return Response.json({ error: "Expected a business snapshot with totals only." }, { status: 400 });
  const result = await adviseFromSnapshot(parsed.overview, parsed.prompt);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

function parseSnapshot(value: unknown): { prompt: AdvicePrompt; overview: BusinessOverview } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { prompt?: unknown; overview?: unknown };
  if (typeof body.prompt !== "string" || !PROMPTS.has(body.prompt as AdvicePrompt)) return null;
  const overview = body.overview;
  if (!overview || typeof overview !== "object") return null;
  const row = overview as Record<string, unknown>;
  if (JSON.stringify(row).length > 20000) return null;
  if (containsPersonalData(row)) return null;
  const numbers = [
    "ytdDays",
    "canceledLeftOut",
    "scheduledCount",
    "historicalCount",
    "spanDays",
    "sales",
    "scheduledSales",
    "historicalSales",
    "ingredients",
    "boxes",
    "pots",
    "electricity",
    "labour",
    "fuel",
    "direct",
    "uncostedLines",
    "overheadMonthly",
    "overheadAnnual",
    "overheadYearToDate",
    "overheadForSpan",
    "extrasBook",
    "extrasYearToDate",
    "extrasRecorded",
  ] as const;
  const parsedNumbers: Record<string, number> = {};
  for (const key of numbers) {
    const amount = finite(row[key]);
    if (amount === null) return null;
    parsedNumbers[key] = amount;
  }
  const today = dateText(row.today, true);
  const year = yearText(row.year);
  const firstDate = dateText(row.firstDate, true);
  const lastDate = dateText(row.lastDate, true);
  if (!year || today === null || firstDate === null || lastDate === null) return null;
  const overheads = parseOverheads(row.overheads);
  const extras = parseExtras(row.extras);
  const months = parseMonths(row.months);
  const yearToDateParts = parseParts(row.yearToDateParts);
  const book = parseSlice(row.book);
  const yearToDate = parseSlice(row.yearToDate);
  const fullYearRunRate = parseSlice(row.fullYearRunRate);
  if (!overheads || !extras || !months || !yearToDateParts || !book || !yearToDate || !fullYearRunRate) return null;
  return {
    prompt: body.prompt as AdvicePrompt,
    overview: {
      today,
      year,
      ytdDays: parsedNumbers.ytdDays,
      canceledLeftOut: parsedNumbers.canceledLeftOut,
      scheduledCount: parsedNumbers.scheduledCount,
      wixSnapshotCount: finite(row.wixSnapshotCount) ?? 0,
      localMockCount: finite(row.localMockCount) ?? 0,
      historicalCount: parsedNumbers.historicalCount,
      firstDate,
      lastDate,
      spanDays: parsedNumbers.spanDays,
      sales: parsedNumbers.sales,
      scheduledSales: parsedNumbers.scheduledSales,
      wixSnapshotSales: finite(row.wixSnapshotSales) ?? 0,
      localMockSales: finite(row.localMockSales) ?? 0,
      historicalSales: parsedNumbers.historicalSales,
      ingredients: parsedNumbers.ingredients,
      boxes: parsedNumbers.boxes,
      pots: parsedNumbers.pots,
      electricity: parsedNumbers.electricity,
      labour: parsedNumbers.labour,
      fuel: parsedNumbers.fuel,
      direct: parsedNumbers.direct,
      uncostedLines: parsedNumbers.uncostedLines,
      overheads,
      overheadMonthly: parsedNumbers.overheadMonthly,
      overheadAnnual: parsedNumbers.overheadAnnual,
      overheadYearToDate: parsedNumbers.overheadYearToDate,
      overheadForSpan: parsedNumbers.overheadForSpan,
      extras,
      extrasBook: parsedNumbers.extrasBook,
      extrasYearToDate: parsedNumbers.extrasYearToDate,
      extrasRecorded: parsedNumbers.extrasRecorded,
      months,
      yearToDateParts,
      book,
      yearToDate,
      fullYearRunRate,
    },
  };
}

function parseOverheads(value: unknown): BusinessOverview["overheads"] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const rows: BusinessOverview["overheads"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const name = shortLabel(item.name);
    const monthly = finite(item.monthly);
    const annual = finite(item.annual);
    const yearToDate = finite(item.yearToDate);
    const forSpan = finite(item.forSpan);
    if (!name || monthly === null || annual === null || yearToDate === null || forSpan === null) return null;
    rows.push({ name, monthly, annual, yearToDate, forSpan });
  }
  return rows;
}

function parseExtras(value: unknown): BusinessOverview["extras"] | null {
  if (!Array.isArray(value) || value.length > 12) return null;
  const rows: BusinessOverview["extras"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const category = shortLabel(item.category);
    const book = finite(item.book);
    const yearToDate = finite(item.yearToDate);
    const recorded = finite(item.recorded);
    if (!category || book === null || yearToDate === null || recorded === null) return null;
    rows.push({ category, book, yearToDate, recorded });
  }
  return rows;
}

function parseMonths(value: unknown): BusinessOverview["months"] | null {
  if (!Array.isArray(value) || value.length > 24) return null;
  const rows: BusinessOverview["months"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const item = entry as Record<string, unknown>;
    const key = typeof item.key === "string" && /^\d{4}-\d{2}$/.test(item.key) ? item.key : "";
    const label = shortLabel(item.label);
    const sales = finite(item.sales);
    const direct = finite(item.direct);
    if (!key || !label || sales === null || direct === null) return null;
    rows.push({ key, label, sales, direct });
  }
  return rows;
}

function parseParts(value: unknown): BusinessOverview["yearToDateParts"] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const keys = ["sales", "scheduledSales", "historicalSales", "ingredients", "boxes", "pots", "electricity", "labour", "fuel", "direct", "uncostedLines"] as const;
  const parts = {} as BusinessOverview["yearToDateParts"];
  for (const key of keys) {
    const amount = finite(item[key]);
    if (amount === null) return null;
    parts[key] = amount;
  }
  return parts;
}

function parseSlice(value: unknown): BusinessOverview["book"] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const keys = [
    "sales",
    "direct",
    "overheads",
    "extras",
    "totalCosts",
    "vatAmount",
    "profit",
    "marginPercent",
    "registeredVatAmount",
    "registeredNetSale",
    "registeredProfit",
    "registeredMarginPercent",
  ] as const;
  const slice = {} as BusinessOverview["book"];
  for (const key of keys) {
    const amount = finite(item[key]);
    if (amount === null) return null;
    slice[key] = amount;
  }
  return slice;
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -1_000_000 || value > 1_000_000) return null;
  return value;
}

function dateText(value: unknown, allowEmpty: boolean): string | null {
  if (typeof value !== "string") return null;
  if (allowEmpty && value === "") return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function yearText(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}$/.test(value) ? value : null;
}

function shortLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^A-Za-z0-9 /&.,'-]/g, "").trim().slice(0, 60);
  if (!cleaned || cleaned.includes("@")) return null;
  return cleaned;
}

function containsPersonalData(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /@|password|token|api[_-]?key|street|postcode|\b\d{10,}\b/i.test(text);
}
