"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { ClipboardCopy, LogOut, Minus, Plus, Printer, Search, X } from "lucide-react";
import BusinessOverviewPanel from "./business-overview-panel";
import { WarningsPanel } from "./warnings-panel";
import CorporateAccountsPanel from "./corporate-accounts-panel";
import CupsDirectBoxes from "./cups-direct-boxes";
import MenuItemsPanel from "./menu-items-panel";
import OverheadsPanel from "./overheads-panel";
import StockAmend from "./stock-amend";
import SupplierAdmin from "./supplier-admin";
import {
  openPortalSession,
  packPriceFor,
  SARAH_SCONE_NAME,
  SARAH_SCONE_PASSWORD,
  type PortalSession,
} from "@/lib/corporate-accounts";
import {
  historicalOrderTotal,
  LOCAL_PORTAL_PASSWORD,
  LOCAL_PORTAL_USERNAME,
  pastOrdersFor,
  buildMenuTiers,
  recentPastOrders,
  type MenuTierOption,
  type CorporateAccount,
  type HistoricalCorporateOrder,
  type HistoricalOrderLine,
  type SuggestedLine,
} from "@/lib/corporate-portal";
import {
  cataloguePrice,
  DEFAULT_BAKE_SETTINGS,
  formatBakeOffset,
  recipeLabourUnitCost,
  recipesToMatrix,
  settleDayProfit,
  stockDrawForOrder,
  seedCatalogue,
  seedRecipes,
  TRAYS_BOTH_OVENS,
  TRAYS_PER_OVEN,
  type BakeSettings,
  type CatalogueItem,
  type EditableRecipe,
  type OrderOvenPlan,
  type OvenRun,
} from "@/lib/costing";
import { mergeMorrisonsCatalogue } from "@/lib/morrisons-import";
import { extractPostcode, fuelCostForMiles, orderSizeLabel, planDeliveryDays, tightSlotClashes, tightSlotMessage, type RouteOrder } from "@/lib/delivery-route";
import { applyCatalogueCosts, getDeskEdits, mergeSavedRecipes, updateDeskEdits, useDeskEdits } from "@/lib/desk-persistence";
import { isMorrisonsProductUrl, resolveMorrisonsUrl } from "@/lib/morrisons-url";
import { useMenuTemplates } from "@/lib/menu-templates";
import { addIsoDays, londonTodayIso } from "@/lib/uk-date";
import type { WixSnapshotCoverage } from "@/lib/load-wix-bookings";
import type { WixMenuCatalog } from "@/lib/wix-menu-sync";
import {
  INITIAL_ORDERS,
  MENU_SECTIONS,
  MOCK_CATALOG,
  type DietaryTag,
  type MenuItem,
  type RecipeMatrixItem,
  type UnifiedOrder,
} from "@/lib/mock-data";
import {
  buildWixCreateOrderPayload,
  dispatchMockWixOrder,
  getMockWixDispatchQuota,
  mergeBookedOrders,
  MOCK_WIX_DISPATCH_LIMIT,
  WIX_SCHEDULE_FROM,
  WIX_SCHEDULE_UNTIL,
  type WixOrderPayload,
} from "@/lib/wix-orders";

type TabId = "portal" | "schedule" | "warnings" | "ingredients" | "trolley" | "accounts" | "supplies" | "menu" | "overheads" | "overview";
type PrintTarget = "all" | "kitchen" | "delivery";

interface DraftLine {
  key: string;
  catalogItemId: string;
  name: string;
  imageUrl?: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Record<string, string>;
  specialInstructions?: string;
}

interface ModalDraft {
  variant: string;
  modifiers: Record<string, string>;
  quantity: number;
  note: string;
}

interface IngredientRow {
  ingredient: string;
  unit: string;
  rawAmount: number;
  packSize: number;
  packLabel: string;
  url: string;
  packPrice: number;
  packs: number;
}

interface ShoppingListItem {
  name: string;
  morrisonsUrl: string;
  required: number;
  requiredUnit: string;
  inStock: number;
  netToBuy: number;
  trolleyPacks: number;
}

interface StockedIngredientRow extends IngredientRow {
  key: string;
  inStock: number;
  netAmount: number;
  netPacks: number;
}

interface PrepRow {
  key: string;
  name: string;
  variant: string;
  modifiers: string;
  quantity: number;
  orderIds: string[];
}

interface CorporateForm {
  fulfillment: "DELIVERY" | "COLLECTION";
  companyName: string;
  poReference: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryDate: string;
  deliveryWindow: string;
  addressLine: string;
  postcode: string;
  dietaryNotes: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "portal", label: "Corporate Order Portal" },
  { id: "schedule", label: "Master Schedule & Printout" },
  { id: "warnings", label: "Warnings" },
  { id: "ingredients", label: "Ingredient & Pack Calculator" },
  { id: "trolley", label: "Morrisons Trolley Export" },
  { id: "accounts", label: "Corporate accounts" },
  { id: "supplies", label: "Morrisons & Supplies" },
  { id: "menu", label: "Website Menu Items" },
  { id: "overheads", label: "Overheads & Variable Costs" },
  { id: "overview", label: "Business Overview" },
];

const DELIVERY_WINDOWS = [
  "09:00 - 09:30",
  "10:30 - 11:00",
  "12:00 - 12:30",
  "14:00 - 14:30",
  "16:00 - 16:30",
];

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

const DEFAULT_DATE = INITIAL_ORDERS[0]?.deliveryDate ?? "2026-11-26";

function bakeWaves(runs: OvenRun[]): OvenRun[][] {
  const waves: OvenRun[][] = [];
  for (const run of runs) {
    const last = waves[waves.length - 1];
    if (!last || last[0]?.wave !== run.wave) waves.push([run]);
    else last.push(run);
  }
  return waves;
}

