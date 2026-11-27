"use client";

import { useCallback, useMemo, useState } from "react";
import { addIsoDays } from "@/lib/uk-date";
import { ADVICE_PROMPTS, adviseBusiness, type AdvicePrompt, type BusinessAdvice } from "@/lib/business-advice";
import { useBusinessBooks } from "@/lib/business-books";
import { buildBusinessOverview, type BusinessOverview, type ProfitSlice } from "@/lib/business-overview";
import type { BakeSettings, CatalogueItem, EditableRecipe } from "@/lib/costing";
import type { HistoricalCorporateOrder } from "@/lib/corporate-portal";
import type { WixSnapshotCoverage } from "@/lib/load-wix-bookings";
import type { UnifiedOrder } from "@/lib/mock-data";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function weekdayIndex(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (
    (adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) + offsets[month - 1] + day) %
    7
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${WEEKDAYS[weekdayIndex(year, month, day)]} ${day} ${MONTHS[month - 1]} ${year}`;
}

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef] disabled:cursor-not-allowed disabled:opacity-60";

function Money({ value }: { value: number }) {
  return <span className="tabular-nums">{gbp(value)}</span>;
}

export default function BusinessOverviewPanel({
  orders,
  historicalOrders,
  recipes,
  catalogue,
  bakeSettings,
  todayIso,
  catalogItems,
  snapshotCoverage,
}: {
  orders: UnifiedOrder[];
  historicalOrders: HistoricalCorporateOrder[];
  recipes: EditableRecipe[];
  catalogue: CatalogueItem[];
  bakeSettings: BakeSettings;
  todayIso: string;
  catalogItems: Array<{ name: string; price: number }>;
  snapshotCoverage: WixSnapshotCoverage;
}) {
  const books = useBusinessBooks();
  const [preset, setPreset] = useState<"all" | "april" | "30" | "custom">("all");
  const [fromInput, setFromInput] = useState("");
  const [untilInput, setUntilInput] = useState("");
  const bounds = useMemo(() => {
    const dates = [...orders.map((order) => order.deliveryDate), ...historicalOrders.map((order) => order.deliveryDate)]
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .sort();
    return { first: dates[0] ?? "2026-04-01", last: dates[dates.length - 1] ?? "2026-12-27" };
  }, [historicalOrders, orders]);
  const range = useMemo(() => {
    if (preset === "april") return { from: "2026-04-01", until: todayIso && todayIso >= "2026-04-01" ? todayIso : bounds.last };
    if (preset === "30" && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return { from: addIsoDays(todayIso, -29), until: todayIso };
    if (preset === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(fromInput) && /^\d{4}-\d{2}-\d{2}$/.test(untilInput) && fromInput <= untilInput) {
      return { from: fromInput, until: untilInput };
    }
    return { from: "", until: "" };
  }, [bounds.last, fromInput, preset, todayIso, untilInput]);
  const catalogPrice = useCallback(
    (name: string) => catalogItems.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase())?.price ?? 0,
    [catalogItems],
  );
  const overview = useMemo(
    () =>
      buildBusinessOverview({
        orders,
        historicalOrders,
        recipes,
        catalogue,
        bakeSettings,
        today: todayIso,
        overheads: books.overheads,
        extras: books.extras,
        catalogPrice,
        rangeFrom: range.from,
        rangeUntil: range.until,
      }),
    [bakeSettings, books.extras, books.overheads, catalogPrice, catalogue, historicalOrders, orders, range.from, range.until, recipes, todayIso],
  );
  const [prompt, setPrompt] = useState<AdvicePrompt>("profit");
  const [remote, setRemote] = useState<{ prompt: AdvicePrompt; source: "local" | "llm"; advice: BusinessAdvice; figures: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [advisorNote, setAdvisorNote] = useState("Built from the figures on this page.");
  const figures = `${overview.book.profit}:${overview.sales}:${overview.direct}:${overview.overheadForSpan}:${overview.extrasBook}`;
  const localAdvice = useMemo(() => adviseBusiness(overview, prompt), [overview, prompt]);
  const showingRemote = remote?.prompt === prompt && remote.figures === figures ? remote : null;
  const advice = showingRemote?.advice ?? localAdvice;
  const source = showingRemote?.source ?? "local";

  async function ask(next: AdvicePrompt) {
    setPrompt(next);
    setPending(true);
    setAdvisorNote("Checking the advisor…");
    try {
      const response = await fetch("/api/business-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: next, overview }),
      });
      if (!response.ok) throw new Error("unavailable");
      const payload = (await response.json()) as { source?: string; advice?: BusinessAdvice };
      if (!payload.advice || !Array.isArray(payload.advice.paragraphs)) throw new Error("unavailable");
      const nextSource = payload.source === "llm" ? "llm" : "local";
      setRemote({ prompt: next, source: nextSource, advice: payload.advice, figures });
      setAdvisorNote(
        nextSource === "llm"
          ? "Wording from the language model. Every pound amount was kept from this page."
          : "Desk figures. A language-model key is not in use for this reply.",
      );
    } catch {
      setRemote(null);
      setAdvisorNote("Built from the figures on this page. The advisor request stayed on this desk.");
    } finally {
      setPending(false);
    }
  }

  const span =
    overview.firstDate && overview.lastDate
      ? `${formatDate(overview.firstDate)} to ${formatDate(overview.lastDate)}`
      : "No dated orders yet";

  return (
    <section className="mt-6 space-y-6" role="tabpanel" aria-label="Business overview">
      <div>
        <h2 className="text-xl font-semibold">Business overview</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
          {`Income is the menu sales on scheduled bookings and the local corporate test history. Canceled orders stay off this page${overview.canceledLeftOut > 0 ? ` (${overview.canceledLeftOut} left out)` : ""}. Direct costs follow the recipes, Cups Direct boxes, pots, and the oven electricity already pooled by delivery day. Fixed overheads and variable extras come from the overheads tab. Active VAT is £0.00.`}
        </p>
        <p className="mt-2 text-sm text-[#5c5146]">{`${overview.scheduledCount} scheduled bookings (${overview.wixSnapshotCount} saved Wix, ${overview.localMockCount} local test) and ${overview.historicalCount} local corporate test orders. ${span}. ${overview.spanDays} days in the book.`}</p>
        <OrderSources overview={overview} coverage={snapshotCoverage} formatDate={formatDate} />
        <div className="mt-4 flex flex-wrap items-end gap-3" role="group" aria-label="Account date range">
          {(
            [
              ["all", "All"],
              ["april", "Since April"],
              ["30", "Last 30 days"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={preset === id ? `${secondaryClass} border-[#7d3044] bg-[#7d3044] text-white` : secondaryClass}
              onClick={() => setPreset(id)}
            >
              {label}
            </button>
          ))}
          <label className="text-sm font-semibold">
            From
            <input
              className="mt-1 block rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm font-normal"
              type="date"
              aria-label="From"
              value={preset === "custom" ? fromInput : range.from || bounds.first}
              onChange={(event) => {
                setFromInput(event.target.value);
                setUntilInput((current) => (preset === "custom" && current ? current : bounds.last));
                setPreset("custom");
              }}
            />
          </label>
          <label className="text-sm font-semibold">
            Until
            <input
              className="mt-1 block rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm font-normal"
              type="date"
              aria-label="Until"
              value={preset === "custom" ? untilInput : range.until || bounds.last}
              onChange={(event) => {
                setUntilInput(event.target.value);
                setFromInput((current) => (preset === "custom" && current ? current : bounds.first));
                setPreset("custom");
              }}
            />
          </label>
        </div>
      </div>

      <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Executive summary">
        <h3 className="text-lg font-semibold">Income, costs, and profit</h3>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          {`This block uses the order book from ${span}. Fixed overheads are the daily rate for those ${overview.spanDays} days. The daily rate is the monthly total × 12 ÷ 365.`}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Total income / sales"
            value={overview.sales}
            detail={`${gbp(overview.wixSnapshotSales)} saved Wix · ${gbp(overview.localMockSales)} local test bookings · ${gbp(overview.historicalSales)} corporate test history`}
          />
          <Figure label="Direct order and recipe costs" value={overview.direct} detail="Ingredients, boxes, pots, electricity, labour, fuel" />
          <Figure label="Fixed overheads for this book" value={overview.overheadForSpan} detail={`${gbp(overview.overheadMonthly)} a month · ${gbp(overview.overheadAnnual)} a year`} />
          <Figure label="Variable and extra costs" value={overview.extrasBook} detail={`${gbp(overview.extrasRecorded)} recorded in this session`} />
        </dl>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Net profit</dt>
            <dd className="text-2xl font-semibold"><Money value={overview.book.profit} /></dd>
            <p className="text-sm text-[#5c5146]">{`${overview.book.marginPercent.toFixed(1)}% margin`}</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Active VAT</dt>
            <dd className="text-2xl font-semibold"><Money value={overview.book.vatAmount} /></dd>
            <p className="text-sm text-[#5c5146]">Not VAT-registered. Nothing is taken off the sale price.</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Total costs</dt>
            <dd className="text-2xl font-semibold"><Money value={overview.book.totalCosts} /></dd>
            <p className="text-sm text-[#5c5146]">Direct costs, book overheads, and extras.</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Year to date profit</dt>
            <dd className="text-2xl font-semibold"><Money value={overview.yearToDate.profit} /></dd>
            <p className="text-sm text-[#5c5146]">{overview.today ? `Through ${formatDate(overview.today)} · ${overview.ytdDays} days of overheads` : "The desk date is still settling."}</p>
          </div>
        </dl>
        <h4 className="mt-5 text-sm font-semibold">Direct costs</h4>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <CostLine label="Ingredients" value={overview.ingredients} />
          <CostLine label="Cups Direct boxes" value={overview.boxes} />
          <CostLine label="Small pots" value={overview.pots} />
          <CostLine label="Oven electricity" value={overview.electricity} />
          <CostLine label="Labour payout" value={overview.labour} />
          <CostLine label="Delivery fuel" value={overview.fuel} />
        </ul>
        {overview.uncostedLines > 0 ? (
          <p className="mt-3 text-sm text-[#5c5146]">{`${overview.uncostedLines} lines have no recipe, so their food cost is £0.00.`}</p>
        ) : null}
      </section>

      <YearEnd overview={overview} />
      <Advisor
        advice={advice}
        source={source}
        pending={pending}
        note={advisorNote}
        prompt={prompt}
        onAsk={(next) => void ask(next)}
      />
    </section>
  );
}

