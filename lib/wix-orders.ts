/**
 * Local mock of a Wix eCommerce Create Order body.
 * This module never calls fetch, Wix, or any other network API.
 */
import { MOCK_CATALOG, type UnifiedOrder } from "@/lib/mock-data";

/** Catalog app id from WIX_REFERENCE. Sent on each line's catalogReference. */
const CATALOG_APP_ID = "9a5d83fd-8570-482e-81ab-cfa88942ee60";

export const MOCK_WIX_DISPATCH_LIMIT = 5;
const MAX_DISPATCHES = MOCK_WIX_DISPATCH_LIMIT;
const WINDOW_MS = 60 * 60 * 1000;

const dispatchTimestamps: number[] = [];

export interface WixMoney {
  amount: string;
  formattedAmount: string;
}

export interface WixOrderPayload {
  order: {
    channelInfo: { type: "BACKOFFICE_MERCHANT" };
    paymentStatus: "NOT_PAID";
    status: "APPROVED";
    currency: "GBP";
    buyerLanguage: "en";
    buyerNote: string;
    buyerInfo: { email: string };
    billingInfo: {
      contactDetails: { firstName: string; lastName: string; phone: string };
      address: { addressLine: string; country: "GB" };
    };
    shippingInfo: {
      title: string;
      logistics: {
        deliveryTime: string;
        shippingDestination: {
          address: { addressLine: string; country: "GB" };
          contactDetails: { firstName: string; lastName: string; phone: string };
        };
      };
    };
    lineItems: Array<{
      quantity: number;
      itemType: { preset: "PHYSICAL" };
      productName: { original: string };
      catalogReference: {
        catalogItemId: string;
        appId: typeof CATALOG_APP_ID;
        options: Record<string, string>;
      };
      price: WixMoney;
      lineTotal: WixMoney;
      descriptionLines: Array<{
        name: { original: string };
        plainText: { original: string };
      }>;
    }>;
    priceSummary: {
      subtotal: WixMoney;
      shipping: WixMoney;
      tax: WixMoney;
      discount: WixMoney;
      total: WixMoney;
    };
    customFields: Array<{ title: string; value: string }>;
  };
}

export interface MockDispatchSuccess {
  ok: true;
  mode: "LOCAL_MOCK";
  order: UnifiedOrder;
  payload: WixOrderPayload;
  callsUsed: number;
  callsRemaining: number;
  dispatchedAt: string;
}

export interface MockDispatchBlocked {
  ok: false;
  mode: "LOCAL_MOCK";
  error: string;
  callsUsed: number;
  callsRemaining: number;
}

export type MockDispatchResult = MockDispatchSuccess | MockDispatchBlocked;

export function getMockWixDispatchQuota(now = Date.now()): {
  used: number;
  remaining: number;
  limit: number;
} {
  const used = dispatchTimestamps.filter((stamp) => now - stamp < WINDOW_MS).length;
  return { used, remaining: Math.max(0, MAX_DISPATCHES - used), limit: MAX_DISPATCHES };
}

/**
 * Wix marks a £0.00 order as paid on its own. Keep every line price and the
 * merchandise total at 0.01 or more so an unpaid invoice cannot flip to PAID.
 */
function toWixAmount(value: number): WixMoney {
  const safe = Number.isFinite(value) ? value : 0;
  const amount = Math.max(safe, 0.01).toFixed(2);
  return { amount, formattedAmount: `£${amount}` };
}