function BakeTimeline({ plan }: { plan: OrderOvenPlan }) {
  if (plan.runs.length === 0) {
    return <p className="text-sm text-[#5c5146]">No oven items, so electricity is £0.00.</p>;
  }
  return (
    <div className="space-y-3">
      {bakeWaves(plan.runs).map((wave) => (
        <div key={wave[0]?.key ?? "wave"}>
          <p className="text-sm font-semibold">{`Wave ${wave[0]?.wave} · ovens on together from ${formatBakeOffset(wave[0]?.startMinute ?? 0)}`}</p>
          <ul className="mt-1 space-y-2">
            {wave.map((run) => (
              <li key={run.key} className="rounded-md border border-[#eadfce] bg-[#fffaf3] px-3 py-2 text-sm leading-6">
                <p className="font-medium">{`Oven ${run.ovenIndex} of ${run.ovenCount} · ${run.groupLabel} · ${run.temperatureC}°C · ${run.trays} of ${TRAYS_PER_OVEN} trays · ${formatBakeOffset(run.startMinute)} to ${formatBakeOffset(run.endMinute)}`}</p>
                <ul className="mt-1 space-y-1">
                  {run.stages.map((stage) => (
                    <li key={`${run.key}-${stage.key}`}>
                      <p>{`${stage.label} · ${stage.minutes} minutes · ${stage.items.map((item) => `${item.name} × ${item.trays} tray${item.trays === 1 ? "" : "s"}`).join(", ")} · ${stage.allocation === "split" ? "electricity split" : "electricity in full"} ${gbp(stage.electricityCost)}`}</p>
                      <p className="text-[#5c5146]">{stage.explanation}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-sm text-[#5c5146]">
        {`${plan.trays} trays, ${plan.ovenStarts} oven start${plan.ovenStarts === 1 ? "" : "s"}. Electricity ${gbp(plan.electricityCost)}. Full ${plan.fullDrawElectricityCost === plan.electricityCost ? "draw matches that figure" : `draw is ${gbp(plan.fullDrawElectricityCost)}`}. One oven holds ${TRAYS_PER_OVEN} trays and both ovens hold ${TRAYS_BOTH_OVENS}.`}
      </p>
    </div>
  );
}

function bookingCoverage(booked: UnifiedOrder[], anchor: string, until: string): { start: string; end: string } {
  const dates = booked
    .map((order) => order.deliveryDate)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= until)
    .sort();
  if (dates.length === 0) return { start: anchor, end: anchor };
  const start = dates[0] < anchor ? dates[0] : anchor;
  const last = dates[dates.length - 1];
  return { start, end: last > anchor ? last : anchor };
}

function isCanceledOrder(order: UnifiedOrder): boolean {
  return order.orderStatus === "CANCELED";
}

function bookingDates(orders: UnifiedOrder[], includeCanceled: boolean): string[] {
  return [
    ...new Set(
      orders
        .filter((order) => includeCanceled || !isCanceledOrder(order))
        .map((order) => order.deliveryDate),
    ),
  ]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
}

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#7d3044] px-4 py-2 text-sm font-semibold text-white hover:bg-[#682736] disabled:cursor-not-allowed disabled:bg-[#c9b2b8]";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef]";

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function formatNumber(amount: number): string {
  const rounded = Math.round(amount * 1000) / 1000;
  const [whole, fraction] = rounded.toString().split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${withCommas}.${fraction}` : withCommas;
}

function unitWord(amount: number, unit: string): string {
  if (amount === 1 && unit === "loaves") return "loaf";
  if (amount === 1 && unit === "units") return "unit";
  return unit;
}

function weekdayIndex(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (
    (adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      offsets[month - 1] +
      day) %
    7
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${WEEKDAYS[weekdayIndex(year, month, day)]} ${day} ${MONTHS[month - 1]} ${year}`;
}

function widenDate(current: string, date: string, edge: "start" | "end"): string {
  if (!current) return date;
  if (edge === "start") return current > date ? date : current;
  return current < date ? date : current;
}

function rememberUkRange(): () => void {
  return () => {};
}

let cachedUkRange = "";

function readUkRange(): string {
  if (!cachedUkRange) {
    const today = londonTodayIso();
    cachedUkRange = `${today}|${addIsoDays(today, 3)}`;
  }
  return cachedUkRange;
}

function readUkRangeOnServer(): string {
  return "";
}

function appliedRangeNote(preset: null | "today" | "next4"): string {
  if (preset === "today") return " Today is both the start and the end.";
  if (preset === "next4") return " Next 4 days: today through today + 3 days, 4 days inclusive.";
  return "";
}

function inclusiveDayCount(start: string, end: string): number {
  if (start > end) return 0;
  let count = 1;
  let cursor = start;
  while (cursor < end && count < 400) {
    cursor = addIsoDays(cursor, 1);
    count += 1;
  }
  return count;
}

function peoplePerUnit(text: string): number {
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:people|guests)/i);
  if (range) return Number(range[2]);
  const exact = text.match(/(\d+)\s*(?:people|guests)/i);
  if (exact) return Number(exact[1]);
  return 0;
}

function orderItemCount(order: UnifiedOrder): number {
  return order.lineItems.reduce((sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0), 0);
}

function orderGuestCount(order: UnifiedOrder): number {
  return order.lineItems.reduce((sum, line) => sum + peoplePerUnit(`${line.variant ?? ""} ${line.name}`) * line.quantity, 0);
}

function windowStart(value: string): number {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function defaultModifiers(item: MenuItem): Record<string, string> {
  const modifiers: Record<string, string> = {};
  for (const group of item.modifierGroups ?? []) {
    if (group.options[0]) modifiers[group.name] = group.options[0];
  }
  return modifiers;
}

function startingPrice(item: MenuItem): number {
  return Math.min(...item.priceVariants.map((variant) => variant.price));
}

function priceLabel(item: MenuItem): string {
  const min = startingPrice(item);
  const max = Math.max(...item.priceVariants.map((variant) => variant.price));
  return min === max ? gbp(min) : `From ${gbp(min)}`;
}

function needsCustomize(item: MenuItem): boolean {
  return item.priceVariants.length > 1 || (item.modifierGroups?.length ?? 0) > 0;
}

function builtInImage(id: string): string | undefined {
  const image = MOCK_CATALOG.find((item) => item.id === id)?.imageUrl;
  return image?.startsWith("/images/") ? image : undefined;
}

function modifierText(modifiers: Record<string, string> | undefined): string {
  const text = Object.entries(modifiers ?? {})
    .sort(([a], [b]) => a.localeCompare(b, "en-GB"))
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
  return text || "None";
}

function aggregatePrep(orders: UnifiedOrder[]): PrepRow[] {
  const rows = new Map<string, PrepRow>();
  for (const order of orders) {
    for (const line of order.lineItems) {
      const note = line.specialInstructions?.trim();
      const baseModifiers = modifierText(line.modifiers);
      const modifiers = note
        ? baseModifiers === "None"
          ? `Note: ${note}`
          : `${baseModifiers} · Note: ${note}`
        : baseModifiers;
      const variant = line.variant ?? "Standard";
      const key = `${line.catalogItemId}|${variant}|${modifiers}`;
      const existing = rows.get(key);
      if (existing) {
        existing.quantity += line.quantity;
        if (!existing.orderIds.includes(order.id)) existing.orderIds.push(order.id);
      } else {
        rows.set(key, {
          key,
          name: line.name,
          variant,
          modifiers,
          quantity: line.quantity,
          orderIds: [order.id],
        });
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "en-GB") || a.variant.localeCompare(b.variant, "en-GB"),
  );
}

function aggregateIngredients(
  orders: UnifiedOrder[],
  matrix: RecipeMatrixItem[],
  catalogue: CatalogueItem[],
): {
  rows: IngredientRow[];
  uncovered: Array<{ name: string; quantity: number }>;
  sandwiches: number;
} {
  const totals = new Map<string, Omit<IngredientRow, "packs">>();
  const uncovered = new Map<string, number>();
  let sandwiches = 0;

  for (const order of orders) {
    for (const line of order.lineItems) {
      const recipe =
        matrix.find((entry) => entry.itemId === line.catalogItemId) ??
        matrix.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase());
      if (!recipe) {
        uncovered.set(line.name, (uncovered.get(line.name) ?? 0) + line.quantity);
        continue;
      }
      if (recipe.sandwichesPerUnit) sandwiches += recipe.sandwichesPerUnit * line.quantity;
      for (const ingredient of recipe.ingredients) {
        const key = `${ingredient.name}|${ingredient.packLabel}|${ingredient.morrisonsUrl}`;
        const existing = totals.get(key);
        const rawAmount = ingredient.amountPerUnit * line.quantity;
        if (existing) existing.rawAmount += rawAmount;
        else {
          totals.set(key, {
            ingredient: ingredient.name,
            unit: ingredient.unit,
            rawAmount,
            packSize: ingredient.packSize,
            packLabel: ingredient.packLabel,
            url: ingredient.morrisonsUrl,
            packPrice: cataloguePrice(catalogue, ingredient.packLabel),
          });
        }
      }
    }
  }

  const rows = [...totals.values()]
    .map((row) => {
      const rawAmount = Math.round(row.rawAmount * 1000) / 1000;
      const packs = rawAmount <= 0 ? 0 : Math.ceil(rawAmount / row.packSize - 1e-9);
      return { ...row, rawAmount, packs };
    })
    .sort((a, b) => a.ingredient.localeCompare(b.ingredient, "en-GB"));

  const missing = [...uncovered.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  return { rows, uncovered: missing, sandwiches };
}

function stockKey(row: { ingredient: string; packLabel: string }): string {
  return `${row.ingredient}|${row.packLabel}`;
}

function applyStock(rows: IngredientRow[], stock: Record<string, number>): StockedIngredientRow[] {
  return rows.map((row) => {
    const inStock = Math.max(0, stock[stockKey(row)] ?? 0);
    const netAmount = Math.max(0, Math.round((row.rawAmount - inStock) * 1000) / 1000);
    const netPacks = netAmount <= 0 ? 0 : Math.ceil(netAmount / row.packSize - 1e-9);
    return { ...row, key: stockKey(row), inStock, netAmount, netPacks };
  });
}

function toShoppingList(rows: StockedIngredientRow[]): ShoppingListItem[] {
  return rows
    .filter((row) => row.url.startsWith("http"))
    .map((row) => ({
      name: row.ingredient,
      morrisonsUrl: resolveMorrisonsUrl(row.url, row.ingredient),
      required: row.rawAmount,
      requiredUnit: row.unit,
      inStock: row.inStock,
      netToBuy: row.netAmount,
      trolleyPacks: row.netPacks,
    }));
}

function trolleyProgressKey(item: ShoppingListItem): string {
  return `${item.name}|${item.morrisonsUrl}`;
}

function toRouteOrder(order: UnifiedOrder): RouteOrder {
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

function SourceBadge({ source }: { source: UnifiedOrder["source"] }) {
  if (source === "WIX_BOOKING") {
    return (
      <span className="inline-flex rounded-full bg-[#f3e4ea] px-2.5 py-1 text-xs font-bold tracking-wide text-[#7d3044]">
        Wix booking
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#efe7dc] px-2.5 py-1 text-xs font-bold tracking-wide text-[#5c5146]">
      Local mock
    </span>
  );
}

function CancelBadge({ order }: { order: UnifiedOrder }) {
  if (!isCanceledOrder(order)) return null;
  return (
    <span className="inline-flex rounded-full bg-[#f8d7da] px-2.5 py-1 text-xs font-bold tracking-wide text-[#8a2b2b]">
      CANCELED — do not prep
    </span>
  );
}

function PaymentBadge({ status }: { status: UnifiedOrder["paymentStatus"] }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex rounded-full bg-[#e5f4ea] px-2.5 py-1 text-xs font-bold tracking-wide text-[#1f6b45]">
        PAID
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#fff1d6] px-2.5 py-1 text-xs font-bold tracking-wide text-[#8a4b12]">
      INVOICE PENDING
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#3d342b]">{label}</span>
      {children}
    </label>
  );
}

function ImagePlaceholder({ className }: { className: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-[#f3e6d4] text-[#7d3044] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="h-1/2 max-h-14 w-1/2 max-w-14" fill="none">
        <circle cx="32" cy="38" r="16" fill="#e7c27a" />
        <path d="M22 34c3-8 17-8 20 0" stroke="#fffaf3" strokeWidth="3" strokeLinecap="round" />
        <circle cx="46" cy="20" r="7" fill="#7d3044" />
      </svg>
    </div>
  );
}

function FoodImage({ src, fallbackSrc, className }: { src?: string; fallbackSrc?: string; className: string }) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  if (!current || failed) return <ImagePlaceholder className={className} />;
  return (
    // Plain img so a missing public file can fall back without a broken icon.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt=""
      className={`bg-[#f6ead8] object-cover ${className}`}
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) {
          setCurrent(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function BrandLogo({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Scone Tea Party"
      className="h-16 w-16 shrink-0 rounded-full bg-[#fffaf3] object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function SnapshotBadge({
  status,
}: {
  status: {
    state: "missing" | "unreadable" | "loaded";
    pulledAt?: string;
    rawOrderCount: number;
    openCount: number;
    canceledCount: number;
  };
}) {
  if (status.state === "loaded") {
    const pulled = status.pulledAt ? formatDate(status.pulledAt.slice(0, 10)) : "an unknown time";
    return (
      <p className="inline-flex rounded-full bg-[#e5f4ea] px-3 py-1 text-xs font-semibold text-[#1f6b45]" role="status">
        Snapshot loaded · {status.rawOrderCount} Wix orders on file · {status.openCount} open through 27 Dec
        {status.canceledCount > 0 ? ` · ${status.canceledCount} canceled` : ""} · pulled {pulled}
      </p>
    );
  }
  if (status.state === "unreadable") {
    return (
      <p className="inline-flex rounded-full bg-[#fff1ef] px-3 py-1 text-xs font-semibold text-[#8a2b24]" role="status">
        Snapshot file could not be read. The schedule is showing local sample orders.
      </p>
    );
  }
  return (
    <p className="inline-flex rounded-full bg-[#fff1d6] px-3 py-1 text-xs font-semibold text-[#8a4b12]" role="status">
      Snapshot not pulled yet. data/wix-snapshot.json is not on this machine, so only local sample orders are on the
      schedule.
    </p>
  );
}

function DietaryBadges({ tags }: { tags?: DietaryTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
            tag === "GF" ? "bg-[#fff1d6] text-[#8a4b12]" : "bg-[#e5f4ea] text-[#1f6b45]"
          }`}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

export default function OpsDesk({
  catalog,
  catalogSource,
  brandLogo,
  bookedOrders = [],
  snapshotStatus = { state: "missing", rawOrderCount: 0, openCount: 0, canceledCount: 0 },
  snapshotCoverage = {
    state: "missing",
    rawOrderCount: 0,
    unfulfilledCount: 0,
    fulfilledCount: 0,
    canceledCount: 0,
    createdFrom: "",
    createdUntil: "",
    slotFrom: "",
    slotUntil: "",
    statedTotal: 0,
    fulfilledFromApril: 0,
    linesMissingPrice: 0,
  },
  corporateAccounts,
  historicalOrders,
  scheduleUntil = WIX_SCHEDULE_UNTIL,
  importedMorrisons = [],
  menuCatalog,
}: {
  catalog: MenuItem[];
  catalogSource: "snapshot" | "mock" | "menu";
  brandLogo?: string;
  bookedOrders?: UnifiedOrder[];
  snapshotStatus?: {
    state: "missing" | "unreadable" | "loaded";
    pulledAt?: string;
    rawOrderCount: number;
    openCount: number;
    canceledCount: number;
  };
  snapshotCoverage?: WixSnapshotCoverage;
  corporateAccounts: CorporateAccount[];
  historicalOrders: HistoricalCorporateOrder[];
  scheduleUntil?: string;
  importedMorrisons?: CatalogueItem[];
  menuCatalog: WixMenuCatalog;
}) {
  const [tab, setTab] = useState<TabId>("portal");
  const desk = useDeskEdits();
  const seededCatalogue = useMemo(
    () => mergeMorrisonsCatalogue(seedCatalogue(packPriceFor), importedMorrisons),
    [importedMorrisons],
  );
  const seededRecipes = useMemo(() => seedRecipes(), []);
  const catalogue = useMemo(
    () => applyCatalogueCosts(seededCatalogue, desk.catalogueCosts),
    [desk.catalogueCosts, seededCatalogue],
  );
  const editableRecipes = useMemo(
    () => mergeSavedRecipes(seededRecipes, desk.recipes),
    [desk.recipes, seededRecipes],
  );
  const stockOnHand = desk.stock;
  const setCatalogue: Dispatch<SetStateAction<CatalogueItem[]>> = (action) => {
    const current = applyCatalogueCosts(seededCatalogue, getDeskEdits().catalogueCosts);
    const next = typeof action === "function" ? action(current) : action;
    const costs: Record<string, number> = {};
    for (const item of next) {
      const seed = seededCatalogue.find((entry) => entry.id === item.id);
      if (!seed || Math.abs(seed.cost - item.cost) > 0.0001) costs[item.id] = item.cost;
    }
    updateDeskEdits((edits) => ({ ...edits, catalogueCosts: costs }));
  };
  const setEditableRecipes: Dispatch<SetStateAction<EditableRecipe[]>> = (action) => {
    const current = mergeSavedRecipes(seededRecipes, getDeskEdits().recipes);
    const next = typeof action === "function" ? action(current) : action;
    updateDeskEdits((edits) => ({ ...edits, recipes: next }));
  };
  const setStockOnHand: Dispatch<SetStateAction<Record<string, number>>> = (action) => {
    const current = getDeskEdits().stock;
    const next = typeof action === "function" ? action(current) : action;
    updateDeskEdits((edits) => ({ ...edits, stock: next }));
  };
  const [bakeSettings, setBakeSettings] = useState<BakeSettings>(DEFAULT_BAKE_SETTINGS);
  const [orders, setOrders] = useState<UnifiedOrder[]>(() => mergeBookedOrders(INITIAL_ORDERS, bookedOrders));
  const coverage = bookingCoverage(bookedOrders, DEFAULT_DATE, scheduleUntil);
  const [form, setForm] = useState<CorporateForm>({
    fulfillment: "DELIVERY",
    companyName: "",
    poReference: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    deliveryDate: DEFAULT_DATE,
    deliveryWindow: "12:00 - 12:30",
    addressLine: "",
    postcode: "",
    dietaryNotes: "",
  });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [sectionFilter, setSectionFilter] = useState("All");
  const [menuQuery, setMenuQuery] = useState("");
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalDraft, setModalDraft] = useState<ModalDraft>({
    variant: "",
    modifiers: {},
    quantity: 1,
    note: "",
  });
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loginCompany, setLoginCompany] = useState<string>(corporateAccounts[0]?.companyName ?? "Biocomposits");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState("");
  const [adminLogin, setAdminLogin] = useState(false);
  const [guestCount, setGuestCount] = useState(20);
  const menuTemplates = useMenuTemplates();
  const [quota, setQuota] = useState({
    used: 0,
    remaining: MOCK_WIX_DISPATCH_LIMIT,
    limit: MOCK_WIX_DISPATCH_LIMIT,
  });
  const initialStart = coverage.start < WIX_SCHEDULE_FROM ? coverage.start : WIX_SCHEDULE_FROM;
  const initialEnd = coverage.end > scheduleUntil ? coverage.end : scheduleUntil;
  const seededRange = useSyncExternalStore(rememberUkRange, readUkRange, readUkRangeOnServer);
  const seededStart = seededRange.split("|")[0] ?? "";
  const seededEnd = seededRange.split("|")[1] ?? "";
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [draftEnd, setDraftEnd] = useState<string | null>(null);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const [chosenEnd, setChosenEnd] = useState<string | null>(null);
  const [draftPreset, setDraftPreset] = useState<null | "today" | "next4">(null);
  const [chosenPreset, setChosenPreset] = useState<null | "today" | "next4">(null);
  const [draftTouched, setDraftTouched] = useState(false);
  const [appliedTouched, setAppliedTouched] = useState(false);
  const rangeStart = draftTouched ? (draftStart ?? "") : seededStart;
  const rangeEnd = draftTouched ? (draftEnd ?? "") : seededEnd;
  const appliedStart = appliedTouched ? (chosenStart ?? "") : seededStart;
  const appliedEnd = appliedTouched ? (chosenEnd ?? "") : seededEnd;
  const datesReady = Boolean(seededStart);
  const shownDraftPreset = draftTouched ? draftPreset : seededStart ? "next4" : null;
  const appliedPreset = appliedTouched ? chosenPreset : seededStart ? "next4" : null;
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);
  const [showOutsideDates, setShowOutsideDates] = useState(false);
  const [routeNotes, setRouteNotes] = useState<{ key: string; notes: Record<string, string> }>({ key: "", notes: {} });
  const [copied, setCopied] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [copyError, setCopyError] = useState("");
  const [showStockAmend, setShowStockAmend] = useState(false);
  const [supplySearch, setSupplySearch] = useState("");
  const [websiteCatalog, setWebsiteCatalog] = useState(menuCatalog);
  const [trolleyAdded, setTrolleyAdded] = useState<Record<string, boolean>>({});
  const submitting = useRef(false);
  const routeTicket = useRef(0);

  useEffect(() => {
    document.body.dataset.print = "all";
    const reset = () => {
      document.body.dataset.print = "all";
    };
    window.addEventListener("afterprint", reset);
    return () => {
      window.removeEventListener("afterprint", reset);
      delete document.body.dataset.print;
    };
  }, []);

  useEffect(() => {
    if (!modalItem) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalItem]);

  const menuSections = useMemo(() => {
    const present = new Set(catalog.map((item) => item.category));
    const known = MENU_SECTIONS.filter((section) => present.has(section));
    const extra = [...present].filter((section) => !known.includes(section as (typeof MENU_SECTIONS)[number]));
    return [...known, ...extra];
  }, [catalog]);

  const visibleItems = useMemo(() => {
    const query = menuQuery.trim().toLowerCase();
    return catalog.filter((item) => {
      if (sectionFilter !== "All" && item.category !== sectionFilter) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.description ?? ""} ${(item.dietaryTags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [catalog, menuQuery, sectionFilter]);

  const groupedMenu = useMemo(
    () => menuSections.map((section) => ({ section, items: visibleItems.filter((item) => item.category === section) })).filter((group) => group.items.length > 0),
    [menuSections, visibleItems],
  );

  const modalVariant =
    modalItem?.priceVariants.find((variant) => variant.option === modalDraft.variant) ?? modalItem?.priceVariants[0];
  const modalUnitPrice = modalVariant?.price ?? 0;
  const modalLineTotal = modalUnitPrice * Math.min(99, Math.max(1, Math.floor(modalDraft.quantity) || 1));

  const draftAddress =
    form.fulfillment === "COLLECTION"
      ? "Collection (Knutton)"
      : [form.addressLine.trim(), form.postcode.trim().toUpperCase()].filter(Boolean).join(", ");

  const draftOrder = useMemo<UnifiedOrder>(
    () => ({
      id: "PREVIEW",
      source: "CORPORATE_PORTAL",
      poReference: form.poReference.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      deliveryAddress: draftAddress,
      deliveryDate: form.deliveryDate,
      deliveryWindow: form.deliveryWindow.trim(),
      paymentStatus: "NOT_PAID",
      fulfillment: form.fulfillment,
      dietaryNotes: form.dietaryNotes.trim() || undefined,
      lineItems: lines.map((line) => ({
        catalogItemId: line.catalogItemId,
        name: line.name,
        variant: line.variant,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        modifiers: line.modifiers,
        specialInstructions: line.specialInstructions,
      })),
    }),
    [draftAddress, form, lines],
  );

  const payload: WixOrderPayload | null = useMemo(
    () => (draftOrder.lineItems.length > 0 ? buildWixCreateOrderPayload(draftOrder) : null),
    [draftOrder],
  );

  const scheduleOrders = useMemo(() => {
    if (!datesReady || !appliedStart || !appliedEnd || appliedStart > appliedEnd) return [];
    return orders
      .filter((order) => order.deliveryDate >= appliedStart && order.deliveryDate <= appliedEnd)
      .sort(
        (a, b) =>
          a.deliveryDate.localeCompare(b.deliveryDate) ||
          windowStart(a.deliveryWindow) - windowStart(b.deliveryWindow) ||
          a.contactName.localeCompare(b.contactName, "en-GB"),
      );
  }, [appliedEnd, appliedStart, datesReady, orders]);
  const prepOrders = useMemo(() => scheduleOrders.filter((order) => !isCanceledOrder(order)), [scheduleOrders]);
  const canceledInView = scheduleOrders.length - prepOrders.length;
  const tableOrders = showCanceled ? scheduleOrders : prepOrders;
  const bookingChips = useMemo(() => {
    if (!datesReady || !appliedStart || !appliedEnd || appliedStart > appliedEnd) {
      return { inRange: [] as string[], outside: [] as string[] };
    }
    const inRange: string[] = [];
    const outside: string[] = [];
    for (const date of bookingDates(orders, showCanceled)) {
      if (date >= appliedStart && date <= appliedEnd) inRange.push(date);
      else outside.push(date);
    }
    return { inRange, outside };
  }, [appliedEnd, appliedStart, datesReady, orders, showCanceled]);
  const tableItemCount = tableOrders.reduce((sum, order) => sum + orderItemCount(order), 0);
  const tableGuestCount = tableOrders.reduce((sum, order) => sum + orderGuestCount(order), 0);
  const dayPlans = useMemo(() => planDeliveryDays(prepOrders.map(toRouteOrder)), [prepOrders]);
  const slotClashes = useMemo(
    () => tightSlotClashes(orders.filter((order) => !isCanceledOrder(order)).map(toRouteOrder)),
    [orders],
  );
  const routeKey = prepOrders.map((order) => `${order.id}:${order.deliveryWindow}:${order.deliveryAddress}`).join("|");

  useEffect(() => {
    const ticket = routeTicket.current + 1;
    routeTicket.current = ticket;
    const controller = new AbortController();
    const orders = prepOrders.map((order) => ({
      id: order.id,
      contactName: order.contactName,
      companyName: order.companyName,
      deliveryAddress: order.deliveryAddress,
      deliveryDate: order.deliveryDate,
      deliveryWindow: order.deliveryWindow,
      fulfillment: order.fulfillment,
    }));
    fetch("/api/delivery-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { source?: string; days?: Array<{ date?: string; summary?: string }> } | null) => {
        if (ticket !== routeTicket.current || !payload || payload.source !== "llm" || !Array.isArray(payload.days)) return;
        const notes: Record<string, string> = {};
        for (const day of payload.days) {
          if (day && typeof day.date === "string" && typeof day.summary === "string") notes[day.date] = day.summary;
        }
        setRouteNotes({ key: routeKey, notes });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [prepOrders, routeKey]);

  const prepRows = useMemo(() => aggregatePrep(prepOrders), [prepOrders]);
  const bakeDays = useMemo(() => {
    if (!datesReady) return [];
    const dates = [...new Set(prepOrders.map((order) => order.deliveryDate))].sort();
    return dates.map((date) => {
      const dayOrders = prepOrders.filter((order) => order.deliveryDate === date);
      const lines = dayOrders.flatMap((order) =>
        order.lineItems.map((line) => {
          const recipe =
            editableRecipes.find((entry) => line.catalogItemId && entry.itemId === line.catalogItemId) ??
            editableRecipes.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase());
          const catalogItem = websiteCatalog.items.find((item) => item.name.trim().toLowerCase() === line.name.trim().toLowerCase());
          const unitSale = recipe?.salePriceOverride ?? (line.unitPrice > 0 ? line.unitPrice : (catalogItem?.price ?? 0));
          return {
            orderId: order.id,
            name: line.name,
            catalogItemId: line.catalogItemId,
            quantity: line.quantity,
            unitSale,
          };
        }),
      );
      const settled = settleDayProfit(lines, editableRecipes, catalogue, bakeSettings);
      const labourCost =
        Math.round(
          lines.reduce((sum, line) => {
            const recipe =
              editableRecipes.find((entry) => line.catalogItemId && entry.itemId === line.catalogItemId) ??
              editableRecipes.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase());
            return sum + (recipe ? recipeLabourUnitCost(recipe) * line.quantity : 0);
          }, 0) * 100,
        ) / 100;
      const fuelCost = fuelCostForMiles(dayPlans.find((plan) => plan.date === date)?.bookedMiles ?? 0);
      const direct = Math.round((settled.foodCost + settled.electricityCost + fuelCost) * 100) / 100;
      const profit = Math.round((settled.salePrice - direct) * 100) / 100;
      const marginPercent = settled.salePrice > 0 ? Math.round((profit / settled.salePrice) * 1000) / 10 : 0;
      const net = Math.round((settled.salePrice / 1.2) * 100) / 100;
      return {
        date,
        orderCount: dayOrders.length,
        ...settled,
        labourCost,
        fuelCost,
        profit,
        marginPercent,
        registeredProfit: Math.round((net - direct) * 100) / 100,
      };
    });
  }, [bakeSettings, catalogue, datesReady, dayPlans, editableRecipes, prepOrders, websiteCatalog.items]);

  const toggleOrderComplete = (order: UnifiedOrder) => {
    if (isCanceledOrder(order)) return;
    const draw = stockDrawForOrder(order, editableRecipes, catalogue);
    updateDeskEdits((edits) => {
      const done = Boolean(edits.completed[order.id]);
      const stock = { ...edits.stock };
      for (const [key, amount] of Object.entries(draw)) {
        stock[key] = Math.round(((stock[key] ?? 0) + (done ? amount : -amount)) * 1000) / 1000;
      }
      const completed = { ...edits.completed };
      if (done) delete completed[order.id];
      else completed[order.id] = true;
      return { ...edits, stock, completed };
    });
  };

  const draftInvalid = Boolean(rangeStart && rangeEnd && rangeStart > rangeEnd);
  const pendingRange = datesReady && (rangeStart !== appliedStart || rangeEnd !== appliedEnd);
  const rangeInvalid = Boolean(datesReady && appliedStart && appliedEnd && appliedStart > appliedEnd);
  const rangedOrders = useMemo(
    () => (rangeInvalid ? [] : prepOrders),
    [prepOrders, rangeInvalid],
  );
  const liveMatrix = useMemo(() => recipesToMatrix(editableRecipes, catalogue), [catalogue, editableRecipes]);
  const ingredientModel = useMemo(
    () => aggregateIngredients(rangedOrders, liveMatrix, catalogue),
    [catalogue, liveMatrix, rangedOrders],
  );
  const stockedRows = useMemo(
    () => applyStock(ingredientModel.rows, stockOnHand),
    [ingredientModel.rows, stockOnHand],
  );
  const requiredStock = useMemo(
    () => Object.fromEntries(stockedRows.map((row) => [row.key, row.rawAmount])),
    [stockedRows],
  );
  const visibleStockRows = useMemo(() => {
    const needle = supplySearch.trim().toLowerCase();
    if (!needle) return stockedRows;
    return stockedRows.filter((row) => `${row.ingredient} ${row.packLabel}`.toLowerCase().includes(needle));
  }, [stockedRows, supplySearch]);
  const shoppingList = useMemo(() => toShoppingList(stockedRows), [stockedRows]);
  const orderList = useMemo(
    () =>
      shoppingList
        .filter((item) => item.trolleyPacks > 0)
        .map((item) => ({
          name: item.name,
          trolleyPacks: item.trolleyPacks,
          netToBuy: item.netToBuy,
          unit: item.requiredUnit,
          morrisonsUrl: item.morrisonsUrl,
        })),
    [shoppingList],
  );
  const draftTotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const companyHistory = useMemo(
    () => (session?.companyName ? pastOrdersFor(session.companyName, historicalOrders) : []),
    [historicalOrders, session],
  );
  const recentHistory = useMemo(
    () => (session?.companyName ? recentPastOrders(session.companyName, historicalOrders) : []),
    [historicalOrders, session],
  );
  const menuTiers = useMemo(
    () => (session?.companyName ? buildMenuTiers(companyHistory, guestCount, catalog, menuTemplates) : null),
    [catalog, companyHistory, guestCount, menuTemplates, session],
  );
  const visibleTabs = session?.canAccessOpsTabs ? TABS : TABS.filter((item) => item.id === "portal");

  function draftFromHistory(item: HistoricalOrderLine | SuggestedLine, key: string): DraftLine {
    const catalogItem = catalog.find((entry) => entry.id === item.catalogItemId);
    return {
      key,
      catalogItemId: item.catalogItemId,
      name: catalogItem?.name ?? item.name,
      imageUrl: catalogItem?.imageUrl ?? item.imageUrl,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      modifiers: item.modifiers,
    };
  }

  function enterSession(next: PortalSession) {
    setSession(next);
    setLoginError("");
    setStaffError("");
    setLines([]);
    setNotice("");
    setFormError("");
    setTab("portal");
    setForm((current) => ({ ...current, companyName: next.companyName ?? "" }));
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = openPortalSession(corporateAccounts, loginCompany, loginUsername, loginPassword);
    if (!next) {
      setLoginError("That company, username, and password do not match a local account.");
      return;
    }
    enterSession(next);
  }

  function signInStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = openPortalSession(corporateAccounts, "", SARAH_SCONE_NAME, staffPassword);
    if (!next?.canAccessOpsTabs) {
      setStaffError("That password does not match Sarah Scone.");
      return;
    }
    enterSession(next);
  }

  function signOut() {
    setSession(null);
    setAdminLogin(false);
    setTab("portal");
    setLines([]);
    setNotice("");
    setFormError("");
    setForm((current) => ({ ...current, companyName: "" }));
  }

  function orderAgain(order: HistoricalCorporateOrder) {
    setLines(order.lineItems.map((item, index) => draftFromHistory(item, `${order.id}-${index}`)));
    setFormError("");
    setNotice(
      `Basket replaced with ${order.id} for ${order.headcount} people. Invoice Later is unchanged. Wix was not contacted.`,
    );
  }

  function addTier(tier: MenuTierOption) {
    if (!menuTiers || tier.lines.length === 0) return;
    setLines(tier.lines.map((item, index) => draftFromHistory(item, `tier-${tier.id}-${menuTiers.headcount}-${index}`)));
    setFormError("");
    setNotice(
      `Basket replaced with the ${tier.label} menu for ${menuTiers.headcount} people at ${gbp(tier.perPerson)} per person. Invoice Later is unchanged. Wix was not contacted.`,
    );
  }

  function keepDraftEnd(current: string | null): string {
    return current ?? seededEnd;
  }

  function keepDraftStart(current: string | null): string {
    return current ?? seededStart;
  }

  function showBookingDate(date: string) {
    setDraftTouched(true);
    setDraftPreset(null);
    setDraftStart(date);
    setDraftEnd(date);
  }

  function changeRangeStart(value: string) {
    setDraftTouched(true);
    setDraftPreset(null);
    setDraftStart(value);
    setDraftEnd(keepDraftEnd);
  }

  function changeRangeEnd(value: string) {
    setDraftTouched(true);
    setDraftPreset(null);
    setDraftEnd(value);
    setDraftStart(keepDraftStart);
  }

  function applyToday() {
    const today = londonTodayIso();
    setDraftTouched(true);
    setDraftPreset("today");
    setDraftStart(today);
    setDraftEnd(today);
  }

  function applyNextFourDays() {
    const today = londonTodayIso();
    setDraftTouched(true);
    setDraftPreset("next4");
    setDraftStart(today);
    setDraftEnd(addIsoDays(today, 3));
  }

  function commitRange() {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return;
    setAppliedTouched(true);
    setChosenStart(rangeStart);
    setChosenEnd(rangeEnd);
    setChosenPreset(shownDraftPreset);
    setShowOutsideDates(false);
  }

  function updateForm<K extends keyof CorporateForm>(key: K, value: CorporateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openItem(item: MenuItem) {
    setModalItem(item);
    setModalDraft({
      variant: item.priceVariants[0]?.option ?? "",
      modifiers: defaultModifiers(item),
      quantity: 1,
      note: "",
    });
  }

  function addModalItem() {
    if (!modalItem || !modalVariant) return;
    const quantity = Math.min(99, Math.max(1, Math.floor(modalDraft.quantity) || 1));
    const modifiers = { ...modalDraft.modifiers };
    const note = modalDraft.note.trim();
    setLines((current) => {
      const match = current.findIndex(
        (line) =>
          line.catalogItemId === modalItem.id &&
          line.variant === modalVariant.option &&
          modifierText(line.modifiers) === modifierText(modifiers) &&
          (line.specialInstructions ?? "") === note,
      );
      if (match >= 0) {
        const next = [...current];
        next[match] = { ...next[match], quantity: Math.min(99, next[match].quantity + quantity) };
        return next;
      }
      return [
        ...current,
        {
          key: `${modalItem.id}-${modalVariant.option}-${Date.now()}`,
          catalogItemId: modalItem.id,
          name: modalItem.name,
          imageUrl: modalItem.imageUrl,
          variant: modalVariant.option,
          quantity,
          unitPrice: modalVariant.price,
          modifiers,
          specialInstructions: note || undefined,
        },
      ];
    });
    setModalItem(null);
    setFormError("");
  }

  function setLineQuantity(key: string, quantity: number) {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        if (quantity < 1) return [];
        return [{ ...line, quantity: Math.min(99, quantity) }];
      }),
    );
  }

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim()) {
      setFormError("Company name, contact name, and accounts email are required.");
      return;
    }
    if (!form.contactEmail.includes("@")) {
      setFormError("Enter an accounts email that includes @.");
      return;
    }
    if (!form.contactPhone.trim() || !form.deliveryDate) {
      setFormError("Phone and a date are required.");
      return;
    }
    if (form.fulfillment === "DELIVERY" && (!form.addressLine.trim() || !form.postcode.trim())) {
      setFormError("Delivery needs an address and a postcode.");
      return;
    }
    if (!form.deliveryWindow.trim()) {
      setFormError(form.fulfillment === "COLLECTION" ? "Choose a collection time." : "Choose a delivery window.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Add at least one item before saving the order.");
      return;
    }
    if (quota.remaining <= 0) {
      setFormError("Mock Wix dispatch blocked: maximum 5 calls per rolling 60-minute window.");
      return;
    }

    const order: UnifiedOrder = {
      ...draftOrder,
      id: `CORP-${Date.now().toString(36).toUpperCase()}`,
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
    };

    submitting.current = true;
    const result = dispatchMockWixOrder(order);
    submitting.current = false;
    setQuota(getMockWixDispatchQuota());

    if (!result.ok) {
      setFormError(result.error);
      setNotice("");
      return;
    }

    setOrders((current) => [...current, result.order]);
    setLines([]);
    setFormError("");
    setDraftTouched(true);
    setAppliedTouched(true);
    setDraftPreset(null);
    setChosenPreset(null);
    setDraftStart((current) => widenDate(current ?? seededStart, result.order.deliveryDate, "start"));
    setDraftEnd((current) => widenDate(current ?? seededEnd, result.order.deliveryDate, "end"));
    setChosenStart((current) => widenDate(current ?? seededStart, result.order.deliveryDate, "start"));
    setChosenEnd((current) => widenDate(current ?? seededEnd, result.order.deliveryDate, "end"));
    setNotice(
      `Order ${result.order.id} is confirmed for ${formatDate(result.order.deliveryDate)}. It is on the Master Schedule and in the ingredient calculator. Wix was not contacted. ${result.callsRemaining} mock dispatch${result.callsRemaining === 1 ? "" : "es"} left in this hour.`,
    );
  }

  function printSection(target: PrintTarget) {
    document.body.dataset.print = target;
    window.print();
  }

  async function copyShoppingList() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(shoppingList, null, 2));
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Clipboard was blocked. Select the JSON below and copy it by hand.");
    }
  }

  function downloadShoppingList() {
    const blob = new Blob([JSON.stringify(shoppingList, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shopping-list.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function orderFromMorrisons() {
    if (orderList.length === 0) {
      setCopyError("Every Morrisons line is already covered. Nothing to order.");
      setOrderNote("");
      return;
    }
    const text = JSON.stringify(orderList, null, 2);
    const opened = window.open("https://groceries.morrisons.com/", "_blank");
    if (opened) opened.opener = null;
    try {
      await navigator.clipboard.writeText(text);
      setCopyError("");
    } catch {
      setCopyError("Clipboard was blocked. The helper can still load this list from the ops desk, or you can copy the JSON below.");
    }
    try {
      await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
    } catch {
      /* The clipboard copy still lets the Morrisons helper load the list. */
    }
    setOrderNote(
      "Morrisons should be open in a new tab. Sign in there if Chrome asks, then click Load from Clipboard in the helper. If no tab appeared, allow pop-ups and click again.",
    );
  }

  async function copyUserscript() {
    try {
      const response = await fetch("/api/morrisons-userscript");
      if (!response.ok) throw new Error("missing");
      await navigator.clipboard.writeText(await response.text());
      setScriptCopied(true);
      setCopyError("");
      window.setTimeout(() => setScriptCopied(false), 2000);
    } catch {
      setCopyError("Could not copy the userscript. Open scripts/morrisons-trolley-helper.user.js and copy it by hand.");
    }
  }

  return (
    <div className="scheme-light min-h-full flex-1 bg-[#f3eadc] text-[#2c241c]" suppressHydrationWarning>
      <p className="no-print bg-[#7d3044] px-4 py-2 text-center text-sm font-semibold text-white">
        {`Private read-only test deployment. Menus, pictures, and orders come from the saved snapshot. This site does not change the live Wix site.`}
      </p>
      <header className="no-print border-b border-[#e4d5c3] bg-[#fffaf3]" suppressHydrationWarning>
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-5 sm:px-6" suppressHydrationWarning>
          <BrandLogo src={brandLogo} />
          <div className="min-w-0" suppressHydrationWarning>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#7d3044] uppercase" suppressHydrationWarning>
              Scone Tea Party Ltd
            </p>
            <h1 className="text-2xl font-semibold tracking-tight" suppressHydrationWarning>Ops desk</h1>
            <p className="max-w-3xl text-sm leading-6 text-[#5c5146]" suppressHydrationWarning>
              {`Private test for Sarah Catlin Thomas. Edits stay in this browser. Nothing on this page is sent to Wix.`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="no-print flex flex-wrap gap-2" role="tablist" aria-label="Ops desk sections">
          {visibleTabs.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selected
                    ? "bg-[#7d3044] text-white"
                    : "border border-[#e4d5c3] bg-white text-[#2c241c] hover:bg-[#fffaf3]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "portal" ? (
          <section className="mt-6" role="tabpanel" aria-label="Corporate Order Portal">
            {session ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4d5c3] bg-white px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] text-[#7d3044] uppercase">Signed in</p>
                    <p className="text-lg font-semibold">{session.displayName}</p>
                    <p className="text-sm text-[#5c5146]">
                      {session.canAccessOpsTabs
                        ? "Staff session. Master Schedule, Warnings, calculators, Morrisons and Supplies, Website Menu Items, Overheads, and Business Overview are unlocked. Orders are not sent to Wix."
                        : "This session stays in the browser. Orders are not sent to Wix."}
                    </p>
                  </div>
                  <button type="button" className={secondaryClass} onClick={signOut}>
                    <LogOut aria-hidden="true" size={16} />
                    Sign out
                  </button>
                </div>

                {session.companyName ? (
                <>
                <div className="mt-6">
                  <h2 className="text-xl font-semibold">Past orders</h2>
                  <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                    {`The last ${recentHistory.length} delivered orders. Open a box to see the items. Earlier orders from April onward stay in the yearly accounts and off the schedule.`}
                  </p>
                  <div className="mt-3 space-y-3">
                    {recentHistory.map((order) => (
                      <details key={order.id} className="rounded-lg border border-[#e4d5c3] bg-white">
                        <summary className="cursor-pointer px-4 py-3 font-semibold">
                          {`Booked ${formatDate(order.bookedDate)} · ${order.headcount} ${order.headcount === 1 ? "person" : "people"}`}
                        </summary>
                        <div className="px-4 pb-4">
                          <p className="text-sm text-[#5c5146]">{`Delivered ${formatDate(order.deliveryDate)}`}</p>
                          <ul className="mt-3 space-y-2">
                            {order.lineItems.map((item, index) => (
                              <li key={`${order.id}-${index}`} className="flex gap-3 text-sm">
                                <FoodImage
                                  src={catalog.find((entry) => entry.id === item.catalogItemId)?.imageUrl ?? item.imageUrl}
                                  fallbackSrc={builtInImage(item.catalogItemId)}
                                  className="h-12 w-12 shrink-0 rounded-md"
                                />
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {item.quantity}× {item.name}
                                  </p>
                                  <p className="text-[#5c5146]">
                                    {item.variant}
                                    {item.modifiers ? ` · ${modifierText(item.modifiers)}` : ""}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold">Total {gbp(historicalOrderTotal(order))}</p>
                            <button type="button" className={primaryClass} onClick={() => orderAgain(order)}>
                              Order Again
                            </button>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>

                {menuTiers ? (
                  <div className="mt-6 rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-4">
                    <h2 className="text-xl font-semibold">Menu generator</h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#7d3044]">{menuTiers.pastLabel}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                      {`${menuTiers.pastOrderCount} delivered orders from April onward set that benchmark. Basic, Standard, and Deluxe are priced for ${menuTiers.headcount} people from the saved menu.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Headcount">
                      {[20, 30, 40].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={guestCount === count ? primaryClass : secondaryClass}
                          onClick={() => setGuestCount(count)}
                        >
                          {count} people
                        </button>
                      ))}
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        Headcount
                        <input
                          className={`${controlClass} w-24`}
                          type="number"
                          min={1}
                          max={500}
                          value={guestCount}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setGuestCount(Number.isFinite(next) ? Math.min(500, Math.max(1, Math.round(next))) : 1);
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {menuTiers.tiers.map((tier) => (
                        <article key={tier.id} className="flex flex-col rounded-lg border border-[#e4d5c3] bg-white p-4">
                          <h3 className="text-lg font-semibold">{tier.label}</h3>
                          <p className="mt-1 text-2xl font-semibold">{`${gbp(tier.perPerson)} per person`}</p>
                          <p className="mt-2 text-sm leading-6 text-[#5c5146]">{tier.blurb}</p>
                          <p className="mt-2 text-sm font-semibold leading-6">{tier.comparison}</p>
                          <p className="mt-1 text-sm text-[#5c5146]">{`Menu total ${gbp(tier.total)}`}</p>
                          <ul className="mt-3 space-y-3">
                            {tier.lines.map((item) => (
                              <li key={`${tier.id}-${item.catalogItemId}`} className="flex gap-3">
                                <FoodImage
                                  src={item.imageUrl}
                                  fallbackSrc={builtInImage(item.catalogItemId)}
                                  className="h-12 w-12 shrink-0 rounded-md"
                                />
                                <div>
                                  <p className="text-sm font-medium">
                                    {`${item.quantity}× ${item.name}`}
                                    <span className="ml-2 font-semibold">{gbp(item.quantity * item.unitPrice)}</span>
                                  </p>
                                  <p className="text-sm leading-5 text-[#5c5146]">{item.reason}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            className={`${primaryClass} mt-4`}
                            onClick={() => addTier(tier)}
                            disabled={tier.lines.length === 0}
                          >
                            {`Add ${tier.label} menu to basket`}
                          </button>
                        </article>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[#5c5146]">
                      Adding a menu replaces the basket. Checkout stays Invoice Later and is not sent to Wix.
                    </p>
                  </div>
                ) : null}
                </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[#5c5146]">
                    Company past orders stay on each company login. The menu below can still raise an invoice-later order.
                  </p>
                )}

            <div className="no-print sticky top-0 z-20 -mx-4 mt-6 border-b border-[#e4d5c3] bg-[#f3eadc]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Menu sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sectionFilter === "All"}
                  onClick={() => setSectionFilter("All")}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    sectionFilter === "All" ? "bg-[#2c241c] text-white" : "bg-white text-[#2c241c]"
                  }`}
                >
                  All
                </button>
                {menuSections.map((section) => (
                  <button
                    key={section}
                    type="button"
                    role="tab"
                    aria-selected={sectionFilter === section}
                    onClick={() => setSectionFilter(section)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      sectionFilter === section ? "bg-[#2c241c] text-white" : "bg-white text-[#2c241c]"
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
              <label className="relative mt-1 block">
                <span className="sr-only">Search the menu</span>
                <Search aria-hidden="true" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#8a7b6c]" />
                <input
                  className={`${controlClass} pl-9`}
                  value={menuQuery}
                  onChange={(event) => setMenuQuery(event.target.value)}
                  placeholder="Search the menu"
                />
              </label>
              <p className="mt-2 text-xs text-[#5c5146]">
                {catalogSource === "menu"
                  ? "Every visible item from the saved website menu. Pictures are stored on this machine. Orders are not sent to Wix."
                  : catalogSource === "snapshot"
                    ? "Menu mapped from the local Wix snapshot. Orders still stay on this machine."
                    : "Built-in menu, in the live storefront section order. Add data/wix-snapshot.json to mirror a pulled menu."}
              </p>
            </div>

            {notice ? (
              <p role="status" className="mt-4 rounded-md border border-[#b7d7c4] bg-[#f1faf4] px-3 py-2 text-sm text-[#1f6b45]">
                {notice}
              </p>
            ) : null}

            <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-8">
                {groupedMenu.map((group) => (
                  <section key={group.section} aria-labelledby={`section-${group.section.replace(/\s+/g, "-")}`}>
                    <h2 id={`section-${group.section.replace(/\s+/g, "-")}`} className="text-xl font-semibold">
                      {group.section}
                    </h2>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <article key={item.id} className="flex flex-col overflow-hidden rounded-lg border border-[#e4d5c3] bg-white">
                          <FoodImage src={item.imageUrl} fallbackSrc={builtInImage(item.id)} className="h-40 w-full" />
                          <div className="flex flex-1 flex-col p-4">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-semibold leading-5">{item.name}</h3>
                              <DietaryBadges tags={item.dietaryTags} />
                            </div>
                            {item.description ? (
                              <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#5c5146]">{item.description}</p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                              <p className="text-sm font-semibold">{priceLabel(item)}</p>
                              <button type="button" className={secondaryClass} onClick={() => openItem(item)}>
                                {needsCustomize(item) ? "Customize" : "Add"}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {groupedMenu.length === 0 ? (
                  <p className="text-sm text-[#5c5146]">Nothing in this section matches that search.</p>
                ) : null}
              </div>

              <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
                <form onSubmit={submitOrder} className="space-y-4 rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Your order</h2>
                    <p className="mt-1 text-sm text-[#5c5146]">Invoice later. This basket is not sent to Wix.</p>
                  </div>
                  {lines.length > 0 ? (
                    <ul className="divide-y divide-[#eadfce] border-y border-[#eadfce]">
                      {lines.map((line) => (
                        <li key={line.key} className="py-3 text-sm">
                          <div className="flex gap-3">
                            <FoodImage
                              src={line.imageUrl}
                              fallbackSrc={builtInImage(line.catalogItemId)}
                              className="h-12 w-12 shrink-0 rounded-md"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-medium">{line.name}</p>
                                <p className="font-semibold">{gbp(line.quantity * line.unitPrice)}</p>
                              </div>
                              <p className="mt-1 text-[#5c5146]">
                                {line.variant}
                                {line.modifiers ? ` · ${modifierText(line.modifiers)}` : ""}
                              </p>
                              {line.specialInstructions ? (
                                <p className="mt-1 text-[#6b3208]">Note: {line.specialInstructions}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center rounded-md border border-[#e4d5c3] bg-white">
                              <button
                                type="button"
                                className="px-2 py-1"
                                aria-label={`Decrease ${line.name}`}
                                onClick={() => setLineQuantity(line.key, line.quantity - 1)}
                              >
                                <Minus aria-hidden="true" size={14} />
                              </button>
                              <span className="min-w-6 text-center tabular-nums">{line.quantity}</span>
                              <button
                                type="button"
                                className="px-2 py-1"
                                aria-label={`Increase ${line.name}`}
                                onClick={() => setLineQuantity(line.key, line.quantity + 1)}
                              >
                                <Plus aria-hidden="true" size={14} />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-[#7d3044] underline"
                              onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#5c5146]">Your basket is empty. Add something from the menu.</p>
                  )}
                  <p className="text-sm font-semibold">Subtotal {gbp(draftTotal)}</p>

                  <div className="space-y-3 border-t border-[#eadfce] pt-3">
                    <h3 className="text-sm font-semibold">Fulfillment and invoice details</h3>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Fulfillment type">
                      <button
                        type="button"
                        aria-pressed={form.fulfillment === "DELIVERY"}
                        onClick={() => updateForm("fulfillment", "DELIVERY")}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${
                          form.fulfillment === "DELIVERY" ? "bg-[#7d3044] text-white" : "border border-[#e4d5c3] bg-white"
                        }`}
                      >
                        Delivery
                      </button>
                      <button
                        type="button"
                        aria-pressed={form.fulfillment === "COLLECTION"}
                        onClick={() => updateForm("fulfillment", "COLLECTION")}
                        className={`rounded-md px-3 py-2 text-sm font-semibold ${
                          form.fulfillment === "COLLECTION" ? "bg-[#7d3044] text-white" : "border border-[#e4d5c3] bg-white"
                        }`}
                      >
                        Collection (Knutton)
                      </button>
                    </div>
                    <Field label={form.fulfillment === "DELIVERY" ? "Delivery date" : "Collection date"}>
                      <input
                        className={controlClass}
                        type="date"
                        value={form.deliveryDate}
                        onChange={(event) => updateForm("deliveryDate", event.target.value)}
                      />
                    </Field>
                    <Field label={form.fulfillment === "DELIVERY" ? "Delivery window" : "Collection time"}>
                      <select
                        className={controlClass}
                        value={form.deliveryWindow}
                        onChange={(event) => updateForm("deliveryWindow", event.target.value)}
                      >
                        {DELIVERY_WINDOWS.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {form.fulfillment === "DELIVERY" ? (
                      <>
                        <Field label="Delivery address">
                          <textarea
                            className={`${controlClass} min-h-20`}
                            value={form.addressLine}
                            onChange={(event) => updateForm("addressLine", event.target.value)}
                          />
                        </Field>
                        <Field label="Postcode">
                          <input
                            className={controlClass}
                            value={form.postcode}
                            onChange={(event) => updateForm("postcode", event.target.value)}
                            autoComplete="postal-code"
                          />
                        </Field>
                      </>
                    ) : (
                      <p className="text-sm text-[#5c5146]">Collected from Knutton. No delivery address is needed.</p>
                    )}
                    <Field label="Company name">
                      <input
                        className={controlClass}
                        value={form.companyName}
                        onChange={(event) => updateForm("companyName", event.target.value)}
                        autoComplete="organization"
                        readOnly={Boolean(session?.companyName)}
                      />
                    </Field>
                    {session?.companyName ? (
                      <p className="-mt-2 text-xs text-[#5c5146]">Taken from the signed-in corporate account.</p>
                    ) : null}
                    <Field label="Purchase order (PO) reference">
                      <input
                        className={controlClass}
                        value={form.poReference}
                        onChange={(event) => updateForm("poReference", event.target.value)}
                      />
                    </Field>
                    <Field label="Contact name">
                      <input
                        className={controlClass}
                        value={form.contactName}
                        onChange={(event) => updateForm("contactName", event.target.value)}
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Accounts payable email">
                      <input
                        className={controlClass}
                        type="email"
                        value={form.contactEmail}
                        onChange={(event) => updateForm("contactEmail", event.target.value)}
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Contact phone">
                      <input
                        className={controlClass}
                        type="tel"
                        value={form.contactPhone}
                        onChange={(event) => updateForm("contactPhone", event.target.value)}
                        autoComplete="tel"
                      />
                    </Field>
                    <Field label="Order-wide allergy / dietary notes">
                      <textarea
                        className={`${controlClass} min-h-20`}
                        value={form.dietaryNotes}
                        onChange={(event) => updateForm("dietaryNotes", event.target.value)}
                        placeholder="Allergies that apply to the whole order"
                      />
                    </Field>
                    <div className="rounded-md border border-[#e7c9a1] bg-[#fff8ee] px-3 py-2">
                      <p className="text-xs font-semibold tracking-wide text-[#8a4b12] uppercase">Payment method</p>
                      <p className="mt-1 text-sm font-semibold">Invoice Later (B2B Account — NOT_PAID)</p>
                      <p className="text-xs leading-5 text-[#5c5146]">Locked for corporate orders.</p>
                    </div>
                  </div>

                  {formError ? (
                    <p role="alert" className="rounded-md border border-[#e7b4ae] bg-[#fff1ef] px-3 py-2 text-sm text-[#8a2b2b]">
                      {formError}
                    </p>
                  ) : null}

                  <details className="rounded-md border border-[#e4d5c3] bg-[#2c241c] p-3 text-[#f6efe4]">
                    <summary className="cursor-pointer text-sm font-semibold text-[#e7c27a]">
                      Wix Create Order payload preview
                    </summary>
                    {payload ? (
                      <>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <dt className="text-[#cbbba6]">Channel</dt>
                            <dd className="font-semibold">{payload.order.channelInfo.type}</dd>
                          </div>
                          <div>
                            <dt className="text-[#cbbba6]">Payment</dt>
                            <dd className="font-semibold">{payload.order.paymentStatus}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[#cbbba6]">Catalog app id</dt>
                            <dd className="font-mono text-[11px] break-all">
                              {payload.order.lineItems[0]?.catalogReference.appId}
                            </dd>
                          </div>
                        </dl>
                        <pre className="mt-3 max-h-64 overflow-auto text-[11px] leading-5">{JSON.stringify(payload, null, 2)}</pre>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#f0e4d4]">Add a line to build the Create Order body.</p>
                    )}
                  </details>

                  <button type="submit" className={`${primaryClass} w-full`} disabled={quota.remaining <= 0}>
                    Submit Corporate Order (Invoice Later)
                  </button>
                  <p className="text-xs text-[#5c5146]">
                    {quota.remaining} of {quota.limit} mock dispatches left in this rolling hour.
                  </p>
                </form>
              </aside>
            </div>

            {modalItem ? (
              <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#2c241c]/50 p-4 sm:items-center">
                <button
                  type="button"
                  className="absolute inset-0 cursor-default"
                  aria-label="Close item"
                  onClick={() => setModalItem(null)}
                />
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="item-dialog-title"
                  className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[#fffaf3] p-5 shadow-lg"
                >
                  <FoodImage
                    src={modalItem.imageUrl}
                    fallbackSrc={builtInImage(modalItem.id)}
                    className="mb-4 h-52 w-full rounded-md"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 id="item-dialog-title" className="text-xl font-semibold">
                        {modalItem.name}
                      </h2>
                      {modalItem.description ? (
                        <p className="mt-1 text-sm leading-5 text-[#5c5146]">{modalItem.description}</p>
                      ) : null}
                      <div className="mt-2">
                        <DietaryBadges tags={modalItem.dietaryTags} />
                      </div>
                    </div>
                    <button type="button" className={secondaryClass} aria-label="Close" onClick={() => setModalItem(null)}>
                      <X aria-hidden="true" size={16} />
                    </button>
                  </div>

                  {modalItem.priceVariants.length > 0 ? (
                    <fieldset className="mt-4">
                      <legend className="text-sm font-semibold">Size / price</legend>
                      <div className="mt-2 space-y-2">
                        {modalItem.priceVariants.map((variant) => (
                          <label
                            key={variant.option}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="price-variant"
                                checked={modalDraft.variant === variant.option}
                                onChange={() => setModalDraft((current) => ({ ...current, variant: variant.option }))}
                              />
                              {variant.option}
                            </span>
                            <span className="font-semibold">{gbp(variant.price)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  {(modalItem.modifierGroups ?? []).map((group) => (
                    <fieldset key={group.name} className="mt-4">
                      <legend className="text-sm font-semibold">{group.name}</legend>
                      <div className="mt-2 space-y-2">
                        {group.options.map((option) => (
                          <label
                            key={option}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm"
                          >
                            <input
                              type="radio"
                              name={group.name}
                              checked={(modalDraft.modifiers[group.name] ?? group.options[0]) === option}
                              onChange={() =>
                                setModalDraft((current) => ({
                                  ...current,
                                  modifiers: { ...current.modifiers, [group.name]: option },
                                }))
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}

                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block font-semibold">Special instructions / allergy note</span>
                    <textarea
                      className={`${controlClass} min-h-20`}
                      value={modalDraft.note}
                      onChange={(event) => setModalDraft((current) => ({ ...current, note: event.target.value }))}
                      placeholder="For this item only"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-md border border-[#e4d5c3] bg-white">
                      <button
                        type="button"
                        className="px-3 py-2"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          setModalDraft((current) => ({ ...current, quantity: Math.max(1, current.quantity - 1) }))
                        }
                      >
                        <Minus aria-hidden="true" size={16} />
                      </button>
                      <span className="min-w-8 text-center font-semibold tabular-nums">{modalDraft.quantity}</span>
                      <button
                        type="button"
                        className="px-3 py-2"
                        aria-label="Increase quantity"
                        onClick={() =>
                          setModalDraft((current) => ({ ...current, quantity: Math.min(99, current.quantity + 1) }))
                        }
                      >
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </div>
                    <button type="button" className={primaryClass} onClick={addModalItem}>
                      Add to Order — {gbp(modalLineTotal)}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
              </>
            ) : adminLogin ? (
              <form onSubmit={signInStaff} className="mx-auto max-w-lg space-y-4 rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-5">
                <div>
                  <h2 className="text-xl font-semibold">Admin login</h2>
                  <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                    {`Sign in as ${SARAH_SCONE_NAME} to open the Master Schedule, Warnings, ingredient calculator, Morrisons trolley, Morrisons and Supplies, Website Menu Items, Overheads, Business Overview, and corporate accounts. Password ${SARAH_SCONE_PASSWORD}. Nothing on this form is sent to Wix.`}
                  </p>
                </div>
                <Field label="Name">
                  <input className={controlClass} value={SARAH_SCONE_NAME} readOnly />
                </Field>
                <Field label="Password">
                  <input
                    className={controlClass}
                    type="password"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <p className="-mt-2 text-xs text-[#5c5146]">Hint: {SARAH_SCONE_PASSWORD}</p>
                {staffError ? (
                  <p role="alert" className="rounded-md border border-[#e7b4ae] bg-[#fff1ef] px-3 py-2 text-sm text-[#8a2b2b]">
                    {staffError}
                  </p>
                ) : null}
                <button type="submit" className={`${primaryClass} w-full`}>
                  Sign in as {SARAH_SCONE_NAME}
                </button>
                <button type="button" className="text-sm font-semibold text-[#7d3044] underline" onClick={() => setAdminLogin(false)}>
                  Corporate Order Portal
                </button>
              </form>
            ) : (
              <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
                <form onSubmit={signIn} className="space-y-4 rounded-lg border border-[#e4d5c3] bg-white p-5">
                  <div>
                    <h2 className="text-xl font-semibold">Company sign in</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                      Choose Biocomposits, Leoni, or Codeweavers. Demo access is username {LOCAL_PORTAL_USERNAME} and
                      password {LOCAL_PORTAL_PASSWORD}. Nothing on this form is sent to Wix.
                    </p>
                  </div>
                  <Field label="Company">
                    <select
                      className={controlClass}
                      value={loginCompany}
                      onChange={(event) => setLoginCompany(event.target.value)}
                    >
                      {corporateAccounts.map((account) => (
                        <option key={account.companyName} value={account.companyName}>
                          {account.companyName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Username">
                    <input
                      className={controlClass}
                      value={loginUsername}
                      onChange={(event) => setLoginUsername(event.target.value)}
                      autoComplete="username"
                    />
                  </Field>
                  <p className="-mt-2 text-xs text-[#5c5146]">Hint: {LOCAL_PORTAL_USERNAME}</p>
                  <Field label="Password">
                    <input
                      className={controlClass}
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </Field>
                  <p className="-mt-2 text-xs text-[#5c5146]">Hint: {LOCAL_PORTAL_PASSWORD}</p>
                  {loginError ? (
                    <p role="alert" className="rounded-md border border-[#e7b4ae] bg-[#fff1ef] px-3 py-2 text-sm text-[#8a2b2b]">
                      {loginError}
                    </p>
                  ) : null}
                  <button type="submit" className={`${primaryClass} w-full`}>
                    Sign in
                  </button>
                </form>
                <div className="flex items-start rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-5">
                  <button type="button" className="text-base font-semibold text-[#7d3044] underline" onClick={() => setAdminLogin(true)}>
                    Admin login
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}


        {session?.canAccessOpsTabs && tab === "schedule" ? (
          <section className="mt-6" role="tabpanel" aria-label="Master Schedule and Printout">
            <div className="print-only mb-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase">Scone Tea Party Ltd</p>
              <h2 className="text-xl font-semibold">
                Master schedule · {datesReady ? `${formatDate(appliedStart)} to ${formatDate(appliedEnd)}` : "next 4 days"}
              </h2>
            </div>

            <div className="no-print mb-3">
              <SnapshotBadge status={snapshotStatus} />
            </div>

            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="From">
                    <input
                      className={controlClass}
                      type="date"
                      value={rangeStart}
                      onChange={(event) => changeRangeStart(event.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <input
                      className={controlClass}
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => changeRangeEnd(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={shownDraftPreset === "today" ? primaryClass : secondaryClass} onClick={applyToday}>
                    Today
                  </button>
                  <button type="button" className={shownDraftPreset === "next4" ? primaryClass : secondaryClass} onClick={applyNextFourDays}>
                    Next 4 days
                  </button>
                  <button type="button" className={primaryClass} onClick={commitRange} disabled={!datesReady || draftInvalid || !pendingRange || !rangeStart || !rangeEnd}>
                    Apply
                  </button>
                </div>
                <p className="text-xs leading-5 text-[#5c5146]">
                  From, To, Today, and Next 4 days change the pending range. Apply updates the bookings, kitchen prep, and delivery run. Next 4 days is today through today + 3 days, 4 days inclusive.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} onClick={() => printSection("kitchen")}>
                  <Printer aria-hidden="true" size={16} />
                  Print kitchen prep
                </button>
                <button type="button" className={secondaryClass} onClick={() => printSection("delivery")}>
                  <Printer aria-hidden="true" size={16} />
                  Print delivery run
                </button>
                <button type="button" className={secondaryClass} onClick={() => printSection("all")}>
                  <Printer aria-hidden="true" size={16} />
                  Print full pack
                </button>
              </div>
            </div>
            <p className="no-print mt-2 text-xs leading-5 text-[#5c5146]">
              In the print dialog, turn off headers and footers so each A4 page is just the cards.
            </p>
            <p className="mt-3 text-sm font-semibold text-[#2c241c]">
              {datesReady
                ? `Applied: ${formatDate(appliedStart)} to ${formatDate(appliedEnd)}.${appliedRangeNote(appliedPreset)}`
                : "Applied: next 4 days, today through today + 3 days, 4 days inclusive. This browser fills in the UK date."}
            </p>
            {slotClashes.map((clash) => {
              const outside = !datesReady || !appliedStart || !appliedEnd || clash.date < appliedStart || clash.date > appliedEnd;
              return (
                <p
                  key={clash.date}
                  role="alert"
                  className="mt-3 rounded-lg px-4 py-3 text-sm leading-6"
                  style={{ backgroundColor: "#fff1ef", color: "#8a2b2b", border: "1px solid #e4b4b4" }}
                >
                  {`Delivery conflict on ${formatDate(clash.date)}. ${tightSlotMessage(clash)}${outside ? ` This date is outside the applied range. Set From and To to ${formatDate(clash.date)} and click Apply to open these orders and the delivery run.` : " The orders are in the list below, and the delivery run repeats this warning."}`}
                </p>
              );
            })}
            {pendingRange ? (
              <p className="mt-1 text-sm text-[#6b3208]">
                {`Pending: ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}.${appliedRangeNote(draftPreset)} Click Apply to update the bookings, kitchen prep, and delivery run.`}
              </p>
            ) : null}
            {draftInvalid ? (
              <p role="alert" className="mt-1 text-sm text-[#8a2b2b]">
                The pending start date is after the end date. Choose a range that runs forward, then click Apply.
              </p>
            ) : null}
            {bookingChips.inRange.length > 0 ? (
              <div className="no-print mt-3 flex flex-wrap gap-2">
                {bookingChips.inRange.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className={rangeStart === date && rangeEnd === date ? primaryClass : secondaryClass}
                    onClick={() => showBookingDate(date)}
                  >
                    Wix booking · {formatDate(date)}
                  </button>
                ))}
              </div>
            ) : null}
            {bookingChips.outside.length > 0 ? (
              <div className="no-print mt-3">
                <button
                  type="button"
                  className={secondaryClass}
                  aria-expanded={showOutsideDates}
                  onClick={() => setShowOutsideDates((open) => !open)}
                >
                  {showOutsideDates
                    ? "Hide booking dates outside this range"
                    : `Booking dates outside ${formatDate(appliedStart)} to ${formatDate(appliedEnd)}`}
                </button>
                {showOutsideDates ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bookingChips.outside.map((date) => (
                        <button
                          key={date}
                          type="button"
                          className={rangeStart === date && rangeEnd === date ? primaryClass : secondaryClass}
                          onClick={() => showBookingDate(date)}
                        >
                          Wix booking · {formatDate(date)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#5c5146]">
                      Choosing one of these dates sets the pending range. Click Apply to show it in the bookings, kitchen prep, and delivery run.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            <p className="mt-4 text-sm text-[#5c5146]">
              Wix bookings are read from the local snapshot and are not sent back to Wix. Canceled orders stay out of
              kitchen prep, the delivery run, and the shopping list.
              {canceledInView > 0 && !showCanceled
                ? ` ${canceledInView} canceled order${canceledInView === 1 ? "" : "s"} in this range ${canceledInView === 1 ? "is" : "are"} hidden.`
                : ""}
            </p>
            <label className="no-print mt-3 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showCanceled}
                onChange={(event) => setShowCanceled(event.target.checked)}
              />
              Show canceled orders
            </label>

            <div className="print-schedule mt-4 overflow-x-auto rounded-lg border border-[#e4d5c3] bg-[#fffaf3]">
              <div className="border-b border-[#eadfce] px-4 py-3">
                <p className="text-lg font-semibold">{datesReady ? `Total Orders = ${tableOrders.length}` : "Total Orders"}</p>
                <p className="mt-1 text-sm text-[#5c5146]">
                  {datesReady
                    ? `${tableItemCount} item${tableItemCount === 1 ? "" : "s"}${tableGuestCount > 0 ? ` · ${tableGuestCount} guests from platter sizes that state a headcount` : ""} · ${formatDate(appliedStart)} to ${formatDate(appliedEnd)}`
                    : "Next 4 days, today through today + 3 days, 4 days inclusive."}
                </p>
              </div>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-[#eadfce] text-xs tracking-wide text-[#5c5146] uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Details</th>
                    <th className="px-3 py-2 font-semibold">When</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Items</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableOrders.map((order) => {
                    const open = openOrderId === order.id;
                    const guests = orderGuestCount(order);
                    const postcode = extractPostcode(order.deliveryAddress);
                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={`border-b border-[#f0e6d8] align-top ${isCanceledOrder(order) ? "bg-[#fff1ef] text-[#6d6256]" : ""}`}
                        >
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              className="font-semibold text-[#7d3044] underline"
                              aria-expanded={open}
                              onClick={() => setOpenOrderId(open ? null : order.id)}
                            >
                              {open ? "Hide" : "Open"}
                            </button>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p>{formatDate(order.deliveryDate)}</p>
                            <p>{order.deliveryWindow}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{order.companyName ?? order.contactName}</p>
                            <p className="text-[#5c5146]">{order.contactName}</p>
                          </td>
                          <td className="px-3 py-3">
                            {orderItemCount(order)} item{orderItemCount(order) === 1 ? "" : "s"}
                            {guests > 0 ? ` · ${guests} guests` : ""}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col items-start gap-2">
                              <SourceBadge source={order.source} />
                              <CancelBadge order={order} />
                              <PaymentBadge status={order.paymentStatus} />
                              {isCanceledOrder(order) ? null : (
                                <button
                                  type="button"
                                  className="rounded-md border border-[#d7c4b0] bg-white px-2 py-1 text-xs font-semibold"
                                  onClick={() => toggleOrderComplete(order)}
                                >
                                  {desk.completed[order.id] ? "Completed — undo" : "Mark completed"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open ? (
                          <tr key={`${order.id}-details`} className="border-b border-[#f0e6d8] bg-white">
                            <td className="px-4 py-4" colSpan={5}>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="text-sm leading-6">
                                  <p className="font-semibold">Contact</p>
                                  <p>{order.contactName}</p>
                                  <p>{order.contactPhone || "No phone on the order"}</p>
                                  <p>{order.contactEmail || "No email on the order"}</p>
                                  <p className="mt-2 font-semibold">Address</p>
                                  <p>{order.deliveryAddress}</p>
                                  <p>Postcode: {postcode || "No postcode on this address"}</p>
                                  <p className="mt-2 font-semibold">Slot</p>
                                  <p>
                                    {formatDate(order.deliveryDate)} · {order.deliveryWindow}
                                  </p>
                                  <p>{order.fulfillment === "COLLECTION" ? "Collection" : "Delivery"}</p>
                                  <p>{guests > 0 ? `${guests} guests from the platter sizes` : "Guest count is not stated on the platters"}</p>
                                </div>
                                <div className="text-sm leading-6">
                                  <p className="font-semibold">Status</p>
                                  <p>{order.id}{order.poReference ? ` · ${order.poReference}` : ""}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <CancelBadge order={order} />
                                    <PaymentBadge status={order.paymentStatus} />
                                  </div>
                                  <p className="mt-3 font-semibold">Notes</p>
                                  <p>{order.dietaryNotes || "No notes recorded."}</p>
                                </div>
                              </div>
                              <p className="mt-3 text-sm font-semibold">Platters and items</p>
                              <ul className="mt-1 space-y-1 text-sm">
                                {order.lineItems.map((line, index) => (
                                  <li key={`${order.id}-${index}`}>
                                    {line.quantity}× {line.name}
                                    {line.variant ? ` — ${line.variant}` : ""}
                                    {line.modifiers ? ` — ${modifierText(line.modifiers)}` : ""}
                                    {line.specialInstructions ? ` — Note: ${line.specialInstructions}` : ""}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-3 text-sm font-semibold">Baking for this order</p>
                              {isCanceledOrder(order) ? (
                                <p className="mt-1 text-sm text-[#5c5146]">This order is canceled, so it is left out of the bake and the electricity cost.</p>
                              ) : (
                                <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                                  {`This order's share of ${formatDate(order.deliveryDate)} oven electricity is ${gbp((bakeDays.find((day) => day.date === order.deliveryDate)?.orderElectricity[order.id] ?? 0))}. Compatible trays from every order that day share a batch, so the oven cost is split by tray and counted once in the day's profit. The batches are listed under What is being baked.`}
                                </p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {!datesReady ? (
                    <tr>
                      <td className="px-3 py-4 text-[#5c5146]" colSpan={5}>
                        The next 4 days are being set from the UK date.
                      </td>
                    </tr>
                  ) : tableOrders.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-[#5c5146]" colSpan={5}>
                        No orders in this applied range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <h2 className="print-kitchen mt-8 text-lg font-semibold">What is being baked</h2>
            <p className="print-kitchen mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
              {`Each day groups compatible items from every order into shared oven batches. One oven holds ${TRAYS_PER_OVEN} trays. Both ovens together hold ${TRAYS_BOTH_OVENS}. A shared batch splits its electricity by tray and that cost is deducted once from the day's profit. Items marked Cannot bake with, and trays that do not fit, take their own oven. Quiche keeps a 30-minute pre-bake and then a 40-minute bake. Times are minutes from the start of that day's bake. VAT on the day's profit is £0.00.`}
            </p>
            <div className="mt-3 grid gap-4">
              {bakeDays.map((day) => (
                <article key={day.date} className="print-card print-kitchen rounded-lg border border-[#e4d5c3] bg-white px-4 py-4">
                  <h3 className="text-lg font-semibold">{formatDate(day.date)}</h3>
                  <p className="mt-1 text-sm text-[#5c5146]">
                    {`${day.orderCount} order${day.orderCount === 1 ? "" : "s"} · ${day.plan.trays} tray${day.plan.trays === 1 ? "" : "s"} · oven electricity ${gbp(day.electricityCost)} counted once`}
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Sale total</dt>
                      <dd className="text-xl font-semibold">{gbp(day.salePrice)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Food, boxes, pots</dt>
                      <dd className="text-xl font-semibold">{gbp(Math.round((day.foodCost - day.labourCost) * 100) / 100)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Labour payout</dt>
                      <dd className="text-xl font-semibold">{gbp(day.labourCost)}</dd>
                      <dd className="text-xs text-[#5c5146]">£15/hr from item prep times</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Delivery fuel</dt>
                      <dd className="text-xl font-semibold">{gbp(day.fuelCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Oven electricity</dt>
                      <dd className="text-xl font-semibold">{gbp(day.electricityCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Day profit</dt>
                      <dd className="text-xl font-semibold">{gbp(day.profit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Day margin</dt>
                      <dd className="text-xl font-semibold">{`${day.marginPercent}%`}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">VAT</dt>
                      <dd className="text-xl font-semibold">{gbp(0)}</dd>
                    </div>
                  </dl>
                  <div
                    className="mt-3 rounded-md border border-[#e4d5c3] bg-[#f3f0ea] p-3 text-[#8a8178]"
                    style={{ opacity: 0.72, backgroundColor: "#f3f0ea", color: "#8a8178" }}
                  >
                    <p className="text-xs font-semibold tracking-wide uppercase">If VAT registered — 20% VAT applied</p>
                    <p className="mt-1 text-sm leading-6">Preview only. Sarah is not VAT-registered, so this 20% figure is not live tax.</p>
                    <p className="mt-2 text-sm leading-6">
                      {`The 20% is worked out of the ${gbp(day.salePrice)} sale total. Shared oven electricity and delivery fuel stay in the cost, and labour and raw ingredients stay at 0% VAT. Day profit ${gbp(day.profit)} would become ${gbp(day.registeredProfit)}.`}
                    </p>
                  </div>
                  <div className="mt-3">
                    <BakeTimeline plan={day.plan} />
                  </div>
                </article>
              ))}
              {!datesReady ? (
                <p className="print-kitchen text-sm text-[#5c5146]">The next 4 days are being set from the UK date.</p>
              ) : bakeDays.length === 0 ? (
                <p className="print-kitchen text-sm text-[#5c5146]">Nothing to bake in this applied range.</p>
              ) : null}
            </div>

            <h2 className="print-kitchen mt-8 text-lg font-semibold">Kitchen prep sheet</h2>
            <p className="print-kitchen mt-1 text-sm text-[#5c5146]">
              Quantities grouped by item, variant, and modifiers.
            </p>
            <div className="mt-3 grid gap-3">
              {prepRows.map((row) => (
                <article key={row.key} className="print-card print-kitchen rounded-lg border border-[#e4d5c3] bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{row.name}</h3>
                      <p className="text-sm text-[#5c5146]">
                        {row.variant} · {row.modifiers}
                      </p>
                      <p className="mt-1 text-xs text-[#5c5146]">Orders {row.orderIds.join(", ")}</p>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">{row.quantity}</p>
                  </div>
                </article>
              ))}
              {!datesReady ? (
                <p className="print-kitchen text-sm text-[#5c5146]">The next 4 days are being set from the UK date.</p>
              ) : prepRows.length === 0 ? (
                <p className="print-kitchen text-sm text-[#5c5146]">Nothing to prep.</p>
              ) : null}
            </div>

            <h2 className="print-delivery mt-8 text-lg font-semibold">Delivery run sheet</h2>
            <p className="print-delivery mt-1 text-sm text-[#5c5146]">
              One card per day, starting from Knutton (ST5). Booked times are compared with the shorter postcode loop.
              {!datesReady
                ? " The next 4 days are being set from the UK date."
                : ` ${dayPlans.length} day${dayPlans.length === 1 ? "" : "s"} with drops in this ${inclusiveDayCount(appliedStart, appliedEnd)}-day range.`}
            </p>
            <div className="mt-3 grid gap-4">
              {dayPlans.map((day) => {
                const summary = routeNotes.key === routeKey ? (routeNotes.notes[day.date] ?? day.summary) : day.summary;
                const bake = bakeDays.find((entry) => entry.date === day.date);
                const fuel = fuelCostForMiles(day.bookedMiles);
                return (
                  <article key={day.date} className="print-card print-delivery rounded-lg border border-[#e4d5c3] bg-white px-4 py-4">
                    <p className="text-sm font-semibold tracking-wide text-[#7d3044]">From Knutton (ST5)</p>
                    <h3 className="text-lg font-semibold">{formatDate(day.date)}</h3>
                    {day.bookedSequence.length > 0 ? (
                      <p className="mt-1 text-sm text-[#5c5146]">
                        {day.aligned
                          ? `Booked-time loop ${day.bookedMiles.toFixed(1)} miles.`
                          : `Booked-time loop ${day.bookedMiles.toFixed(1)} miles. Shorter loop ${day.efficientMiles.toFixed(1)} miles.`}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-[#5c5146]">
                      {`Fuel ${gbp(fuel)} at £0.20 a mile. Labour payout ${gbp(bake?.labourCost ?? 0)} at £15/hr from the prep times on this day's orders.`}
                    </p>
                    {day.tightSlots.length >= 3 ? (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg px-4 py-3 text-sm leading-6"
                        style={{ backgroundColor: "#fff1ef", color: "#8a2b2b", border: "1px solid #e4b4b4" }}
                      >
                        {`Delivery conflict on ${formatDate(day.date)}. ${tightSlotMessage({ date: day.date, area: "Stoke-on-Trent", withinMinutes: 5, stops: day.tightSlots })}`}
                      </p>
                    ) : null}
                    <div className="mt-3 rounded-lg border border-[#e7c9a1] bg-[#fff8ee] px-3 py-3">
                      <h4 className="text-sm font-semibold text-[#6b3208]">AI Route & Time Advice</h4>
                      <p className="mt-1 text-sm leading-6 text-[#3d342b]">{summary}</p>
                      {day.rings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm leading-6">
                          {day.rings.map((ring) => (
                            <li key={ring.id}>
                              Ring {ring.customer}
                              {ring.company ? ` (${ring.company})` : ""} · {ring.postcode}. Current time {ring.currentWindow}. Suggested time {ring.suggestedWindow}.
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {day.bookedSequence.length > 0 ? (
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold">Booked delivery-time order</h4>
                        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                          {day.bookedSequence.map((stop) => (
                            <li key={`${day.date}-booked-${stop.id}`}>
                              {stop.window} · {stop.customer}
                              {stop.company ? ` · ${stop.company}` : ""} · {stop.postcode}
                              {stop.rough ? " · approximate position" : ""}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {!day.aligned && day.efficientSequence.length > 0 ? (
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold">Shorter geographic order</h4>
                        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                          {day.efficientSequence.map((stop) => (
                            <li key={`${day.date}-short-${stop.id}`}>
                              {stop.window} · {stop.customer}
                              {stop.company ? ` · ${stop.company}` : ""} · {stop.postcode}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {day.collections.length > 0 ? (
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold">Collections at Knutton (ST5)</h4>
                        <ul className="mt-1 space-y-1 text-sm">
                          {day.collections.map((stop) => (
                            <li key={`${day.date}-collection-${stop.id}`}>
                              {stop.window} · {stop.customer}
                              {stop.company ? ` · ${stop.company}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {!datesReady ? (
                <p className="print-delivery text-sm text-[#5c5146]">The next 4 days are being set from the UK date.</p>
              ) : dayPlans.length === 0 ? (
                <p className="print-delivery text-sm text-[#5c5146]">No drops in this applied range.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {session?.canAccessOpsTabs && (tab === "ingredients" || tab === "trolley") ? (
          <section
            className="mt-6"
            role="tabpanel"
            aria-label={tab === "ingredients" ? "Ingredient and Pack Calculator" : "Morrisons Trolley Export"}
          >
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <Field label="From">
                  <input
                    className={controlClass}
                    type="date"
                    value={rangeStart}
                    onChange={(event) => changeRangeStart(event.target.value)}
                  />
                </Field>
                <Field label="To">
                  <input
                    className={controlClass}
                    type="date"
                    value={rangeEnd}
                    onChange={(event) => changeRangeEnd(event.target.value)}
                  />
                </Field>
              </div>
              <button type="button" className={primaryClass} onClick={commitRange} disabled={!datesReady || draftInvalid || !pendingRange || !rangeStart || !rangeEnd}>
                Apply
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#2c241c]">
              {datesReady
                ? `Applied: ${formatDate(appliedStart)} to ${formatDate(appliedEnd)}.`
                : "Applied: next 4 days, today through today + 3 days, 4 days inclusive."}
            </p>
            {pendingRange ? (
              <p className="mt-1 text-sm text-[#6b3208]">
                {`Pending: ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}. Click Apply to update this list.`}
              </p>
            ) : null}

            <div className="no-print mt-4 flex flex-wrap items-end justify-between gap-3">
              <label className="block min-w-[16rem] flex-1 text-sm">
                <span className="mb-1 block font-medium">Search used supplies</span>
                <input
                  className={controlClass}
                  value={supplySearch}
                  onChange={(event) => setSupplySearch(event.target.value)}
                  placeholder="Search ingredients and boxes"
                  aria-label="Search used supplies"
                />
              </label>
              <button
                type="button"
                className={secondaryClass}
                aria-expanded={showStockAmend}
                onClick={() => setShowStockAmend((open) => !open)}
              >
                {showStockAmend ? "Hide stock editor" : "Amend stock"}
              </button>
            </div>
            {showStockAmend ? (
              <StockAmend catalogue={catalogue} required={requiredStock} stock={stockOnHand} onChange={setStockOnHand} />
            ) : null}

            {draftInvalid ? (
              <p role="alert" className="mt-4 text-sm text-[#8a2b2b]">
                The pending start date is after the end date. Choose a range that runs forward, then click Apply.
              </p>
            ) : (
              <p className="mt-4 text-sm text-[#5c5146]">
                {!datesReady
                  ? "The next 4 days are being set from the UK date."
                  : `${rangedOrders.length} order${rangedOrders.length === 1 ? "" : "s"} from ${formatDate(appliedStart)} to ${formatDate(appliedEnd)}, including local mock orders and Wix bookings in that applied range${rangedOrders.length > 0 ? `: ${rangedOrders.map((order) => order.id).join(", ")}.` : "."}`}
              </p>
            )}

            {tab === "ingredients" ? (
              <div className="mt-4">
                <h2 className="text-lg font-semibold">Raw ingredients, rounded up to Morrisons packs</h2>
                <p className="mt-1 text-sm leading-6 text-[#5c5146]">
                  Each ordered platter or portion uses one recipe unit from the matrix. Required is that
                  amount. Net to buy subtracts what is in stock, then packs round up to the shop pack.
                  Covered lines stay visible at 0. Packaging from other suppliers is listed here
                  and left off the Morrisons trolley. An extra large sandwich platter is 10
                  sandwiches and uses 1 seeded loaf plus 1 farmhouse loaf. A standard loaf platter is also
                  10 sandwiches. Smaller boxes keep their own count: small and children&apos;s platters are 5,
                  the large classic platter is 8, gluten-free is 8, brioche and bagels are 8, and bread buns
                  are 12.
                  {ingredientModel.sandwiches > 0
                    ? ` This range makes ${ingredientModel.sandwiches} sandwiches.`
                    : ""}
                </p>
                <div className="print-card mt-4 overflow-x-auto rounded-lg border border-[#e4d5c3] bg-white">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b border-[#eadfce] text-xs tracking-wide text-[#5c5146] uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Ingredient</th>
                        <th className="px-3 py-2 font-semibold">Pack</th>
                        <th className="px-3 py-2 font-semibold">Required</th>
                        <th className="px-3 py-2 font-semibold">In stock</th>
                        <th className="px-3 py-2 font-semibold">Net to buy</th>
                        <th className="px-3 py-2 font-semibold">Packs to buy</th>
                        <th className="px-3 py-2 font-semibold">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStockRows.map((row) => (
                        <tr key={row.key} className="border-b border-[#f0e6d8]">
                          <td className="px-3 py-3 font-medium">{row.ingredient}</td>
                          <td className="px-3 py-3">
                            {row.packLabel} ({formatNumber(row.packSize)} {unitWord(row.packSize, row.unit)})
                            {row.url.startsWith("https://groceries.morrisons.com") ? (
                              <>
                                {" "}
                                <a className="font-semibold text-[#7d3044] underline" href={row.url} target="_blank" rel="noopener noreferrer">
                                  {isMorrisonsProductUrl(row.url) ? "Product" : "Search"}
                                </a>
                              </>
                            ) : row.url.startsWith("http") ? null : (
                              " · other supplier"
                            )}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {formatNumber(row.rawAmount)} {unitWord(row.rawAmount, row.unit)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                className="w-24 rounded-md border border-[#e4d5c3] bg-white px-2 py-1 text-sm tabular-nums"
                                type="number"
                                min="0"
                                step="1"
                                value={row.inStock}
                                aria-label={`${row.ingredient} in stock`}
                                onChange={(event) => {
                                  const next = Math.max(0, Number(event.target.value) || 0);
                                  setStockOnHand((current) => ({ ...current, [row.key]: next }));
                                }}
                              />
                              <span className="text-xs text-[#5c5146]">{row.unit}</span>
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#7d3044] underline"
                                onClick={() =>
                                  setStockOnHand((current) => {
                                    const next = { ...current };
                                    delete next[row.key];
                                    return next;
                                  })
                                }
                              >
                                Clear
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {formatNumber(row.netAmount)} {unitWord(row.netAmount, row.unit)}
                            {row.netPacks === 0 ? (
                              <span className="ml-2 inline-flex rounded-full bg-[#e5f4ea] px-2 py-0.5 text-xs font-bold text-[#1f6b45]">
                                Covered
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-lg font-semibold tabular-nums">{row.netPacks}</td>
                          <td className="px-3 py-3 font-semibold tabular-nums">{gbp(row.netPacks * row.packPrice)}</td>
                        </tr>
                      ))}
                      {visibleStockRows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-[#5c5146]" colSpan={7}>
                            No recipe lines fall in this range.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {ingredientModel.uncovered.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-[#e7c9a1] bg-[#fff8ee] px-4 py-3 text-sm">
                    <p className="font-semibold text-[#6b3208]">No recipe on file</p>
                    <ul className="mt-2 list-disc pl-5 text-[#6b3208]">
                      {ingredientModel.uncovered.map((item) => (
                        <li key={item.name}>
                          {item.quantity}× {item.name} is not in the shop list.
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4">
                <div className="no-print flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={primaryClass}
                    onClick={orderFromMorrisons}
                    disabled={orderList.length === 0}
                  >
                    Order from Morrisons
                  </button>
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={copyShoppingList}
                    disabled={shoppingList.length === 0}
                  >
                    <ClipboardCopy aria-hidden="true" size={16} />
                    {copied ? "Copied" : "Copy shopping list"}
                  </button>
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={downloadShoppingList}
                    disabled={shoppingList.length === 0}
                  >
                    Download shopping-list.json
                  </button>
                </div>
                {orderNote ? <p className="mt-3 text-sm leading-6 text-[#3d342b]">{orderNote}</p> : null}
                <details className="no-print mt-4 rounded-lg border border-[#e4d5c3] bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Userscript setup</summary>
                  <div className="space-y-3 px-4 pb-4 text-sm leading-6 text-[#3d342b]">
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>Install Tampermonkey or Violentmonkey in Chrome.</li>
                      <li>Click Copy userscript code, create a new script, paste, and save.</li>
                      <li>Click Order from Morrisons, then Load from Clipboard in the Morrisons helper. You sign in and pay yourself.</li>
                    </ol>
                    <p>
                      <a className="font-semibold text-[#6b3208] underline" href="/morrisons-helper-test">
                        Open the local dry run
                      </a>{" "}
                      to try the floating panel on mock product and search controls before installing the script in Chrome.
                    </p>
                    <button type="button" className={secondaryClass} onClick={copyUserscript}>
                      <ClipboardCopy aria-hidden="true" size={16} />
                      {scriptCopied ? "Copied" : "Copy userscript code"}
                    </button>
                  </div>
                </details>
                {copyError ? (
                  <p role="alert" className="mt-3 text-sm text-[#8a2b2b]">
                    {copyError}
                  </p>
                ) : null}
                <div className="print-card mt-4 overflow-x-auto rounded-lg border border-[#e4d5c3] bg-white">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-[#eadfce] text-xs tracking-wide text-[#5c5146] uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Ingredient</th>
                        <th className="px-3 py-2 font-semibold">Required</th>
                        <th className="px-3 py-2 font-semibold">In stock</th>
                        <th className="px-3 py-2 font-semibold">Net to buy</th>
                        <th className="px-3 py-2 font-semibold">Trolley packs</th>
                        <th className="px-3 py-2 font-semibold">Morrisons</th>
                        <th className="px-3 py-2 font-semibold">Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shoppingList.map((item) => {
                        const progressKey = trolleyProgressKey(item);
                        const added = trolleyAdded[progressKey] === true;
                        return (
                          <tr key={progressKey} className="border-b border-[#f0e6d8]">
                            <td className="px-3 py-3 font-medium">{item.name}</td>
                            <td className="px-3 py-3 tabular-nums">
                              {formatNumber(item.required)} {unitWord(item.required, item.requiredUnit)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {formatNumber(item.inStock)} {unitWord(item.inStock, item.requiredUnit)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {formatNumber(item.netToBuy)} {unitWord(item.netToBuy, item.requiredUnit)}
                              {item.trolleyPacks === 0 ? (
                                <span className="ml-2 inline-flex rounded-full bg-[#e5f4ea] px-2 py-0.5 text-xs font-bold text-[#1f6b45]">
                                  Covered
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-lg font-semibold tabular-nums">{item.trolleyPacks}</td>
                            <td className="px-3 py-3">
                              {item.trolleyPacks > 0 ? (
                                <a
                                  className="font-semibold text-[#7d3044] underline"
                                  href={item.morrisonsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {isMorrisonsProductUrl(item.morrisonsUrl) ? "Open in Morrisons" : "Search Morrisons"}
                                </a>
                              ) : (
                                <span className="text-[#5c5146]">In stock</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {item.trolleyPacks > 0 ? (
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={added}
                                    aria-label={`Added ${item.name} to trolley`}
                                    onChange={(event) =>
                                      setTrolleyAdded((current) => ({ ...current, [progressKey]: event.target.checked }))
                                    }
                                  />
                                  Added to trolley
                                </label>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                      {shoppingList.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-[#5c5146]" colSpan={7}>
                            No Morrisons packs fall in this range.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#3d342b]">
                  <li>Click Order from Morrisons. Packs still to buy are copied, and groceries.morrisons.com opens in a new tab. Chrome uses its own saved sign-in.</li>
                  <li>In the helper, click Load from Clipboard. A saved product link opens directly. A line without one searches for the item name.</li>
                  <li>Tick Added to trolley here as you go. Checkout and payment stay on the Morrisons site for you to confirm.</li>
                </ol>
                <pre className="print-card mt-4 max-h-[32rem] overflow-auto rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-4 text-xs leading-5">
                  {JSON.stringify(shoppingList, null, 2)}
                </pre>
              </div>
            )}
          </section>
        ) : null}

        {session?.canAccessOpsTabs && tab === "accounts" ? (
          <CorporateAccountsPanel
            orders={orders}
            historicalOrders={historicalOrders}
            catalog={catalog}
            matrix={liveMatrix}
            catalogue={catalogue}
            recipes={editableRecipes}
            bakeSettings={bakeSettings}
            defaultFrom={initialStart}
            defaultTo={initialEnd}
          />
        ) : null}

        {session?.canAccessOpsTabs && tab === "supplies" ? (
          <>
            <CupsDirectBoxes
              catalogue={catalogue}
              stock={stockOnHand}
              onChangeCatalogue={setCatalogue}
              onChangeStock={setStockOnHand}
            />
            <SupplierAdmin catalogue={catalogue} onChangeCatalogue={setCatalogue} />
            <StockAmend catalogue={catalogue} required={requiredStock} stock={stockOnHand} onChange={setStockOnHand} />
          </>
        ) : null}

        {session?.canAccessOpsTabs && tab === "menu" ? (
          <MenuItemsPanel
            catalog={websiteCatalog}
            catalogue={catalogue}
            recipes={editableRecipes}
            orders={orders}
            stock={stockOnHand}
            todayIso={datesReady ? seededStart : ""}
            onChangeRecipes={setEditableRecipes}
            onChangeCatalog={setWebsiteCatalog}
            onChangeCatalogue={setCatalogue}
            onChangeStock={setStockOnHand}
            bakeSettings={bakeSettings}
            onChangeBakeSettings={setBakeSettings}
          />
        ) : null}

        {session?.canAccessOpsTabs && tab === "warnings" ? (
          <WarningsPanel
            orders={orders}
            recipes={editableRecipes}
            catalogue={catalogue}
            stock={stockOnHand}
            catalogItems={websiteCatalog.items}
            todayIso={datesReady ? seededStart : ""}
          />
        ) : null}

        {session?.canAccessOpsTabs && tab === "overheads" ? <OverheadsPanel /> : null}

        {session?.canAccessOpsTabs && tab === "overview" ? (
          <BusinessOverviewPanel
            orders={orders}
            historicalOrders={historicalOrders}
            recipes={editableRecipes}
            catalogue={catalogue}
            bakeSettings={bakeSettings}
            todayIso={datesReady ? seededStart : ""}
            catalogItems={websiteCatalog.items}
            snapshotCoverage={snapshotCoverage}
          />
        ) : null}
      </main>
    </div>
  );
}
