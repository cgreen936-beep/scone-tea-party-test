import {
  cataloguePrice,
  findRecipe,
  orderElectricityCost,
  unitRecipeCost,
  type BakeSettings,
  type CatalogueItem,
  type EditableRecipe,
} from "@/lib/costing";
import { findCorporateAccount, historicalOrderTotal, type CorporateAccount, type HistoricalCorporateOrder } from "@/lib/corporate-portal";
import { type MenuItem, type RecipeMatrixItem, type UnifiedOrder } from "@/lib/mock-data";

export const SARAH_SCONE_NAME = "Sarah Scone";
export const SARAH_SCONE_PASSWORD = "B@tm@n1918";
export const SESSION_TODAY = "2026-11-26";
export const REISSUE_DUE = "2026-12-26";

export type PortalRole = "customer" | "staff";

export interface PortalSession {
  displayName: string;
  companyName: string | null;
  role: PortalRole;
  canAccessOpsTabs: boolean;
}

export type InvoiceStatus = "ISSUED" | "OVERDUE" | "PAID" | "REISSUED";

export interface CorporateInvoice {
  id: string;
  companyName: string;
  email: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  paidDate?: string;
  reissueCount: number;
  summary: string;
}

export interface AccountOrderView {
  id: string;
  customer: string;
  deliveryDate: string;
  total: number;
  supplyCost: number;
  summary: string;
  canceled: boolean;
}

export interface CustomerProfit {
  customer: string;
  orders: number;
  gross: number;
  supplyCost: number;
  profit: number;
  margin: number;
}

export interface RangeSummary {
  orderCount: number;
  gross: number;
  morrisons: number;
  packCount: number;
  costPercent: number | null;
  margin: number;
}

const EXTRA_SELL_PRICES: Record<string, number> = {
  "children's sandwich platter": 12,
  "bread bun sandwich platter": 18,
  "brioche baguette sandwich platter": 22,
  "brunch bagel sandwich box": 18,
  "large vegetarian sandwich platter": 18,
  "small vegetarian sandwich platter": 10,
  "extra large vegetarian sandwich platter": 27,
  "christmas sausage rolls": 16,
  "cheese and onion rolls": 14,
  "homemade quiche": 18,
  "pork pie selection": 16,
  "cheesy garlic pinwheels": 12,
  "spiced vegan pinwheels": 12,
  "cheese and tomato pastry pinwheels": 12,
  "simple savoury grazing platter": 24,
  "small vegan grazing platter": 22,
  "deli meats grazing platter": 30,
  "small cheese box": 14,
  "large salad selection box": 12,
  "simple salad box": 8,
  "classic crisp box": 8,
  "party crisp selection": 10,
  "sweet chilli topped crisps": 8,
  "christmas cupcakes": 22,
  "selection of cupcakes": 20,
  "classic rocky road": 14,
  "orange crunch tiffin": 14,
  "mixed box of pastries": 16,
  "christmas traybake cake": 15,
  "mixed traybake platter": 18,
  "open scones with cream and jam": 10,
  "one flavour scone platter": 13.5,
  "scotch egg selection": 12,
  "crudites grazing platter": 16,
  "homemade pigs in blankets": 14,
  "bbq chicken drumsticks": 16,
  "garlic and herb chicken drumsticks": 16,
  "sweet treats selection box": 12,
};