function zeroAmount(): WixMoney {
  return { amount: "0.00", formattedAmount: "£0.00" };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function buildWixCreateOrderPayload(order: UnifiedOrder): WixOrderPayload {
  const contact = splitName(order.contactName);
  const contactDetails = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: order.contactPhone,
  };
  const address = { addressLine: order.deliveryAddress, country: "GB" as const };

  let subtotalNumber = 0;
  const lineItems: WixOrderPayload["order"]["lineItems"] = order.lineItems.map((line) => {
    const unitPrice = Math.max(Number.isFinite(line.unitPrice) ? line.unitPrice : 0, 0.01);
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    const lineTotal = unitPrice * Math.max(quantity, 0);
    subtotalNumber += lineTotal;

    const options: Record<string, string> = {};
    if (line.variant) options.variant = line.variant;
    for (const [name, value] of Object.entries(line.modifiers ?? {})) {
      options[name] = value;
    }

    const descriptionLines = Object.entries(options).map(([name, value]) => ({
      name: { original: name === "variant" ? "Option" : name },
      plainText: { original: value },
    }));
    if (line.specialInstructions?.trim()) {
      descriptionLines.push({
        name: { original: "Special instructions" },
        plainText: { original: line.specialInstructions.trim() },
      });
    }

    return {
      quantity,
      itemType: { preset: "PHYSICAL" as const },
      productName: { original: line.name },
      catalogReference: {
        catalogItemId: line.catalogItemId,
        appId: CATALOG_APP_ID,
        options,
      },
      price: toWixAmount(unitPrice),
      lineTotal: toWixAmount(lineTotal),
      descriptionLines,
    };
  });

  const merchandise = lineItems.length === 0 ? 0.01 : Math.max(subtotalNumber, 0.01);
  const noteLines = [
    order.companyName ? `Company: ${order.companyName}` : null,
    order.poReference ? `PO: ${order.poReference}` : null,
    "Payment terms: Invoice later. Leave this order NOT_PAID.",
    order.fulfillment === "COLLECTION" ? "Fulfillment: Collection (Knutton)" : "Fulfillment: Delivery",
    order.dietaryNotes ? `Dietary: ${order.dietaryNotes}` : null,
  ].filter((line): line is string => Boolean(line));

  const customFields = [
    { title: "Local Order Id", value: order.id },
    { title: "Company", value: order.companyName ?? "" },
    { title: "PO Reference", value: order.poReference ?? "" },
    { title: "Delivery Window", value: order.deliveryWindow },
    { title: "Fulfillment", value: order.fulfillment === "COLLECTION" ? "Collection (Knutton)" : "Delivery" },
    { title: "Payment Terms", value: "Invoice Later" },
    { title: "Source", value: order.source },
  ].filter((field) => field.value.trim() !== "");

  return {
    order: {
      channelInfo: { type: "BACKOFFICE_MERCHANT" },
      paymentStatus: "NOT_PAID",
      status: "APPROVED",
      currency: "GBP",
      buyerLanguage: "en",
      buyerNote: noteLines.join("\n"),
      buyerInfo: { email: order.contactEmail },
      billingInfo: { contactDetails, address },
      shippingInfo: {
        title: order.fulfillment === "COLLECTION" ? "Collection (Knutton)" : "Local delivery",
        logistics: {
          deliveryTime: `${order.deliveryDate} ${order.deliveryWindow}`.trim(),
          shippingDestination: { address, contactDetails },
        },
      },
      lineItems,
      priceSummary: {
        subtotal: toWixAmount(merchandise),
        shipping: zeroAmount(),
        tax: zeroAmount(),
        discount: zeroAmount(),
        total: toWixAmount(merchandise),
      },
      customFields,
    },
  };
}

function recentDispatches(now: number): number[] {
  return dispatchTimestamps.filter((stamp) => now - stamp < WINDOW_MS);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fieldText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["original", "translated", "name"]) {
    const inner = record[key];
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return "";
}

