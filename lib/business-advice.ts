import type { BusinessOverview } from "@/lib/business-overview";

export type AdvicePrompt = "profit" | "yearly" | "vat";

export interface BusinessAdvice {
  prompt: AdvicePrompt;
  paragraphs: string[];
  points: string[];
}

export const ADVICE_PROMPTS: Array<{ id: AdvicePrompt; label: string }> = [
  { id: "profit", label: "Review Profit & Margin" },
  { id: "yearly", label: "Prepare Yearly Accounts Summary" },
  { id: "vat", label: "Check VAT / Cost Risks" },
];

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function period(overview: BusinessOverview): string {
  if (!overview.firstDate || !overview.lastDate) return "No dated orders are on the books.";
  return `${overview.firstDate} to ${overview.lastDate} (${overview.spanDays} days, including days with no delivery)`;
}

export function adviseBusiness(overview: BusinessOverview, prompt: AdvicePrompt): BusinessAdvice {
  if (prompt === "yearly") return yearlyAdvice(overview);
  if (prompt === "vat") return vatAdvice(overview);
  return profitAdvice(overview);
}

function profitAdvice(overview: BusinessOverview): BusinessAdvice {
  const book = overview.book;
  const paragraphs = [
    `Recorded sales are ${gbp(overview.sales)}. ${gbp(overview.wixSnapshotSales)} comes from ${overview.wixSnapshotCount} saved Wix bookings, ${gbp(overview.localMockSales)} from ${overview.localMockCount} local test bookings, and ${gbp(overview.historicalSales)} from ${overview.historicalCount} corporate test orders stored in this app. The order book covers ${period(overview)}.`,
    `Direct costs are ${gbp(overview.direct)}. Ingredients ${gbp(overview.ingredients)}, Cups Direct boxes ${gbp(overview.boxes)}, small pots ${gbp(overview.pots)}, oven electricity ${gbp(overview.electricity)} pooled once per delivery day, labour ${gbp(overview.labour)}, and delivery fuel ${gbp(overview.fuel)}.`,
    `Fixed overheads across those ${overview.spanDays} days are ${gbp(overview.overheadForSpan)}. The monthly total is ${gbp(overview.overheadMonthly)}, which is ${gbp(overview.overheadAnnual)} over a full year and ${gbp(overview.overheadYearToDate)} from 1 January through ${overview.today || "today"}. Variable extras inside the order book are ${gbp(overview.extrasBook)}.`,
    `Net profit on this book is ${gbp(book.profit)}, a ${book.marginPercent.toFixed(1)}% margin. Active VAT is ${gbp(book.vatAmount)}. Taking 20% out of the sale price would leave profit of ${gbp(book.registeredProfit)}.`,
  ];
  const points = [
    book.marginPercent >= 30
      ? `The ${book.marginPercent.toFixed(1)}% margin is at or above the 30% target used on menu items.`
      : `The ${book.marginPercent.toFixed(1)}% margin is under the 30% target used on menu items. Review ingredient weights and sale prices with the accountant before year end.`,
    overview.overheadMonthly === 0
      ? "Fixed overheads are still £0.00 a month, so rent, insurance, accountancy, and the other rows are not in this profit yet."
      : `Enabled overheads total ${gbp(overview.overheadMonthly)} a month. The order-book charge uses that monthly figure × 12 ÷ 365 × ${overview.spanDays} days.`,
    overview.uncostedLines > 0
      ? `${overview.uncostedLines} lines have no recipe, so their ingredient, box, and pot cost is £0.00.`
      : "Every line in this book has a recipe, so ingredient, box, and pot costs are included.",
    "Oven electricity is counted once for each delivery day. Compatible trays from every order that day share the batch.",
    "Labour and raw ingredients stay at 0% VAT, so their cost is the same in the live figures and in the 20% preview.",
  ];
  return { prompt: "profit", paragraphs, points };
}

