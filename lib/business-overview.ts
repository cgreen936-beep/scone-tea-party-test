import { extraCategoryLabel, type ExtraCategory, type ExtraCost, type FixedOverhead } from "@/lib/business-records";
import type { HistoricalCorporateOrder } from "@/lib/corporate-portal";
import {
  notRegisteredItemProfit,
  profitOnAmounts,
  settleDayProfit,
  type BakeSettings,
  type CatalogueItem,
  type DayProfitLine,
  type EditableRecipe,
} from "@/lib/costing";
import { fuelCostForMiles, planDeliveryDays } from "@/lib/delivery-route";
import type { UnifiedOrder } from "@/lib/mock-data";
import { addIsoDays } from "@/lib/uk-date";

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

export interface OverviewLine {
  date: string;
  orderId: string;
  name: string;
  catalogItemId?: string;
  quantity: number;
  unitPrice: number;
  source: "scheduled" | "history";
  book: "wix" | "local" | "history";
}

export interface OverheadFigure {
  name: string;
  monthly: number;
  annual: number;
  yearToDate: number;
  forSpan: number;
}

export interface ExtraFigure {
  category: string;
  book: number;
  yearToDate: number;
  recorded: number;
}

export interface ProfitSlice {
  sales: number;
  direct: number;
  overheads: number;
  extras: number;
  totalCosts: number;
  vatAmount: number;
  profit: number;
  marginPercent: number;
  registeredVatAmount: number;
  registeredNetSale: number;
  registeredProfit: number;
  registeredMarginPercent: number;
}

export interface MonthFigure {
  key: string;
  label: string;
  sales: number;
  direct: number;
}

export interface CostParts {
  sales: number;
  scheduledSales: number;
  historicalSales: number;
  ingredients: number;
  boxes: number;
  pots: number;
  electricity: number;
  labour: number;
  fuel: number;
  direct: number;
  uncostedLines: number;
}

export interface BusinessOverview {
  today: string;
  year: string;
  ytdDays: number;
  canceledLeftOut: number;
  scheduledCount: number;
  wixSnapshotCount: number;
  localMockCount: number;
  historicalCount: number;
  firstDate: string;
  lastDate: string;
  spanDays: number;
  sales: number;
  scheduledSales: number;
  wixSnapshotSales: number;
  localMockSales: number;
  historicalSales: number;
  ingredients: number;
  boxes: number;
  pots: number;
  electricity: number;
  labour: number;
  fuel: number;
  direct: number;
  uncostedLines: number;
  overheads: OverheadFigure[];
  overheadMonthly: number;
  overheadAnnual: number;
  overheadYearToDate: number;
  overheadForSpan: number;
  extras: ExtraFigure[];
  extrasBook: number;
  extrasYearToDate: number;
  extrasRecorded: number;
  months: MonthFigure[];
  yearToDateParts: CostParts;
  book: ProfitSlice;
  yearToDate: ProfitSlice;
  fullYearRunRate: ProfitSlice;
}

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function inclusiveIsoDays(start: string, end: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return 0;
  let count = 1;
  let cursor = start;
  while (cursor < end && count < 800) {
    cursor = addIsoDays(cursor, 1);
    count += 1;
  }
  return count;
}

function monthLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const name = MONTHS[month - 1] ?? iso.slice(5, 7);
  return `${name} ${iso.slice(0, 4)}`;
}

function findRecipe(recipes: EditableRecipe[], catalogItemId: string | undefined, name: string): EditableRecipe | undefined {
  return (
    (catalogItemId ? recipes.find((entry) => entry.itemId === catalogItemId) : undefined) ??
    recipes.find((entry) => entry.itemName.trim().toLowerCase() === name.trim().toLowerCase())
  );
}

function salesByBook(
  lines: OverviewLine[],
  recipes: EditableRecipe[],
  catalogPrice: (name: string) => number,
): { wix: number; local: number } {
  let wix = 0;
  let local = 0;
  for (const line of lines) {
    if (line.book === "history") continue;
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    const recipe = findRecipe(recipes, line.catalogItemId, line.name);
    const sale = quantity * lineSale(recipe, line.unitPrice, catalogPrice(line.name));
    if (line.book === "wix") wix += sale;
    else local += sale;
  }
  return { wix: money(wix), local: money(local) };
}