function isoDate(value: unknown): string {
  const match = fieldText(value).match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

function personName(value: unknown): string {
  const record = asRecord(value);
  if (!record) return fieldText(value);
  return (
    fieldText(record.fullName) ||
    [fieldText(record.firstName), fieldText(record.lastName)].filter(Boolean).join(" ")
  );
}

function addressText(value: unknown): string {
  const record = asRecord(value);
  if (!record) return fieldText(value);
  const parts = [
    fieldText(record.addressLine),
    fieldText(record.addressLine2),
    fieldText(record.city),
    fieldText(record.postalCode) || fieldText(record.zipCode),
  ].filter(Boolean);
  return parts.join(", ");
}

function customField(order: Record<string, unknown>, hints: string[]): string {
  if (!Array.isArray(order.customFields)) return "";
  for (const field of order.customFields) {
    const record = asRecord(field);
    if (!record) continue;
    const title = (fieldText(record.title) || fieldText(record.name)).toLowerCase();
    if (!hints.some((hint) => title.includes(hint))) continue;
    const value = fieldText(record.value) || fieldText(asRecord(record.value)?.stringValue);
    if (value) return value;
  }
  return "";
}

function moneyAmount(value: unknown): number {
  const record = asRecord(value);
  const raw = record ? fieldText(record.amount) : fieldText(value);
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
}

function lineFromWix(raw: unknown): UnifiedOrder["lineItems"][number] | null {
  const record = asRecord(raw);
  if (!record) return null;
  const name = fieldText(record.productName) || fieldText(record.name) || "Item";
  const parsedQty = typeof record.quantity === "number" ? record.quantity : Number(record.quantity);
  const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? Math.round(parsedQty) : 1;
  const catalog = asRecord(record.catalogReference);
  const named = MOCK_CATALOG.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const catalogItemId =
    fieldText(catalog?.catalogItemId) || fieldText(record.catalogItemId) || named?.id || fieldText(record.id) || name;
  const modifiers: Record<string, string> = {};
  const notes: string[] = [];
  if (Array.isArray(record.descriptionLines)) {
    for (const line of record.descriptionLines) {
      const entry = asRecord(line);
      if (!entry) continue;
      const label = fieldText(entry.name) || "Option";
      const plain = asRecord(entry.plainText);
      const value = fieldText(entry.plainText) || fieldText(plain?.original) || fieldText(entry.description);
      if (!value) continue;
      if (/note|allerg/i.test(label)) notes.push(value);
      else modifiers[label] = value;
    }
  }
  const variant = modifiers.Size || modifiers.Variant || modifiers["Price variant"];
  return {
    catalogItemId,
    name,
    variant,
    quantity,
    unitPrice: moneyAmount(record.price ?? record.priceBeforeDiscounts),
    modifiers: Object.keys(modifiers).length > 0 ? modifiers : undefined,
    specialInstructions: notes.join("; ") || undefined,
  };
}

/** Inclusive end of the open delivery window loaded onto the schedule. */
export const WIX_DELIVERY_SLOT_UNTIL = "2026-12-27T23:59:59Z";
export const WIX_SCHEDULE_FROM = "2026-11-26";
export const WIX_SCHEDULE_UNTIL = "2026-12-27";

function clockTime(value: unknown): string {
  const raw = fieldText(value);
  const matched = raw.match(/T(\d{2}:\d{2})/) ?? raw.match(/\b(\d{1,2}:\d{2})\b/);
  return matched?.[1] ?? "";
}

function slotBounds(order: Record<string, unknown>): { from: string; to: string } {
  const shipping = asRecord(order.shippingInfo);
  const logistics = asRecord(shipping?.logistics);
  const slot = asRecord(logistics?.deliveryTimeSlot) ?? asRecord(order.deliveryTimeSlot);
  return {
    from: fieldText(slot?.from) || fieldText(order.slotFrom),
    to: fieldText(slot?.to) || fieldText(order.slotTo),
  };
}

function normalizeWixOrder(raw: unknown, windowEnd = WIX_DELIVERY_SLOT_UNTIL): UnifiedOrder | null {
  const order = asRecord(raw);
  if (!order) return null;
  if (fieldText(order.fulfillmentStatus).toUpperCase() !== "NOT_FULFILLED") return null;
  const bounds = slotBounds(order);
  const slotMillis = Date.parse(bounds.from);
  const windowMillis = Date.parse(windowEnd);
  if (!bounds.from || Number.isNaN(slotMillis) || (!Number.isNaN(windowMillis) && slotMillis > windowMillis)) return null;
  const status = fieldText(order.status).toUpperCase();
  if (status === "REJECTED") return null;

  const id = fieldText(order.id);
  if (!id) return null;
  const number = fieldText(order.number);
  const displayId = number ? `WIX-${number}` : `WIX-${id.slice(0, 8)}`;

  const shipping = asRecord(order.shippingInfo);
  const logistics = asRecord(shipping?.logistics);
  const destination = asRecord(logistics?.shippingDestination);
  const pickup = asRecord(logistics?.pickupDetails);
  const billing = asRecord(order.billingInfo);
  const buyer = asRecord(order.buyerInfo);
  const contact =
    asRecord(destination?.contactDetails) ??
    asRecord(pickup?.contactDetails) ??
    asRecord(billing?.contactDetails) ??
    asRecord(order.recipientInfo);

  const deliveryDate = isoDate(bounds.from);
  const scheduleUntil = isoDate(windowEnd) || WIX_SCHEDULE_UNTIL;
  if (!deliveryDate || deliveryDate > scheduleUntil) return null;

  const fromClock = clockTime(bounds.from);
  const toClock = clockTime(bounds.to);
  const deliveryWindow = fromClock && toClock ? `${fromClock} - ${toClock}` : fromClock || "Unscheduled";

  const shippingAddress = addressText(destination?.address);
  const pickupAddress = addressText(pickup?.address) || addressText(order.pickupAddress);
  const billingAddress = addressText(billing?.address);
  const flatAddress = addressText(order.address);
  const statedFulfillment = fieldText(order.fulfillmentType).toLowerCase();
  const fulfillmentHint = `${fieldText(shipping?.title)} ${fieldText(shipping?.code)} ${shippingAddress} ${pickupAddress} ${fieldText(logistics?.instructions)}`.toLowerCase();
  const fulfillment: UnifiedOrder["fulfillment"] =
    statedFulfillment === "pickup" || statedFulfillment === "collection" || pickup || /collect|pickup|pick-up|knutton/.test(fulfillmentHint)
      ? "COLLECTION"
      : statedFulfillment === "delivery" || shippingAddress || billingAddress || flatAddress
        ? "DELIVERY"
        : undefined;
  const deliveryAddress =
    fulfillment === "COLLECTION"
      ? pickupAddress || shippingAddress || "Collection (Knutton)"
      : flatAddress || shippingAddress || billingAddress || "Address not on the snapshot";

  const contactName = fieldText(order.buyerName) || personName(contact) || fieldText(order.buyerEmail || buyer?.email).split("@")[0] || "Wix customer";
  const companyName =
    customField(order, ["company", "organisation", "organization"]) ||
    fieldText(asRecord(billing?.contactDetails)?.company) ||
    undefined;
  const payment = fieldText(order.paymentStatus).toUpperCase();
  const notes = [
    fieldText(order.buyerNote),
    customField(order, ["allerg", "dietary", "note"]),
    payment === "PARTIALLY_REFUNDED" ? "Payment partially refunded" : "",
  ].filter(Boolean);

  const lineItems = Array.isArray(order.lineItems)
    ? order.lineItems.map(lineFromWix).filter((line): line is UnifiedOrder["lineItems"][number] => Boolean(line))
    : [];

  return {
    id: displayId,
    source: "WIX_BOOKING",
    poReference: number ? `Wix ${number}` : undefined,
    companyName,
    contactName,
    contactEmail: fieldText(order.buyerEmail) || fieldText(buyer?.email) || fieldText(contact?.email) || "",
    contactPhone:
      fieldText(contact?.phone) ||
      fieldText(asRecord(contact?.phone)?.number) ||
      fieldText(asRecord(contact?.phone)?.phone) ||
      "",
    deliveryAddress,
    deliveryDate,
    deliveryWindow,
    paymentStatus: payment === "PAID" || payment === "PARTIALLY_REFUNDED" ? "PAID" : "NOT_PAID",
    orderStatus: status === "CANCELED" || status === "CANCELLED" ? "CANCELED" : undefined,
    fulfillment,
    dietaryNotes: notes.join(" · ") || undefined,
    lineItems:
      lineItems.length > 0
        ? lineItems
        : [{ catalogItemId: id, name: "No line items on the snapshot", quantity: 1, unitPrice: 0 }],
  };
}

/**
 * Turns raw Wix eCom orders from a local snapshot into schedule rows.
 * Keeps NOT_FULFILLED orders whose delivery slot starts on or before
 * 2026-12-27T23:59:59Z. Canceled rows stay marked so prep can skip them.
 * Does not call Wix.
 */
function isSavedBooking(value: unknown): value is UnifiedOrder {
  const record = asRecord(value);
  if (!record || record.source !== "WIX_BOOKING") return false;
  if (typeof record.id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.deliveryDate))) return false;
  if (typeof record.contactName !== "string" || !Array.isArray(record.lineItems)) return false;
  return record.lineItems.every((line) => {
    const item = asRecord(line);
    return Boolean(
      item &&
        typeof item.catalogItemId === "string" &&
        typeof item.name === "string" &&
        typeof item.quantity === "number",
    );
  });
}