/** Pack cost is the unit price: per kg, per 100g, per litre, or per single item. */
const PACK_PRICES: Record<string, number> = {
  "Self-Raising Flour per kg": 0.9,
  "Unsalted Butter per kg": 7.2,
  "Caster Sugar per kg": 1.5,
  "Icing Sugar per kg": 1.8,
  "Cornish Clotted Cream per kg": 12.5,
  "Mature Cheddar per kg": 8.75,
  "Mild Cheddar per kg": 7.5,
  "Brie per kg": 9.5,
  "Cream Cheese per kg": 6.8,
  "Vegan Cheese per kg": 12,
  "Honey Roast Ham per kg": 12.5,
  "Cooked Ham per kg": 10.5,
  "Serrano Ham per kg": 22,
  "Salami per kg": 16,
  "Chorizo per kg": 14,
  "Hot Honey Chorizo per kg": 16.5,
  "Pork Sausage Meat per kg": 7.5,
  "Streaky Bacon per kg": 9,
  "Chipolata Sausages per kg": 8.5,
  "Chicken Drumsticks per kg": 4.2,
  "Tuna per kg": 9,
  "Brown Onion per kg": 1.2,
  "Cherry Tomatoes per kg": 4,
  "Cucumber per kg": 1.8,
  "Carrots per kg": 1.1,
  "Red Pepper per kg": 3.5,
  "Red Grapes per kg": 4.5,
  "Strawberries per kg": 6.5,
  "Blueberries per kg": 10,
  "Rocket per kg": 12,
  "Olives per kg": 8,
  "Pickles per kg": 4,
  "Pea Shoots per kg": 18,
  "Roasted Red Peppers per kg": 7.5,
  "Chickpeas per kg": 1.8,
  "Baby Spinach per kg": 8,
  "Falafel per kg": 7,
  "Hummus per kg": 5.5,
  "Water Crackers per kg": 6,
  "Digestive Biscuits per kg": 3.5,
  "Biscoff Biscuits per kg": 8,
  "Oreos per kg": 8.5,
  "Marshmallows per kg": 6,
  "Milk Chocolate per kg": 8,
  "Dark Chocolate per kg": 9.5,
  "Dried Cranberries per kg": 8,
  "Fudge per kg": 10,
  "Breadcrumbs per kg": 2.4,
  "Dairy Free Spread per kg": 4.3,
  "Strawberry Jam per 100g": 0.55,
  "Biscoff Spread per 100g": 1.4,
  "Cocoa Powder per 100g": 1.2,
  "Lemon Curd per 100g": 0.85,
  "Cranberry Sauce per 100g": 0.7,
  "Golden Syrup per 100g": 0.4,
  "English Mustard per 100g": 0.5,
  "Caramelised Onion Chutney per 100g": 0.7,
  "Garlic Puree per 100g": 0.9,
  "Orange Marmalade per 100g": 0.5,
  "Mixed Spice per 100g": 2.6,
  "Dried Mixed Herbs per 100g": 1.1,
  "Whole Milk per litre": 1.15,
  "Double Cream per litre": 4.8,
  "Mayonnaise per litre": 3.4,
  "BBQ Sauce per litre": 3,
  "Salad Dressing per litre": 3.2,
  "Mint Yogurt Dip per litre": 2.8,
  "Free Range Egg each": 0.28,
  "Lemon each": 0.35,
  "Thick White Bread Loaf each": 1.4,
  "Seeded Bread Loaf each": 1.6,
  "Farmhouse Bread Loaf each": 1.55,
  "Soft White Bread Loaf each": 1.4,
  "Gluten Free Bread Loaf each": 2.75,
  "Soft White Bread Bun each": 0.22,
  "Brioche Roll each": 0.55,
  "Plain Bagel each": 0.48,
  "Puff Pastry Sheet each": 1.85,
  "Vegan Puff Pastry Sheet each": 2.15,
  "Shortcrust Pastry Sheet each": 1.75,
  "Little Gem Lettuce each": 0.7,
  "Ready Salted Crisps each": 0.28,
  "Cheese and Onion Crisps each": 0.3,
  "Salt and Vinegar Crisps each": 0.3,
  "Sweet Chilli Crisps each": 0.36,
  "Christmas Cupcake Topper each": 0.12,
  "Cupcake Case each": 0.07,
  "Cheese Box each": 0.35,
  "Salad Box each": 0.45,
  "Crisp Display Box each": 0.3,
  "Crisp Box each": 0.3,
  "Sweet Treat Box each": 0.35,
  "Catering Platter Tray and Film Wrap": 0.65,
  "Bakery Box and Greaseproof Liner": 0.4,
  "Traybake Liner and Box": 0.4,
  "Cupcake Box 12": 0.45,
  "Pastry Box": 0.4,
  "Sandwich Box and Liner": 0.45,
};