function lineSale(recipe: EditableRecipe | undefined, unitPrice: number, catalogPrice: number): number {
  if (recipe?.salePriceOverride !== undefined && Number.isFinite(recipe.salePriceOverride)) return Math.max(0, recipe.salePriceOverride);
  if (unitPrice > 0) return unitPrice;
  return Math.max(0, catalogPrice);
}

function sliceOf(sales: number, direct: number, overheads: number, extras: number): ProfitSlice {
  const settled = profitOnAmounts(sales, direct + overheads + extras);
  return {
    sales: settled.salePrice,
    direct: money(direct),
    overheads: money(overheads),
    extras: money(extras),
    totalCosts: settled.directCost,
    vatAmount: settled.vatAmount,
    profit: settled.profit,
    marginPercent: settled.marginPercent,
    registeredVatAmount: settled.registeredVatAmount,
    registeredNetSale: settled.registeredNetSale,
    registeredProfit: settled.registeredProfit,
    registeredMarginPercent: settled.registeredMarginPercent,
  };
}

function emptyParts(): CostParts {
  return {
    sales: 0,
    scheduledSales: 0,
    historicalSales: 0,
    ingredients: 0,
    boxes: 0,
    pots: 0,
    electricity: 0,
    labour: 0,
    fuel: 0,
    direct: 0,
    uncostedLines: 0,
  };
}

function costLines(
  lines: OverviewLine[],
  recipes: EditableRecipe[],
  catalogue: CatalogueItem[],
  bakeSettings: BakeSettings,
  catalogPrice: (name: string) => number,
): CostParts {
  const parts = emptyParts();
  const byDate = new Map<string, DayProfitLine[]>();
  for (const line of lines) {
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    if (quantity === 0) continue;
    const recipe = findRecipe(recipes, line.catalogItemId, line.name);
    const sale = quantity * lineSale(recipe, line.unitPrice, catalogPrice(line.name));
    parts.sales += sale;
    if (line.source === "history") parts.historicalSales += sale;
    else parts.scheduledSales += sale;
    if (!recipe) {
      parts.uncostedLines += 1;
    } else {
      const ingredientCost = recipe.lines.reduce((sum, entry) => {
        const item = catalogue.find((catalogueItem) => catalogueItem.id === entry.catalogueId);
        if (!item || item.packSize <= 0) return sum;
        return sum + (entry.quantity / item.packSize) * item.cost;
      }, 0);
      const boxCost = recipe.boxType.startsWith("cups-")
        ? (catalogue.find((item) => item.id === `box:${recipe.boxType}`)?.cost ?? 0)
        : 0;
      const unit = notRegisteredItemProfit({
        catalogPrice: 0,
        ingredientCost,
        boxCost,
        potCount: recipe.potCount,
        potUnitCost: recipe.potUnitCost,
        electricityCost: 0,
        prepMinutes: recipe.prepMinutes,
        labourHourlyRate: recipe.labourHourlyRate,
        coversUnits: recipe.coversUnits,
      });
      parts.ingredients += unit.ingredientCost * quantity;
      parts.boxes += unit.boxCost * quantity;
      parts.pots += unit.potCost * quantity;
      parts.labour += unit.labourCost * quantity;
    }
    const day = byDate.get(line.date) ?? [];
    day.push({
      orderId: line.orderId,
      name: line.name,
      catalogItemId: line.catalogItemId,
      quantity,
      unitSale: lineSale(recipe, line.unitPrice, catalogPrice(line.name)),
    });
    byDate.set(line.date, day);
  }
  for (const day of byDate.values()) {
    parts.electricity += settleDayProfit(day, recipes, catalogue, bakeSettings).electricityCost;
  }
  parts.sales = money(parts.sales);
  parts.scheduledSales = money(parts.scheduledSales);
  parts.historicalSales = money(parts.historicalSales);
  parts.ingredients = money(parts.ingredients);
  parts.boxes = money(parts.boxes);
  parts.pots = money(parts.pots);
  parts.electricity = money(parts.electricity);
  parts.labour = money(parts.labour);
  parts.direct = money(parts.ingredients + parts.boxes + parts.pots + parts.electricity + parts.labour + parts.fuel);
  return parts;
}