function normalizeRawOrders(rawOrders: unknown[], windowEnd = WIX_DELIVERY_SLOT_UNTIL): UnifiedOrder[] {
  const taken = new Set<string>();
  const booked: UnifiedOrder[] = [];
  for (const raw of rawOrders) {
    const order = normalizeWixOrder(raw, windowEnd);
    if (!order) continue;
    let id = order.id;
    if (taken.has(id)) {
      const rawId = fieldText(asRecord(raw)?.id).slice(0, 8);
      id = rawId ? `${order.id}-${rawId}` : `${order.id}-${booked.length + 1}`;
    }
    taken.add(id);
    booked.push(id === order.id ? order : { ...order, id });
  }
  return booked;
}

/** Raw orders that belong on the schedule: unfulfilled, slot on or before the cutoff. */
export function scheduleRawOrders(rawOrders: unknown[], windowEnd = WIX_DELIVERY_SLOT_UNTIL): unknown[] {
  return rawOrders.filter((raw) => normalizeWixOrder(raw, windowEnd) !== null);
}

export function bookedOrdersFromSnapshot(snapshot: unknown): UnifiedOrder[] {
  const record = asRecord(snapshot);
  if (!record) return [];
  const windowEnd = fieldText(record.windowEnd) || WIX_DELIVERY_SLOT_UNTIL;
  const scheduleUntil = isoDate(windowEnd) || WIX_SCHEDULE_UNTIL;
  if (Array.isArray(record.orders) && record.orders.length > 0) return normalizeRawOrders(record.orders, windowEnd);
  if (Array.isArray(record.bookedOrders)) {
    return record.bookedOrders.filter(isSavedBooking).filter((order) => order.deliveryDate <= scheduleUntil);
  }
  return [];
}