function OrderSources({
  overview,
  coverage,
  formatDate,
}: {
  overview: BusinessOverview;
  coverage: WixSnapshotCoverage;
  formatDate: (iso: string) => string;
}) {
  const pulled = coverage.pulledAt ? coverage.pulledAt.slice(0, 10) : "";
  const slot =
    coverage.slotFrom && coverage.slotUntil
      ? `${formatDate(coverage.slotFrom)} to ${formatDate(coverage.slotUntil)}`
      : "no delivery slot dates";
  const gap =
    coverage.state !== "loaded"
      ? "No saved Wix order file is loaded, so fulfilled orders from April are not in this total."
      : coverage.fulfilledFromApril === 0
        ? "Fulfilled Wix orders from April 2026 onward are not in the saved file, so that turnover is not in the total above. This page reads the saved file only and does not contact Wix."
        : `The saved file includes ${coverage.fulfilledFromApril} fulfilled Wix orders from April 2026 onward. Only orders this desk loads into the book are in the total above.`;
  return (
    <section className="mt-4 rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-4" aria-label="Live Wix orders and local test orders">
      <h3 className="text-base font-semibold">Live Wix orders and local test orders</h3>
      <p className="mt-2 text-sm leading-6 text-[#5c5146]">
        {coverage.state === "loaded"
          ? `The saved Wix file has ${coverage.rawOrderCount} orders${pulled ? `, saved ${formatDate(pulled)}` : ""}. ${coverage.unfulfilledCount} are not fulfilled and ${coverage.fulfilledCount} are fulfilled. Delivery slots run ${slot}. The totals written on those orders add up to ${gbp(coverage.statedTotal)}.`
          : "The saved Wix order file is not loaded."}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#5c5146]">
        {`In the selected From / Until range, scheduled sales are ${gbp(overview.scheduledSales)}: ${gbp(overview.wixSnapshotSales)} from ${overview.wixSnapshotCount} saved Wix bookings and ${gbp(overview.localMockSales)} from ${overview.localMockCount} local test bookings. Corporate test history is ${gbp(overview.historicalSales)} from ${overview.historicalCount} orders stored in this app. Those test orders are not a Wix download.`}
      </p>
      {coverage.linesMissingPrice > 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#5c5146]">
          {`${coverage.linesMissingPrice} saved Wix lines have no price of their own, so this page uses the menu price for them. That can differ from the total written on the Wix order.`}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-[#5c5146]">{gap}</p>
    </section>
  );
}

function Figure({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">{label}</dt>
      <dd className="text-2xl font-semibold"><Money value={value} /></dd>
      <p className="text-sm text-[#5c5146]">{detail}</p>
    </div>
  );
}

function CostLine({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-md border border-[#eadfce] bg-[#fffaf3] px-3 py-2">
      <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">{label}</p>
      <p className="text-lg font-semibold"><Money value={value} /></p>
    </li>
  );
}

function YearEnd({ overview }: { overview: BusinessOverview }) {
  const ytd = overview.yearToDateParts;
  const rows: Array<{ group: string; label: string; book: number; ytd: number; annual: number | null }> = [
    { group: "Income", label: "Scheduled bookings", book: overview.scheduledSales, ytd: ytd.scheduledSales, annual: overview.scheduledSales },
    { group: "Income", label: "Corporate test history", book: overview.historicalSales, ytd: ytd.historicalSales, annual: overview.historicalSales },
    { group: "Income", label: "Total income", book: overview.sales, ytd: ytd.sales, annual: overview.sales },
    { group: "Direct costs", label: "Ingredients", book: overview.ingredients, ytd: ytd.ingredients, annual: overview.ingredients },
    { group: "Direct costs", label: "Cups Direct boxes", book: overview.boxes, ytd: ytd.boxes, annual: overview.boxes },
    { group: "Direct costs", label: "Small pots", book: overview.pots, ytd: ytd.pots, annual: overview.pots },
    { group: "Direct costs", label: "Oven electricity", book: overview.electricity, ytd: ytd.electricity, annual: overview.electricity },
    { group: "Direct costs", label: "Labour payout", book: overview.labour, ytd: ytd.labour, annual: overview.labour },
    { group: "Direct costs", label: "Delivery fuel", book: overview.fuel, ytd: ytd.fuel, annual: overview.fuel },
    { group: "Direct costs", label: "Total direct costs", book: overview.direct, ytd: ytd.direct, annual: overview.direct },
    ...overview.overheads.map((item) => ({
      group: "Fixed overheads",
      label: item.name,
      book: item.forSpan,
      ytd: item.yearToDate,
      annual: item.annual,
    })),
    { group: "Fixed overheads", label: "Total fixed overheads", book: overview.overheadForSpan, ytd: overview.overheadYearToDate, annual: overview.overheadAnnual },
    ...overview.extras.map((item) => ({
      group: "Variable extras",
      label: item.category,
      book: item.book,
      ytd: item.yearToDate,
      annual: item.recorded,
    })),
    { group: "Variable extras", label: "Total variable extras", book: overview.extrasBook, ytd: overview.extrasYearToDate, annual: overview.extrasRecorded },
  ];
  return (
    <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Yearly accounts and year-end summary">
      <h3 className="text-lg font-semibold">{`Yearly accounts and year-end summary · ${overview.year}`}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
        {`Order book is every recorded sale from ${overview.firstDate || "—"} to ${overview.lastDate || "—"}. Year to date runs from 1 January through ${overview.today ? formatDate(overview.today) : "today"} (${overview.ytdDays} days) and charges overheads for those days. The full-year column keeps the recorded sales and direct costs, and stretches only the fixed overheads to 12 months. Undated extras sit in every column.`}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[#eadfce] text-xs tracking-wide text-[#5c5146] uppercase">
              <th className="px-2 py-2 font-semibold">Category</th>
              <th className="px-2 py-2 font-semibold">Order book</th>
              <th className="px-2 py-2 font-semibold">Year to date</th>
              <th className="px-2 py-2 font-semibold">Full-year run-rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const previous = rows[index - 1];
              const lead = previous?.group !== row.group;
              const total = row.label.startsWith("Total");
              return (
                <tr key={`${row.group}-${row.label}`} className={total ? "border-b border-[#eadfce] font-semibold" : "border-b border-[#f0e6d8]"}>
                  <th className="px-2 py-2 text-left font-medium" scope="row">
                    {lead ? <span className="mb-1 block text-xs tracking-wide text-[#7d3044] uppercase">{row.group}</span> : null}
                    {row.label}
                  </th>
                  <td className="px-2 py-2"><Money value={row.book} /></td>
                  <td className="px-2 py-2"><Money value={row.ytd} /></td>
                  <td className="px-2 py-2">{row.annual === null ? "—" : <Money value={row.annual} />}</td>
                </tr>
              );
            })}
            <tr className="border-b border-[#eadfce] font-semibold">
              <th className="px-2 py-2 text-left" scope="row">
                <span className="mb-1 block text-xs tracking-wide text-[#7d3044] uppercase">Profit</span>
                Net profit
              </th>
              <td className="px-2 py-2"><Money value={overview.book.profit} /></td>
              <td className="px-2 py-2"><Money value={overview.yearToDate.profit} /></td>
              <td className="px-2 py-2"><Money value={overview.fullYearRunRate.profit} /></td>
            </tr>
            <tr className="border-b border-[#f0e6d8]">
              <th className="px-2 py-2 text-left font-medium" scope="row">Margin</th>
              <td className="px-2 py-2">{`${overview.book.marginPercent.toFixed(1)}%`}</td>
              <td className="px-2 py-2">{`${overview.yearToDate.marginPercent.toFixed(1)}%`}</td>
              <td className="px-2 py-2">{`${overview.fullYearRunRate.marginPercent.toFixed(1)}%`}</td>
            </tr>
            <tr>
              <th className="px-2 py-2 text-left font-medium" scope="row">Active VAT</th>
              <td className="px-2 py-2"><Money value={overview.book.vatAmount} /></td>
              <td className="px-2 py-2"><Money value={overview.yearToDate.vatAmount} /></td>
              <td className="px-2 py-2"><Money value={overview.fullYearRunRate.vatAmount} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      {overview.months.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold">Income and direct costs by month</h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overview.months.map((month) => (
              <li key={month.key} className="rounded-md border border-[#eadfce] bg-[#fffaf3] px-3 py-2 text-sm">
                <p className="font-semibold">{month.label}</p>
                <p className="text-[#5c5146]">{`Sales ${gbp(month.sales)} · direct costs ${gbp(month.direct)}`}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <VatPreview slice={overview.book} />
    </section>
  );
}

function VatPreview({ slice }: { slice: ProfitSlice }) {
  return (
    <div
      className="mt-4 rounded-md border border-[#e4d5c3] p-3 text-[#8a8178]"
      style={{ opacity: 0.72, backgroundColor: "#f3f0ea", color: "#8a8178" }}
    >
      <p className="text-xs font-semibold tracking-wide uppercase">If VAT registered — 20% VAT applied</p>
      <p className="mt-1 text-sm leading-6">
        {`Preview only. Sarah is not VAT-registered, so this 20% figure is not live tax. The 20% is worked out of the ${gbp(slice.sales)} sale price. Labour and raw ingredients stay at 0% VAT, so their cost is unchanged. Boxes, pots, electricity, fuel, overheads, and extras are not reduced either.`}
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold tracking-wide uppercase">VAT in the sale price</dt>
          <dd className="text-lg font-semibold">{gbp(slice.registeredVatAmount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide uppercase">Sale after that VAT</dt>
          <dd className="text-lg font-semibold">{gbp(slice.registeredNetSale)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide uppercase">Profit on that basis</dt>
          <dd className="text-lg font-semibold">{gbp(slice.registeredProfit)}</dd>
          <p className="text-sm leading-6">{`${slice.registeredMarginPercent.toFixed(1)}% of the sale after VAT. Live profit stays ${gbp(slice.profit)}.`}</p>
        </div>
      </dl>
    </div>
  );
}

function Advisor({
  advice,
  source,
  pending,
  note,
  prompt,
  onAsk,
}: {
  advice: BusinessAdvice;
  source: "local" | "llm";
  pending: boolean;
  note: string;
  prompt: AdvicePrompt;
  onAsk: (prompt: AdvicePrompt) => void;
}) {
  return (
    <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="AI business and yearly accounts advisor">
      <h3 className="text-lg font-semibold">AI business and yearly accounts advisor</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
        The snapshot sent from here is totals, dates, and overhead names. Customer names, emails, phone numbers, and addresses stay on the desk. A configured language-model key can tighten the wording. With no key, or if that request fails, the same notes are built from these figures. This organises the year and suggests what to review. Final year-end accounts are signed off with the accountant.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ADVICE_PROMPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === prompt ? "inline-flex items-center justify-center rounded-md bg-[#7d3044] px-3 py-2 text-sm font-semibold text-white" : secondaryClass}
            aria-pressed={item.id === prompt}
            disabled={pending}
            onClick={() => onAsk(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-[#5c5146]">{pending ? "Checking the advisor…" : note}</p>
      <p className="mt-1 text-xs font-semibold tracking-wide text-[#5c5146] uppercase">{source === "llm" ? "Language model wording" : "Desk figures"}</p>
      <div className="mt-3 space-y-3 text-sm leading-6">
        {advice.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <ul className="list-disc space-y-1 pl-5">
          {advice.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