function fuelForOrders(orders: UnifiedOrder[], dates: Set<string>): number {
  const relevant = orders.filter((order) => order.orderStatus !== "CANCELED" && dates.has(order.deliveryDate));
  if (relevant.length === 0) return 0;
  const plans = planDeliveryDays(
    relevant.map((order) => ({
      id: order.id,
      contactName: order.contactName,
      companyName: order.companyName,
      deliveryAddress: order.deliveryAddress,
      deliveryDate: order.deliveryDate,
      deliveryWindow: order.deliveryWindow,
      fulfillment: order.fulfillment,
    })),
  );
  return money(plans.reduce((sum, plan) => sum + fuelCostForMiles(plan.bookedMiles), 0));
}

function withFuel(parts: CostParts, orders: UnifiedOrder[], dates: string[]): CostParts {
  const fuel = fuelForOrders(orders, new Set(dates));
  return { ...parts, fuel, direct: money(parts.direct + fuel) };
}

function overheadShare(monthly: number, days: number): number {
  return money(((Math.max(0, monthly) * 12) / 365) * Math.max(0, days));
}

export function buildBusinessOverview(input: {
  orders: UnifiedOrder[];
  historicalOrders: HistoricalCorporateOrder[];
  recipes: EditableRecipe[];
  catalogue: CatalogueItem[];
  bakeSettings: BakeSettings;
  today: string;
  overheads: FixedOverhead[];
  extras: ExtraCost[];
  catalogPrice?: (name: string) => number;
  rangeFrom?: string;
  rangeUntil?: string;
}): BusinessOverview {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(input.today) ? input.today : "";
  const year = (today || "2026").slice(0, 4);
  const yearStart = `${year}-01-01`;
  const ytdDays = today ? inclusiveIsoDays(yearStart, today) : 0;
  const priceFor = input.catalogPrice ?? (() => 0);
  const activeOrders = input.orders.filter((order) => order.orderStatus !== "CANCELED" && /^\d{4}-\d{2}-\d{2}$/.test(order.deliveryDate));
  const lines: OverviewLine[] = [];
  for (const order of activeOrders) {
    for (const line of order.lineItems) {
      lines.push({
        date: order.deliveryDate,
        orderId: order.id,
        name: line.name,
        catalogItemId: line.catalogItemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        source: "scheduled",
        book: order.source === "WIX_BOOKING" ? "wix" : "local",
      });
    }
  }
  for (const order of input.historicalOrders) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(order.deliveryDate)) continue;
    for (const line of order.lineItems) {
      lines.push({
        date: order.deliveryDate,
        orderId: order.id,
        name: line.name,
        catalogItemId: line.catalogItemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        source: "history",
        book: "history",
      });
    }
  }
  const rangeFrom = /^\d{4}-\d{2}-\d{2}$/.test(input.rangeFrom ?? "") ? (input.rangeFrom as string) : "";
  const rangeUntil = /^\d{4}-\d{2}-\d{2}$/.test(input.rangeUntil ?? "") ? (input.rangeUntil as string) : "";
  const ranged = Boolean(rangeFrom && rangeUntil && rangeFrom <= rangeUntil);
  const scoped = ranged ? lines.filter((line) => line.date >= rangeFrom && line.date <= rangeUntil) : lines;
  const dates = [...new Set(scoped.map((line) => line.date))].sort();
  const firstDate = ranged ? rangeFrom : (dates[0] ?? "");
  const lastDate = ranged ? rangeUntil : (dates[dates.length - 1] ?? "");
  const spanDays = firstDate && lastDate ? inclusiveIsoDays(firstDate, lastDate) : 0;
  const bookParts = withFuel(
    costLines(scoped, input.recipes, input.catalogue, input.bakeSettings, priceFor),
    activeOrders,
    dates,
  );
  const ytdLines = today ? lines.filter((line) => line.date <= today) : [];
  const yearToDateParts = today
    ? withFuel(
        costLines(ytdLines, input.recipes, input.catalogue, input.bakeSettings, priceFor),
        activeOrders,
        [...new Set(ytdLines.map((line) => line.date))],
      )
    : emptyParts();
  const overheads = input.overheads
    .filter((item) => item.enabled)
    .map((item) => {
      const monthly = money(Math.max(0, item.monthlyAmount));
      return {
        name: item.name.trim() || "Overhead",
        monthly,
        annual: money(monthly * 12),
        yearToDate: overheadShare(monthly, ytdDays),
        forSpan: overheadShare(monthly, spanDays),
      };
    });
  const overheadMonthly = money(overheads.reduce((sum, item) => sum + item.monthly, 0));
  const overheadAnnual = money(overheads.reduce((sum, item) => sum + item.annual, 0));
  const overheadYearToDate = money(overheads.reduce((sum, item) => sum + item.yearToDate, 0));
  const overheadForSpan = money(overheads.reduce((sum, item) => sum + item.forSpan, 0));
  const extraGroups = new Map<ExtraCategory, ExtraFigure>();
  for (const category of ["extra-fuel", "extra-electricity", "cleaning", "machinery", "other"] as ExtraCategory[]) {
    extraGroups.set(category, { category: extraCategoryLabel(category), book: 0, yearToDate: 0, recorded: 0 });
  }
  for (const extra of input.extras) {
    const amount = Math.max(0, extra.amount);
    const group = extraGroups.get(extra.category) ?? extraGroups.get("other");
    if (!group) continue;
    group.recorded += amount;
    const inBook = !extra.date || (firstDate && extra.date >= firstDate && extra.date <= lastDate);
    const inYear = !extra.date || (today && extra.date <= today);
    if (inBook) group.book += amount;
    if (inYear) group.yearToDate += amount;
  }
  const extras = [...extraGroups.values()].map((item) => ({
    ...item,
    book: money(item.book),
    yearToDate: money(item.yearToDate),
    recorded: money(item.recorded),
  }));
  const extrasBook = money(extras.reduce((sum, item) => sum + item.book, 0));
  const extrasYearToDate = money(extras.reduce((sum, item) => sum + item.yearToDate, 0));
  const extrasRecorded = money(extras.reduce((sum, item) => sum + item.recorded, 0));
  const bookSplit = salesByBook(scoped, input.recipes, priceFor);
  const monthKeys = [...new Set(scoped.map((line) => line.date.slice(0, 7)))].sort();
  const months = monthKeys.map((key) => {
    const monthLines = scoped.filter((line) => line.date.slice(0, 7) === key);
    const parts = withFuel(
      costLines(monthLines, input.recipes, input.catalogue, input.bakeSettings, priceFor),
      activeOrders,
      [...new Set(monthLines.map((line) => line.date))],
    );
    return { key, label: monthLabel(`${key}-01`), sales: parts.sales, direct: parts.direct };
  });
  return {
    today,
    year,
    ytdDays,
    canceledLeftOut: input.orders.filter((order) => order.orderStatus === "CANCELED").length,
    scheduledCount: ranged
      ? activeOrders.filter((order) => order.deliveryDate >= rangeFrom && order.deliveryDate <= rangeUntil).length
      : activeOrders.length,
    wixSnapshotCount: activeOrders.filter(
      (order) => order.source === "WIX_BOOKING" && (!ranged || (order.deliveryDate >= rangeFrom && order.deliveryDate <= rangeUntil)),
    ).length,
    localMockCount: activeOrders.filter(
      (order) => order.source !== "WIX_BOOKING" && (!ranged || (order.deliveryDate >= rangeFrom && order.deliveryDate <= rangeUntil)),
    ).length,
    historicalCount: ranged
      ? input.historicalOrders.filter((order) => order.deliveryDate >= rangeFrom && order.deliveryDate <= rangeUntil).length
      : input.historicalOrders.length,
    wixSnapshotSales: bookSplit.wix,
    localMockSales: bookSplit.local,
    firstDate,
    lastDate,
    spanDays,
    sales: bookParts.sales,
    scheduledSales: bookParts.scheduledSales,
    historicalSales: bookParts.historicalSales,
    ingredients: bookParts.ingredients,
    boxes: bookParts.boxes,
    pots: bookParts.pots,
    electricity: bookParts.electricity,
    labour: bookParts.labour,
    fuel: bookParts.fuel,
    direct: bookParts.direct,
    uncostedLines: bookParts.uncostedLines,
    overheads,
    overheadMonthly,
    overheadAnnual,
    overheadYearToDate,
    overheadForSpan,
    extras,
    extrasBook,
    extrasYearToDate,
    extrasRecorded,
    months,
    yearToDateParts,
    book: sliceOf(bookParts.sales, bookParts.direct, overheadForSpan, extrasBook),
    yearToDate: sliceOf(yearToDateParts.sales, yearToDateParts.direct, overheadYearToDate, extrasYearToDate),
    fullYearRunRate: sliceOf(bookParts.sales, bookParts.direct, overheadAnnual, extrasRecorded),
  };
}
