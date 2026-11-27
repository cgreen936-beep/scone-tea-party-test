import { SEEDED_BOX_STOCK } from "@/lib/box-stock";
import { recipeFoodUnitCost, type CatalogueItem, type EditableRecipe } from "@/lib/costing";
import { orderSizeLabel, tightSlotClashes, type RouteOrder } from "@/lib/delivery-route";
import type { UnifiedOrder } from "@/lib/mock-data";
import { addIsoDays } from "@/lib/uk-date";

export type WarningSeverity = "high" | "medium" | "low";
export type WarningCategory = "stock" | "delivery" | "margin";

export interface DeskWarning {
  id: string;
  severity: WarningSeverity;
  category: WarningCategory;
  title: string;
  detail: string;
}

export interface IssueBrief {
  throughDate: string;
  leadDate: string;
  boxSize4: {
    requiredByDate: number;
    stock: number;
    deficit: number;
    fortnightRequired: number;
    fortnightDeficit: number;
  };
  otherShortages: Array<{ label: string; required: number; stock: number; deficit: number; horizon: string }>;
  clashes: Array<{ date: string; area: string; drops: number; withinMinutes: number; districts: string[] }>;
  marginRisks: Array<{ item: string; marginPercent: number; profit: number }>;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BOX_SIZES = ["1", "2", "3", "4", "5"] as const;
export const BOX_CRUNCH_DATE = "2026-12-02";

export function boxStockKey(size: string): string {
  return `Cups Direct box size ${size}|Cups Direct box size ${size}`;
}

export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function recipeFor(recipes: EditableRecipe[], line: { catalogItemId?: string; name: string }): EditableRecipe | undefined {
  return (
    (line.catalogItemId ? recipes.find((entry) => entry.itemId === line.catalogItemId) : undefined) ??
    recipes.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase())
  );
}

function boxSizeFor(recipe: EditableRecipe | undefined): string {
  return recipe?.boxType.startsWith("cups-") ? recipe.boxType.slice(5) : "";
}

function activeOrders(orders: UnifiedOrder[], from: string, until: string): UnifiedOrder[] {
  return orders.filter((order) => order.orderStatus !== "CANCELED" && order.deliveryDate >= from && order.deliveryDate <= until);
}

function boxesNeeded(orders: UnifiedOrder[], recipes: EditableRecipe[]): Record<string, number> {
  const totals: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const order of orders) {
    for (const line of order.lineItems) {
      const size = boxSizeFor(recipeFor(recipes, line));
      if (!totals[size] && totals[size] !== 0) continue;
      const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
      totals[size] += quantity;
    }
  }
  return totals;
}

function stockAmount(stock: Record<string, number>, key: string): number {
  const amount = stock[key];
  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
}

function routeOf(order: UnifiedOrder): RouteOrder {
  return {
    id: order.id,
    contactName: order.contactName,
    companyName: order.companyName,
    deliveryAddress: order.deliveryAddress,
    deliveryDate: order.deliveryDate,
    deliveryWindow: order.deliveryWindow,
    fulfillment: order.fulfillment,
    sizeLabel: orderSizeLabel(order.lineItems),
  };
}

function marginRows(
  orders: UnifiedOrder[],
  recipes: EditableRecipe[],
  catalogue: CatalogueItem[],
  prices: Map<string, number>,
): Array<{ item: string; marginPercent: number; profit: number; severity: WarningSeverity }> {
  const names = new Set<string>();
  for (const order of orders) {
    for (const line of order.lineItems) names.add(line.name.trim().toLowerCase());
  }
  const rows: Array<{ item: string; marginPercent: number; profit: number; severity: WarningSeverity }> = [];
  for (const recipe of recipes) {
    if (!names.has(recipe.itemName.trim().toLowerCase())) continue;
    const sale = recipe.salePriceOverride ?? prices.get(recipe.itemName.trim().toLowerCase()) ?? 0;
    if (sale <= 0) continue;
    const direct = recipeFoodUnitCost(recipe, catalogue);
    const profit = Math.round((sale - direct) * 100) / 100;
    const marginPercent = Math.round((profit / sale) * 1000) / 10;
    if (profit < 0) rows.push({ item: recipe.itemName, marginPercent, profit, severity: "high" });
    else if (marginPercent < 10) rows.push({ item: recipe.itemName, marginPercent, profit, severity: "medium" });
  }
  return rows.sort((a, b) => a.profit - b.profit || a.item.localeCompare(b.item, "en-GB"));
}

