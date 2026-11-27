import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UnifiedOrder } from "@/lib/mock-data";
import { bookedOrdersFromSnapshot } from "@/lib/wix-orders";

export interface WixSnapshotCoverage {
  state: "missing" | "unreadable" | "loaded";
  pulledAt?: string;
  rawOrderCount: number;
  unfulfilledCount: number;
  fulfilledCount: number;
  canceledCount: number;
  createdFrom: string;
  createdUntil: string;
  slotFrom: string;
  slotUntil: string;
  statedTotal: number;
  fulfilledFromApril: number;
  linesMissingPrice: number;
}

export interface WixSnapshotStatus {
  state: "missing" | "unreadable" | "loaded";
  pulledAt?: string;
  rawOrderCount: number;
  openCount: number;
  canceledCount: number;
  orders: UnifiedOrder[];
  coverage: WixSnapshotCoverage;
}

const EMPTY_COVERAGE: WixSnapshotCoverage = {
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
};

const EMPTY: WixSnapshotStatus = {
  state: "missing",
  rawOrderCount: 0,
  openCount: 0,
  canceledCount: 0,
  orders: [],
  coverage: EMPTY_COVERAGE,
};

function isoDay(value: unknown): string {
  const text = typeof value === "string" ? value.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function statedMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const amount = (value as { amount?: unknown }).amount;
    return statedMoney(amount);
  }
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function coverageFromSnapshot(parsed: unknown, state: WixSnapshotCoverage["state"]): WixSnapshotCoverage {
  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  const orders = record && Array.isArray(record.orders) ? record.orders : [];
  const coverage: WixSnapshotCoverage = {
    ...EMPTY_COVERAGE,
    state,
    pulledAt: record && typeof record.pulledAt === "string" ? record.pulledAt : undefined,
    rawOrderCount: orders.length,
  };
  for (const raw of orders) {
    if (!raw || typeof raw !== "object") continue;
    const order = raw as Record<string, unknown>;
    const fulfillment = String(order.fulfillmentStatus ?? "").toUpperCase();
    if (fulfillment === "FULFILLED") coverage.fulfilledCount += 1;
    if (fulfillment === "NOT_FULFILLED") coverage.unfulfilledCount += 1;
    if (String(order.status ?? "").toUpperCase() === "CANCELED") coverage.canceledCount += 1;
    const created = isoDay(order.createdDate);
    const slot = isoDay(order.slotFrom);
    if (created && (!coverage.createdFrom || created < coverage.createdFrom)) coverage.createdFrom = created;
    if (created && created > coverage.createdUntil) coverage.createdUntil = created;
    if (slot && (!coverage.slotFrom || slot < coverage.slotFrom)) coverage.slotFrom = slot;
    if (slot && slot > coverage.slotUntil) coverage.slotUntil = slot;
    const dated = slot || created;
    if (fulfillment === "FULFILLED" && dated >= "2026-04-01") coverage.fulfilledFromApril += 1;
    coverage.statedTotal += statedMoney(order.total ?? order.priceSummary);
    const lines = Array.isArray(order.lineItems) ? order.lineItems : [];
    for (const line of lines) {
      if (!line || typeof line !== "object") {
        coverage.linesMissingPrice += 1;
        continue;
      }
      const price = statedMoney((line as { price?: unknown; unitPrice?: unknown }).price ?? (line as { unitPrice?: unknown }).unitPrice);
      if (price <= 0) coverage.linesMissingPrice += 1;
    }
  }
  coverage.statedTotal = Math.round(coverage.statedTotal * 100) / 100;
  return coverage;
}

/**
 * Reads booked orders already saved in data/wix-snapshot.json.
 * This never calls Wix. A missing or unusable file is reported so the schedule
 * can say the snapshot has not been pulled yet.
 */
export function loadWixBookedOrders(): WixSnapshotStatus {
  const path = resolve(process.cwd(), "data", "wix-snapshot.json");
  if (!existsSync(path)) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const orders = bookedOrdersFromSnapshot(parsed);
    const record =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    const rawOrderCount = record && Array.isArray(record.orders) ? record.orders.length : orders.length;
    const pulledAt = record && typeof record.pulledAt === "string" ? record.pulledAt : undefined;
    const canceledCount = orders.filter((order) => order.orderStatus === "CANCELED").length;
    return {
      state: "loaded",
      pulledAt,
      rawOrderCount,
      openCount: orders.length - canceledCount,
      canceledCount,
      orders,
      coverage: coverageFromSnapshot(parsed, "loaded"),
    };
  } catch {
    return { ...EMPTY, state: "unreadable", coverage: { ...EMPTY_COVERAGE, state: "unreadable" } };
  }
}