/** Local session orders stay in place. Snapshot rows are appended when the id is new. */
export function mergeBookedOrders(local: UnifiedOrder[], booked: UnifiedOrder[]): UnifiedOrder[] {
  const taken = new Set(local.map((order) => order.id));
  return [...local, ...booked.filter((order) => order.id && !taken.has(order.id))];
}

/**
 * Records a local dispatch and returns the Create Order body.
 * Does not send the order anywhere.
 */
export function dispatchMockWixOrder(order: UnifiedOrder): MockDispatchResult {
  const now = Date.now();
  const recent = recentDispatches(now);
  dispatchTimestamps.length = 0;
  dispatchTimestamps.push(...recent);

  if (dispatchTimestamps.length >= MAX_DISPATCHES) {
    return {
      ok: false,
      mode: "LOCAL_MOCK",
      error: "Mock Wix dispatch blocked: maximum 5 calls per rolling 60-minute window.",
      callsUsed: dispatchTimestamps.length,
      callsRemaining: 0,
    };
  }

  dispatchTimestamps.push(now);
  return {
    ok: true,
    mode: "LOCAL_MOCK",
    order,
    payload: buildWixCreateOrderPayload(order),
    callsUsed: dispatchTimestamps.length,
    callsRemaining: MAX_DISPATCHES - dispatchTimestamps.length,
    dispatchedAt: new Date(now).toISOString(),
  };
}