const FALLBACK_PACK_PRICE = 2.5;

export const SEED_INVOICES: CorporateInvoice[] = [
  {
    id: "INV-2407",
    companyName: "Biocomposits",
    email: "accounts@biocomposits.example",
    issueDate: "2026-11-18",
    dueDate: "2026-12-18",
    amount: 186,
    status: "ISSUED",
    reissueCount: 0,
    summary: "Sandwich platters, scones, and sausage rolls on invoice-later terms.",
  },
  {
    id: "INV-2394",
    companyName: "Leoni",
    email: "accounts@leoni.example",
    issueDate: "2026-10-20",
    dueDate: "2026-11-19",
    amount: 142.5,
    status: "OVERDUE",
    reissueCount: 0,
    summary: "Sandwich platters and traybakes. Payment was due 19 November 2026.",
  },
  {
    id: "INV-2388",
    companyName: "Codeweavers",
    email: "accounts@codeweavers.example",
    issueDate: "2026-11-02",
    dueDate: "2026-11-16",
    amount: 210,
    status: "PAID",
    paidDate: "2026-11-14",
    reissueCount: 0,
    summary: "Vegetarian platters and Biscoff traybakes.",
  },
  {
    id: "INV-2410",
    companyName: "Keele University Innovation Centre",
    email: "accounts.payable@keele-mock.ac.uk",
    issueDate: "2026-11-26",
    dueDate: "2026-12-10",
    amount: 101.5,
    status: "ISSUED",
    reissueCount: 0,
    summary: "PO-NHS-88412. Ham sandwiches, mixed scones, and a gluten-free platter.",
  },
  {
    id: "INV-2371",
    companyName: "Biocomposits",
    email: "accounts@biocomposits.example",
    issueDate: "2026-11-10",
    dueDate: "2026-12-10",
    amount: 96,
    status: "REISSUED",
    reissueCount: 1,
    summary: "Reissued after a purchase-order correction. Sausage rolls and lemon traybake.",
  },
];

export function initialInvoices(): CorporateInvoice[] {
  return SEED_INVOICES.map((invoice) => ({ ...invoice }));
}

export function openPortalSession(
  accounts: CorporateAccount[],
  companyName: string,
  username: string,
  password: string,
): PortalSession | null {
  if (username.trim().toLowerCase() === SARAH_SCONE_NAME.toLowerCase() && password === SARAH_SCONE_PASSWORD) {
    return {
      displayName: SARAH_SCONE_NAME,
      companyName: null,
      role: "staff",
      canAccessOpsTabs: true,
    };
  }
  const account = findCorporateAccount(accounts, companyName, username, password);
  if (!account) return null;
  return {
    displayName: account.companyName,
    companyName: account.companyName,
    role: "customer",
    canAccessOpsTabs: false,
  };
}

export function markInvoicePaid(invoice: CorporateInvoice, paidDate: string): CorporateInvoice {
  return { ...invoice, status: "PAID", paidDate };
}

export function reissueInvoice(invoice: CorporateInvoice, issueDate: string, dueDate: string): CorporateInvoice {
  return {
    ...invoice,
    status: "REISSUED",
    reissueCount: invoice.reissueCount + 1,
    issueDate,
    dueDate,
    paidDate: undefined,
  };
}

