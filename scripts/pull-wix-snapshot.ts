/**
 * Read-only Wix snapshot.
 *
 * Posts only to the menus query, items query, and orders search endpoints.
 * Never calls create, update, delete, checkout, or any other write route.
 * Writes the result to data/wix-snapshot.json on this machine.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bookedOrdersFromSnapshot, scheduleRawOrders, WIX_DELIVERY_SLOT_UNTIL } from "../lib/wix-orders";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const MENUS_URL = "https://www.wixapis.com/restaurants/menus/v1/menus/query";
const ITEMS_URL = "https://www.wixapis.com/restaurants/menus/v1/items/query";
const ORDERS_URL = "https://www.wixapis.com/ecom/v1/orders/search";

const ALLOWED_URLS = new Set([MENUS_URL, ITEMS_URL, ORDERS_URL]);
const DEFAULT_SITE_ID = "f60551ee-19a7-4963-973d-519aaeeac55e";
const PLACEHOLDER_TOKEN = "PASTE_YOUR_WIX_API_TOKEN_HERE";
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

interface SourceError {
  source: string;
  message: string;
}

interface WixSnapshot {
  pulledAt: string;
  siteId: string;
  storeUrl: string;
  source: string;
  windowEnd: string;
  pendingOrdersCount: number;
  counts: { menus: number; items: number; orders: number; bookedOrders: number };
  menus: unknown[];
  items: unknown[];
  orders: unknown[];
  bookedOrders: ReturnType<typeof bookedOrdersFromSnapshot>;
  mediaMap: Record<string, string>;
  errors: SourceError[];
}

function loadEnvLocal(): void {
  const envPath = resolve(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalised = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = normalised.indexOf("=");
    if (eq <= 0) continue;
    const key = normalised.slice(0, eq).trim();
    let value = normalised.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const existing = process.env[key];
    if (existing !== undefined && existing.trim() !== "") continue;
    process.env[key] = value;
  }
}

function paging(cursor?: string): { limit: number; cursor?: string } {
  return cursor ? { limit: PAGE_LIMIT, cursor } : { limit: PAGE_LIMIT };
}

function cursorString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCursor(json: Record<string, unknown>): string | undefined {
  const direct = cursorString(json.nextCursor);
  if (direct) return direct;
  const pagingMeta = json.pagingMetadata ?? json.metadata ?? json.paging;
  if (!pagingMeta || typeof pagingMeta !== "object" || Array.isArray(pagingMeta)) return undefined;
  const record = pagingMeta as Record<string, unknown>;
  if (record.hasNext === false) return undefined;
  const cursors = record.cursors;
  if (!cursors || typeof cursors !== "object" || Array.isArray(cursors)) {
    return cursorString(record.next) ?? cursorString(record.cursor);
  }
  return cursorString((cursors as Record<string, unknown>).next);
}

function extractList(json: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = json[key];
  if (Array.isArray(value)) return value;
  const nested = asRecord(json.data);
  if (nested && Array.isArray(nested[key])) return nested[key];
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function imageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//")) return undefined;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return undefined;
}

function nestedUrl(value: unknown): string | undefined {
  return imageUrl(asRecord(value)?.url);
}

/**
 * Reads the first usable image from the shapes Wix menu and catalog items use.
 * Returns nothing when none of those paths hold an http(s) or root-relative URL.
 */
export function extractItemImageUrl(item: unknown): string | undefined {
  const record = asRecord(item);
  if (!record) return undefined;
  const media = asRecord(record.media);
  const mainMedia = asRecord(media?.mainMedia);
  const additional = Array.isArray(record.additionalImages) ? record.additionalImages[0] : undefined;
  const images = Array.isArray(record.images) ? record.images[0] : undefined;
  return (
    nestedUrl(record.image) ||
    nestedUrl(mainMedia?.image) ||
    nestedUrl(additional) ||
    imageUrl(additional) ||
    nestedUrl(images) ||
    imageUrl(images)
  );
}

