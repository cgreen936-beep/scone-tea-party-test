"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDeskWarnings, type DeskWarning, type WarningCategory, type WarningSeverity } from "@/lib/desk-warnings";
import { overseeIssues, type IssueAdvice } from "@/lib/issue-oversight";
import type { CatalogueItem, EditableRecipe } from "@/lib/costing";
import type { UnifiedOrder } from "@/lib/mock-data";

const SEVERITIES: Array<{ id: "all" | WarningSeverity; label: string }> = [
  { id: "all", label: "All severities" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const CATEGORIES: Array<{ id: "all" | WarningCategory; label: string }> = [
  { id: "all", label: "All categories" },
  { id: "stock", label: "Stock" },
  { id: "delivery", label: "Delivery clashes" },
  { id: "margin", label: "Margin" },
];

export function WarningsPanel({
  orders,
  recipes,
  catalogue,
  stock,
  catalogItems,
  todayIso,
}: {
  orders: UnifiedOrder[];
  recipes: EditableRecipe[];
  catalogue: CatalogueItem[];
  stock: Record<string, number>;
  catalogItems: Array<{ name: string; price: number }>;
  todayIso: string;
}) {
  const [severity, setSeverity] = useState<"all" | WarningSeverity>("all");
  const [category, setCategory] = useState<"all" | WarningCategory>("all");
  const prices = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of catalogItems) map.set(item.name.trim().toLowerCase(), item.price);
    return map;
  }, [catalogItems]);
  const built = useMemo(
    () => buildDeskWarnings({ orders, recipes, catalogue, stock, prices, todayIso }),
    [catalogue, orders, prices, recipes, stock, todayIso],
  );
  const shown = built.warnings.filter((warning) => (severity === "all" || warning.severity === severity) && (category === "all" || warning.category === category));
  const groups = CATEGORIES.filter((item) => item.id !== "all").map((item) => ({
    ...item,
    rows: shown.filter((warning) => warning.category === item.id),
  }));
  const local = useMemo(() => overseeIssues(built.brief), [built.brief]);
  const briefKey = JSON.stringify(built.brief);
  const [remote, setRemote] = useState<{ key: string; source: "local" | "llm"; advice: IssueAdvice } | null>(null);
  const advice = remote && remote.key === briefKey ? remote.advice : local;
  const source = remote && remote.key === briefKey ? remote.source : "local";

  useEffect(() => {
    const controller = new AbortController();
    const key = briefKey;
    fetch("/api/issue-oversight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: built.brief }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { source?: string; advice?: IssueAdvice } | null) => {
        if (!payload || (payload.source !== "local" && payload.source !== "llm") || !payload.advice) return;
        if (!Array.isArray(payload.advice.paragraphs) || !Array.isArray(payload.advice.points)) return;
        setRemote({ key, source: payload.source, advice: payload.advice });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [briefKey, built.brief]);

  return (
    <div className="mt-6 grid gap-6">
      <section className="rounded-xl border border-[#e4d5c3] bg-white p-5">
        <h2 className="text-2xl font-semibold">Warnings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c5146]">
          Stock shortfalls, tight delivery slots, and weak margins in one list. Box size 4 is checked against the orders booked through 2 December and against the 14-day Cups Direct lead time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Warning severity">
          {SEVERITIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={severity === item.id ? "rounded-full bg-[#7d3044] px-3 py-1.5 text-sm font-semibold text-white" : "rounded-full border border-[#e4d5c3] bg-white px-3 py-1.5 text-sm font-semibold"}
              onClick={() => setSeverity(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Warning category">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={category === item.id ? "rounded-full bg-[#7d3044] px-3 py-1.5 text-sm font-semibold text-white" : "rounded-full border border-[#e4d5c3] bg-white px-3 py-1.5 text-sm font-semibold"}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <IssueOversight advice={advice} source={source} />

      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <section key={group.id} aria-label={group.label}>
            <h3 className="text-lg font-semibold">{group.label}</h3>
            <div className="mt-3 grid gap-3">
              {group.rows.map((warning) => (
                <WarningCard key={warning.id} warning={warning} />
              ))}
            </div>
          </section>
        ),
      )}
      {shown.length === 0 ? <p className="text-sm text-[#5c5146]">Nothing in this filter.</p> : null}
    </div>
  );
}

function WarningCard({ warning }: { warning: DeskWarning }) {
  const tone =
    warning.severity === "high"
      ? { backgroundColor: "#fff1ef", color: "#8a2b2b", border: "1px solid #e4b4b4" }
      : warning.severity === "medium"
        ? { backgroundColor: "#fff8ee", color: "#6b3208", border: "1px solid #e7c9a1" }
        : { backgroundColor: "#f7f4ef", color: "#5c5146", border: "1px solid #e4d5c3" };
  return (
    <article className="rounded-lg px-4 py-3" style={tone}>
      <p className="text-xs font-semibold tracking-wide uppercase">{warning.severity}</p>
      <h4 className="mt-1 font-semibold">{warning.title}</h4>
      <p className="mt-1 text-sm leading-6">{warning.detail}</p>
    </article>
  );
}

function IssueOversight({ advice, source }: { advice: IssueAdvice; source: "local" | "llm" }) {
  return (
    <section className="rounded-xl border border-[#e4d5c3] bg-[#fffaf3] p-5" aria-label="AI issue and risk oversight">
      <h3 className="text-lg font-semibold">AI Issue & Risk Oversight</h3>
      <p className="mt-2 text-sm leading-6 text-[#5c5146]">
        This reads the warnings on this page: the box size 4 shortage, tight delivery slots, and weak margins. Customer names, emails, phone numbers, and addresses stay on the desk. A configured language-model key can tighten the wording. With no key, or if that request fails, the same steps are built from these figures.
      </p>
      <p className="mt-3 text-xs font-semibold tracking-wide text-[#7d3044] uppercase">
        {source === "llm" ? "Language-model wording" : "Desk figures. A language-model key is not in use for this reply."}
      </p>
      {advice.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-3 text-sm leading-6">
          {paragraph}
        </p>
      ))}
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
        {advice.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </section>
  );
}