function yearlyAdvice(overview: BusinessOverview): BusinessAdvice {
  const overheadLines = overview.overheads
    .map((item) => `${item.name}: ${gbp(item.monthly)} a month, ${gbp(item.yearToDate)} year to date, ${gbp(item.annual)} for a full year`)
    .join(". ");
  const extraLines = overview.extras
    .filter((item) => item.recorded > 0)
    .map((item) => `${item.category} ${gbp(item.recorded)}`)
    .join(", ");
  const paragraphs = [
    `Year ${overview.year} income on the books is ${gbp(overview.sales)}. Year to date, through ${overview.today || "the latest known day"}, sales are ${gbp(overview.yearToDate.sales)} and direct costs are ${gbp(overview.yearToDate.direct)}.`,
    `Expense groups for this range are ingredients ${gbp(overview.ingredients)}, Cups Direct boxes ${gbp(overview.boxes)}, small pots ${gbp(overview.pots)}, oven electricity ${gbp(overview.electricity)}, labour ${gbp(overview.labour)}, and delivery fuel ${gbp(overview.fuel)}.`,
    overheadLines
      ? `Fixed overheads. ${overheadLines}.`
      : "No fixed overhead rows are switched on.",
    `Year-to-date profit, after overheads of ${gbp(overview.overheadYearToDate)} and extras of ${gbp(overview.extrasYearToDate)}, is ${gbp(overview.yearToDate.profit)}. Charging a full year of overheads (${gbp(overview.overheadAnnual)}) against the sales currently recorded would leave ${gbp(overview.fullYearRunRate.profit)}. That full-year column does not invent extra sales.`,
  ];
  const points = [
    "Group the handoff as income, direct order costs, fixed overheads, and variable extras. Keep scheduled bookings separate from delivered history.",
    extraLines ? `Variable extras recorded so far: ${extraLines}.` : "No variable extras are recorded yet.",
    overview.canceledLeftOut === 1
      ? "1 canceled order is left out of income and costs."
      : overview.canceledLeftOut > 1
        ? `${overview.canceledLeftOut} canceled orders are left out of income and costs.`
        : "No canceled orders are in this summary.",
    "These figures organise the year for review. Final year-end accounts are signed off with the accountant.",
  ];
  return { prompt: "yearly", paragraphs, points };
}

function vatAdvice(overview: BusinessOverview): BusinessAdvice {
  const book = overview.book;
  const paragraphs = [
    `Active VAT is ${gbp(book.vatAmount)}. The business is not VAT-registered, so nothing is taken off the ${gbp(book.sales)} of recorded sales and nothing is added to labour or ingredients.`,
    `The comparison works 20% out of the sale price. Net sales would be ${gbp(book.registeredNetSale)} and VAT ${gbp(book.registeredVatAmount)}. Profit would move from ${gbp(book.profit)} to ${gbp(book.registeredProfit)}. Costs stay ${gbp(book.totalCosts)}.`,
    `The usual UK VAT registration threshold is £90,000 of taxable turnover in a rolling 12 months. Confirm the current threshold with the accountant. This order book shows ${gbp(overview.sales)}, which is not a rolling-12-month return.`,
  ];
  const points = [
    overview.sales >= 90000
      ? `Recorded sales of ${gbp(overview.sales)} are at or above £90,000. Ask the accountant whether a VAT registration review is due.`
      : `Recorded sales of ${gbp(overview.sales)} are below £90,000. Keep the accountant's threshold check on the year-end list.`,
    "The 20% figure is a preview, not live tax. Input VAT is not reclaimed on ingredients, labour, boxes, pots, electricity, overheads, or extras.",
    overview.labour > 0
      ? `Labour of ${gbp(overview.labour)} stays at 0% VAT in both the live profit and the preview.`
      : "No labour rate is switched on, so labour is £0.00 and stays outside VAT.",
    "Do not file this preview. The accountant signs off the year-end VAT position.",
  ];
  return { prompt: "vat", paragraphs, points };
}

export function adviceMoneyFigures(advice: BusinessAdvice): string[] {
  const found = new Set<string>();
  const text = [...advice.paragraphs, ...advice.points].join(" ");
  for (const match of text.matchAll(/£\d[\d,]*\.\d{2}/g)) found.add(match[0]);
  return [...found];
}