export function buildDeskWarnings(input: {
  orders: UnifiedOrder[];
  recipes: EditableRecipe[];
  catalogue: CatalogueItem[];
  stock: Record<string, number>;
  prices: Map<string, number>;
  todayIso: string;
}): { warnings: DeskWarning[]; brief: IssueBrief } {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(input.todayIso) ? input.todayIso : "2026-11-27";
  const through = today <= BOX_CRUNCH_DATE ? BOX_CRUNCH_DATE : today;
  const lead = addIsoDays(today, 13);
  const byDate = boxesNeeded(activeOrders(input.orders, today, through), input.recipes);
  const byLead = boxesNeeded(activeOrders(input.orders, today, lead), input.recipes);
  const warnings: DeskWarning[] = [];
  const otherShortages: IssueBrief["otherShortages"] = [];

  for (const size of BOX_SIZES) {
    const stock = stockAmount(input.stock, boxStockKey(size));
    const requiredByDate = byDate[size] ?? 0;
    const fortnightRequired = byLead[size] ?? 0;
    const deficit = Math.max(0, requiredByDate - stock);
    const fortnightDeficit = Math.max(0, fortnightRequired - stock);
    if (size === "4") {
      warnings.push({
        id: "stock-box-4",
        severity: deficit > 0 ? "high" : fortnightDeficit > 0 ? "medium" : "low",
        category: "stock",
        title: `Cups Direct box size 4 is ${deficit > 0 ? `${deficit} short` : "covered"} by ${longDate(through)}`,
        detail: `${requiredByDate} size 4 ${requiredByDate === 1 ? "box is" : "boxes are"} booked from ${longDate(today)} through ${longDate(through)}, and ${stock} ${stock === 1 ? "is" : "are"} in stock. Deficit ${deficit}. The 14-day Cups Direct lead time runs through ${longDate(lead)} and books ${fortnightRequired}, which is ${fortnightDeficit} short of stock. A reorder placed today will not arrive inside this fortnight.`,
      });
    } else if (deficit > 0 || fortnightDeficit > 0) {
      warnings.push({
        id: `stock-box-${size}`,
        severity: deficit > 0 ? "high" : "medium",
        category: "stock",
        title: `Cups Direct box size ${size} is ${deficit > 0 ? `${deficit} short by ${longDate(through)}` : `${fortnightDeficit} short inside the 14-day lead time`}`,
        detail: `${requiredByDate} booked by ${longDate(through)} against ${stock} in stock. Through ${longDate(lead)} the book needs ${fortnightRequired}.`,
      });
      otherShortages.push({
        label: `Cups Direct box size ${size}`,
        required: deficit > 0 ? requiredByDate : fortnightRequired,
        stock,
        deficit: deficit > 0 ? deficit : fortnightDeficit,
        horizon: deficit > 0 ? through : lead,
      });
    }
  }

  const seededKeys = new Set(Object.keys(SEEDED_BOX_STOCK));
  const drawn = new Map<string, { byDate: number; byLead: number }>();
  const addDraw = (key: string, amount: number, horizon: "byDate" | "byLead") => {
    const row = drawn.get(key) ?? { byDate: 0, byLead: 0 };
    row[horizon] += amount;
    drawn.set(key, row);
  };
  for (const order of activeOrders(input.orders, today, lead)) {
    const horizon = order.deliveryDate <= through ? "byDate" : "byLead";
    for (const line of order.lineItems) {
      const recipe = recipeFor(input.recipes, line);
      if (!recipe) continue;
      const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
      const covers = Math.max(1, Math.round(recipe.coversUnits ?? 1) || 1);
      for (const entry of recipe.lines) {
        const item = input.catalogue.find((catalogueItem) => catalogueItem.id === entry.catalogueId);
        if (!item) continue;
        const key = `${item.name}|${item.packLabel}`;
        if (seededKeys.has(key) || !Object.prototype.hasOwnProperty.call(input.stock, key)) continue;
        addDraw(key, (entry.quantity / covers) * quantity, horizon === "byDate" ? "byDate" : "byLead");
        if (horizon === "byDate") addDraw(key, 0, "byLead");
      }
    }
  }
  for (const [key, row] of drawn) {
    const required = row.byDate + row.byLead;
    const byCrunch = row.byDate;
    const stock = stockAmount(input.stock, key);
    const deficit = Math.max(0, (byCrunch > stock ? byCrunch : required) - stock);
    if (deficit <= 0) continue;
    const label = key.split("|")[0] || key;
    const shortByCrunch = byCrunch > stock;
    warnings.push({
      id: `stock-item-${key}`,
      severity: shortByCrunch ? "high" : "medium",
      category: "stock",
      title: `${label} is ${Math.round(deficit * 10) / 10} short`,
      detail: shortByCrunch
        ? `${Math.round(byCrunch * 10) / 10} needed by ${longDate(through)} and ${stock} recorded in stock.`
        : `${Math.round(required * 10) / 10} needed through ${longDate(lead)} and ${stock} recorded in stock.`,
    });
    if (otherShortages.length < 12) {
      otherShortages.push({
        label,
        required: Math.round((shortByCrunch ? byCrunch : required) * 10) / 10,
        stock,
        deficit: Math.round(deficit * 10) / 10,
        horizon: shortByCrunch ? through : lead,
      });
    }
  }

  const clashes = tightSlotClashes(activeOrders(input.orders, "2026-01-01", "2026-12-31").map(routeOf));
  for (const clash of clashes) {
    const districts = [...new Set(clash.stops.map((stop) => stop.district).filter(Boolean))];
    const sizes = clash.stops.map((stop) => `${stop.district || stop.postcode}, ${stop.sizeLabel}`).join("; ");
    warnings.push({
      id: `delivery-${clash.date}`,
      severity: "high",
      category: "delivery",
      title: `${districts.length} Stoke-on-Trent drops within ${clash.withinMinutes} minutes on ${longDate(clash.date)}`,
      detail: `${sizes}. The van cannot cover those districts in that gap. Move at least two slots so the starts are about 20 minutes apart.`,
    });
  }

  const margins = marginRows(activeOrders(input.orders, today, lead), input.recipes, input.catalogue, input.prices);
  for (const row of margins) {
    warnings.push({
      id: `margin-${row.item.toLowerCase()}`,
      severity: row.severity,
      category: "margin",
      title: `${row.item} margin is ${row.marginPercent.toFixed(1)}%`,
      detail: `Sale minus ingredients, box, pots, and labour leaves £${row.profit.toFixed(2)} on one item. Active VAT is £0.00. ${row.profit < 0 ? "This item sells below its direct cost." : "This item is under a 10% margin."}`,
    });
  }

  const size4Stock = stockAmount(input.stock, boxStockKey("4"));
  const brief: IssueBrief = {
    throughDate: through,
    leadDate: lead,
    boxSize4: {
      requiredByDate: byDate["4"] ?? 0,
      stock: size4Stock,
      deficit: Math.max(0, (byDate["4"] ?? 0) - size4Stock),
      fortnightRequired: byLead["4"] ?? 0,
      fortnightDeficit: Math.max(0, (byLead["4"] ?? 0) - size4Stock),
    },
    otherShortages,
    clashes: clashes.map((clash) => ({
      date: clash.date,
      area: clash.area,
      drops: clash.stops.length,
      withinMinutes: clash.withinMinutes,
      districts: [...new Set(clash.stops.map((stop) => stop.district).filter(Boolean))],
    })),
    marginRisks: margins.slice(0, 12).map((row) => ({
      item: row.item,
      marginPercent: row.marginPercent,
      profit: row.profit,
    })),
  };
  return { warnings, brief };
}