function itemName(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["original", "translated", "name"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function buildMediaMap(items: unknown[]): Record<string, string> {
  const mediaMap: Record<string, string> = {};
  for (const item of items) {
    const url = extractItemImageUrl(item);
    const record = asRecord(item);
    if (!url || !record) continue;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = itemName(record.name);
    if (id && !mediaMap[id]) mediaMap[id] = url;
    if (name && !mediaMap[name]) mediaMap[name] = url;
  }
  return mediaMap;
}

async function queryAll(
  url: string,
  token: string,
  siteId: string,
  listKey: string,
  bodyForCursor: (cursor?: string) => Record<string, unknown>,
): Promise<unknown[]> {
  if (!ALLOWED_URLS.has(url)) {
    throw new Error(`Blocked a call that is not a read-only query: ${url}`);
  }
  const probe = bodyForCursor(undefined);
  const probeKeys = Object.keys(probe);
  if (probeKeys.length !== 1 || (probeKeys[0] !== "search" && probeKeys[0] !== "query")) {
    throw new Error("Blocked a Wix call that is not a search or query.");
  }

  const collected: unknown[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "wix-site-id": siteId,
      },
      body: JSON.stringify(bodyForCursor(cursor)),
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}.`);
    }

    const json: unknown = await response.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error(`${url} returned a response that was not an object.`);
    }

    const record = json as Record<string, unknown>;
    const batch = extractList(record, listKey);
    if (!batch) {
      throw new Error(`${url} response had no ${listKey} list.`);
    }
    collected.push(...batch);
    console.log(`${listKey} page ${page}: ${batch.length} (running total ${collected.length})`);

    const next = readCursor(record);
    if (!next || seenCursors.has(next)) return collected;
    seenCursors.add(next);
    cursor = next;
  }

  throw new Error(`${url} did not finish after ${MAX_PAGES} pages.`);
}

async function querySource(
  source: string,
  url: string,
  token: string,
  siteId: string,
  listKey: string,
  bodyForCursor: (cursor?: string) => Record<string, unknown>,
): Promise<{ rows: unknown[]; error?: SourceError }> {
  try {
    const rows = await queryAll(url, token, siteId, listKey, bodyForCursor);
    return { rows };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : `${source} request failed.`;
    console.error(`${source}: ${message}`);
    return { rows: [], error: { source, message } };
  }
}

function leaveExistingSnapshot(reason: string): never {
  const outputPath = resolve(PROJECT_ROOT, "data", "wix-snapshot.json");
  console.error(reason);
  if (existsSync(outputPath)) {
    console.error("Existing data/wix-snapshot.json was left unchanged.");
  }
  process.exit(1);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const token = process.env.WIX_API_TOKEN?.trim();
  const windowEnd = process.env.WIX_SNAPSHOT_WINDOW_END?.trim() || WIX_DELIVERY_SLOT_UNTIL;
  if (!token || token === PLACEHOLDER_TOKEN) {
    leaveExistingSnapshot("Missing valid WIX_API_TOKEN in .env.local. No Wix request was made.");
  }

  const siteId = process.env.WIX_SITE_ID?.trim() || DEFAULT_SITE_ID;

  const menusResult = await querySource(MENUS_URL, MENUS_URL, token, siteId, "menus", (cursor) => ({
    query: { cursorPaging: paging(cursor) },
  }));
  const itemsResult = await querySource(ITEMS_URL, ITEMS_URL, token, siteId, "items", (cursor) => ({
    query: { cursorPaging: paging(cursor) },
  }));
  const everyOrder = (cursor?: string) => ({
    search: {
      sort: [{ fieldName: "createdDate", order: "DESC" }],
      cursorPaging: paging(cursor),
    },
  });
  const filteredOrders = await querySource(ORDERS_URL, ORDERS_URL, token, siteId, "orders", (cursor) => ({
    search: {
      filter: { fulfillmentStatus: { $eq: "NOT_FULFILLED" } },
      sort: [{ fieldName: "createdDate", order: "DESC" }],
      cursorPaging: paging(cursor),
    },
  }));
  let ordersResult = filteredOrders;
  if (filteredOrders.error || filteredOrders.rows.length === 0) {
    const fullOrders = await querySource(ORDERS_URL, ORDERS_URL, token, siteId, "orders", everyOrder);
    if (!fullOrders.error && (filteredOrders.error || fullOrders.rows.length > 0)) {
      console.log(
        filteredOrders.error
          ? "Orders filter was rejected. Paged every order instead, then kept NOT_FULFILLED locally."
          : "Filtered order search returned no rows. Paged every order and kept NOT_FULFILLED locally.",
      );
      ordersResult = fullOrders;
    }
  }

  const errors = [menusResult.error, itemsResult.error, ordersResult.error].filter(
    (error): error is SourceError => Boolean(error),
  );
  if (ordersResult.error) {
    leaveExistingSnapshot("Orders search failed. data/wix-snapshot.json was not written. Menu endpoints are optional.");
  }

  const menus = menusResult.rows;
  const items = itemsResult.rows;
  const orders = scheduleRawOrders(ordersResult.rows, windowEnd);
  const mediaMap = buildMediaMap(items);
  const bookedOrders = bookedOrdersFromSnapshot({ orders, windowEnd });
  const openBookings = bookedOrders.filter((order) => order.orderStatus !== "CANCELED").length;
  const canceledBookings = bookedOrders.length - openBookings;
  const pendingOrdersCount = ordersResult.rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const status = (row as { status?: unknown }).status;
    return typeof status === "string" && status.toUpperCase() === "PENDING";
  }).length;
  const snapshot: WixSnapshot = {
    pulledAt: new Date().toISOString(),
    siteId,
    storeUrl: "https://www.sconeteaparty.co.uk/",
    source: "wix-live-readonly-snapshot",
    windowEnd,
    pendingOrdersCount,
    counts: {
      menus: menus.length,
      items: items.length,
      orders: orders.length,
      bookedOrders: bookedOrders.length,
    },
    menus,
    items,
    orders,
    bookedOrders,
    mediaMap,
    errors,
  };

  const outputPath = resolve(PROJECT_ROOT, "data", "wix-snapshot.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `Wrote data/wix-snapshot.json (menus ${snapshot.counts.menus}, items ${snapshot.counts.items}, orders ${snapshot.counts.orders}, open unfulfilled through ${WIX_DELIVERY_SLOT_UNTIL}: ${openBookings}, canceled marked and excluded from prep: ${canceledBookings}, images ${Object.keys(mediaMap).length}, source errors ${errors.length}).`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Snapshot failed.";
  console.error(message);
  process.exit(1);
});