export function invoiceMessage(invoice: CorporateInvoice): { to: string; subject: string; body: string } {
  const subject = `Invoice ${invoice.id} from Scone Tea Party Ltd`;
  const paymentLine = invoice.paidDate
    ? `Paid on ${invoice.paidDate}.`
    : `Status ${invoice.status}. Due ${invoice.dueDate}.`;
  const reissueLine = invoice.reissueCount > 0 ? `Reissue ${invoice.reissueCount}, issued ${invoice.issueDate}.` : `Issued ${invoice.issueDate}.`;
  const body = [
    `Hello ${invoice.companyName},`,
    "",
    `Invoice ${invoice.id}`,
    `Amount £${invoice.amount.toFixed(2)}`,
    reissueLine,
    paymentLine,
    invoice.summary,
    "",
    "Scone Tea Party Ltd",
    "This note stays in the browser session. It is not sent to Wix.",
  ].join("\n");
  return { to: invoice.email, subject, body };
}

export function mailtoHref(message: { to: string; subject: string; body: string }): string {
  return `mailto:${encodeURIComponent(message.to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
}

export function sellUnitPrice(
  catalog: MenuItem[],
  line: { catalogItemId: string; name: string; variant?: string; unitPrice: number },
): number {
  if (line.unitPrice > 0) return line.unitPrice;
  const item =
    catalog.find((entry) => entry.id === line.catalogItemId) ??
    catalog.find((entry) => entry.name.trim().toLowerCase() === line.name.trim().toLowerCase());
  if (item) {
    const variant = item.priceVariants.find((entry) => entry.option === line.variant);
    return variant?.price ?? item.priceVariants[0]?.price ?? 0;
  }
  return EXTRA_SELL_PRICES[line.name.trim().toLowerCase()] ?? 12;
}

export function packPriceFor(label: string): number {
  return PACK_PRICES[label] ?? FALLBACK_PACK_PRICE;
}

function inRange(date: string, from: string, to: string): boolean {
  return Boolean(from && to && from <= to && date >= from && date <= to);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function supplyForLines(
  lines: Array<{ catalogItemId: string; name: string; quantity: number }>,
  matrix: RecipeMatrixItem[],
  priceFor: (label: string) => number,
): number {
  return roundMoney(
    lines.reduce((sum, line) => {
      const recipe = findRecipe(matrix, line.catalogItemId, line.name);
      if (!recipe) return sum;
      return sum + line.quantity * unitRecipeCost(recipe, priceFor);
    }, 0),
  );
}

function morrisonsFor(
  groups: Array<{ lineItems: Array<{ catalogItemId: string; name: string; quantity: number }> }>,
  matrix: RecipeMatrixItem[],
  priceFor: (label: string) => number,
): { packs: number; total: number } {
  const totals = new Map<string, { raw: number; packSize: number }>();
  for (const group of groups) {
    for (const line of group.lineItems) {
      const recipe = findRecipe(matrix, line.catalogItemId, line.name);
      if (!recipe) continue;
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.morrisonsUrl.startsWith("http")) continue;
        const current = totals.get(ingredient.packLabel) ?? { raw: 0, packSize: ingredient.packSize };
        current.raw += ingredient.amountPerUnit * line.quantity;
        totals.set(ingredient.packLabel, current);
      }
    }
  }
  let packs = 0;
  let total = 0;
  for (const [label, row] of totals) {
    const raw = Math.round(row.raw * 1000) / 1000;
    const count = raw <= 0 ? 0 : Math.ceil(raw / row.packSize - 1e-9);
    packs += count;
    total += count * priceFor(label);
  }
  return { packs, total: roundMoney(total) };
}

function liveView(
  order: UnifiedOrder,
  catalog: MenuItem[],
  matrix: RecipeMatrixItem[],
  priceFor: (label: string) => number,
  recipes: EditableRecipe[],
  bakeSettings: BakeSettings,
): AccountOrderView {
  const total = order.lineItems.reduce((sum, line) => sum + line.quantity * sellUnitPrice(catalog, line), 0);
  const food = supplyForLines(order.lineItems, matrix, priceFor);
  const electricity = order.orderStatus === "CANCELED" ? 0 : orderElectricityCost(order.lineItems, recipes, bakeSettings);
  return {
    id: order.id,
    customer: order.companyName?.trim() || order.contactName,
    deliveryDate: order.deliveryDate,
    total: roundMoney(total),
    supplyCost: roundMoney(food + electricity),
    summary: order.lineItems.map((line) => `${line.quantity}× ${line.name}`).join(", "),
    canceled: order.orderStatus === "CANCELED",
  };
}

function historyView(
  order: HistoricalCorporateOrder,
  matrix: RecipeMatrixItem[],
  priceFor: (label: string) => number,
  recipes: EditableRecipe[],
  bakeSettings: BakeSettings,
): AccountOrderView {
  const food = supplyForLines(order.lineItems, matrix, priceFor);
  const electricity = orderElectricityCost(order.lineItems, recipes, bakeSettings);
  return {
    id: order.id,
    customer: order.companyName,
    deliveryDate: order.deliveryDate,
    total: roundMoney(historicalOrderTotal(order)),
    supplyCost: roundMoney(food + electricity),
    summary: order.lineItems.map((line) => `${line.quantity}× ${line.name}`).join(", "),
    canceled: false,
  };
}

export function summariseAccounts(
  live: UnifiedOrder[],
  historical: HistoricalCorporateOrder[],
  catalog: MenuItem[],
  from: string,
  to: string,
  matrix: RecipeMatrixItem[],
  catalogue: CatalogueItem[],
  recipes: EditableRecipe[],
  bakeSettings: BakeSettings,
): { summary: RangeSummary; rows: AccountOrderView[] } {
  const priceFor = (label: string) => cataloguePrice(catalogue, label);
  const liveRows = live
    .filter((order) => inRange(order.deliveryDate, from, to))
    .map((order) => liveView(order, catalog, matrix, priceFor, recipes, bakeSettings));
  const pastRows = historical
    .filter((order) => inRange(order.deliveryDate, from, to))
    .map((order) => historyView(order, matrix, priceFor, recipes, bakeSettings));
  const rows = [...liveRows, ...pastRows].sort(
    (a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || a.customer.localeCompare(b.customer, "en-GB"),
  );
  const active = rows.filter((row) => !row.canceled);
  const gross = Math.round(active.reduce((sum, row) => sum + row.total, 0) * 100) / 100;
  const liveInRange = live.filter((order) => order.orderStatus !== "CANCELED" && inRange(order.deliveryDate, from, to));
  const pastInRange = historical.filter((order) => inRange(order.deliveryDate, from, to));
  const shop = morrisonsFor([...liveInRange, ...pastInRange], matrix, priceFor);
  const costPercent = gross > 0 ? Math.round((shop.total / gross) * 1000) / 10 : null;
  return {
    summary: {
      orderCount: active.length,
      gross,
      morrisons: shop.total,
      packCount: shop.packs,
      costPercent,
      margin: Math.round((gross - shop.total) * 100) / 100,
    },
    rows: active,
  };
}

export function customersIn(rows: AccountOrderView[]): string[] {
  return [...new Set(rows.map((row) => row.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en-GB"));
}

export function customerProfits(rows: AccountOrderView[]): CustomerProfit[] {
  const grouped = new Map<string, AccountOrderView[]>();
  for (const row of rows) {
    const current = grouped.get(row.customer) ?? [];
    current.push(row);
    grouped.set(row.customer, current);
  }
  return [...grouped.entries()].map(([customer, orders]) => {
    const gross = roundMoney(orders.reduce((sum, order) => sum + order.total, 0));
    const supplyCost = roundMoney(orders.reduce((sum, order) => sum + order.supplyCost, 0));
    const profit = roundMoney(gross - supplyCost);
    const margin = gross > 0 ? Math.round(((gross - supplyCost) / gross) * 1000) / 10 : 0;
    return { customer, orders: orders.length, gross, supplyCost, profit, margin };
  });
}

export function ordersForCustomer(rows: AccountOrderView[], query: string): AccountOrderView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const exact = rows.filter((row) => row.customer.toLowerCase() === needle);
  if (exact.length > 0) return exact;
  return rows.filter((row) => row.customer.toLowerCase().includes(needle));
}
