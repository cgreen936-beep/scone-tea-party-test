import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Local copy of the Scone Tea Party website menus.
 * Live refresh uses read-only Wix query calls. It never creates, updates, or deletes anything on Wix.
 * WIX_API_KEY stays in server env and is never returned to the browser.
 */

export const WIX_MENU_SITE_ID = "f60551ee-19a7-4963-973d-519aaeeac55e";
export const WIX_MENU_NAMES = ["Classic Menu", "Christmas Menu", "Christmas Menu 2026"] as const;

const MENUS_URL = "https://www.wixapis.com/restaurants/menus/v1/menus/query";
const ITEMS_URL = "https://www.wixapis.com/restaurants/menus/v1/items/query";
const ALLOWED_URLS = new Set([MENUS_URL, ITEMS_URL]);
const CATALOG_PATH = () => resolve(process.cwd(), "data", "wix-menu-catalog.json");
const PLACEHOLDERS = new Set(["", "PASTE_YOUR_WIX_API_KEY_HERE", "PASTE_YOUR_WIX_API_TOKEN_HERE"]);
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

export interface WixMenuCatalogItem {
  id: string;
  name: string;
  menus: string[];
  sections: string[];
  price: number;
  currency: string;
  visible: boolean;
  duplicateIds: string[];
}

export interface WixMenuCatalog {
  siteId: string;
  storeUrl: string;
  syncedAt: string | null;
  source: "local-seed" | "wix-live-readonly";
  menus: string[];
  items: WixMenuCatalogItem[];
}

export interface MenuSyncResult {
  refreshed: boolean;
  reason: string;
  catalog: WixMenuCatalog;
}

interface RawMenuItem {
  id: string;
  name: string;
  menus: string[];
  sections: string[];
  price: number;
  currency: string;
  visible: boolean;
}

function emptyCatalog(): WixMenuCatalog {
  return {
    siteId: WIX_MENU_SITE_ID,
    storeUrl: "https://www.sconeteaparty.co.uk/",
    syncedAt: null,
    source: "local-seed",
    menus: [...WIX_MENU_NAMES],
    items: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["original", "translated", "name", "label", "value"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["price", "amount", "formattedAmount", "formattedPrice"]) {
    if (record[key] != null) {
      const parsed = money(record[key]);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en-GB"));
}

function isCatalogItem(value: unknown): value is WixMenuCatalogItem {
  const record = asRecord(value);
  if (!record) return false;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    Array.isArray(record.menus) &&
    Array.isArray(record.sections) &&
    typeof record.price === "number" &&
    typeof record.currency === "string" &&
    typeof record.visible === "boolean" &&
    Array.isArray(record.duplicateIds)
  );
}

export function normalizeAndDeduplicateItems(rawItems: RawMenuItem[]): WixMenuCatalogItem[] {
  const grouped = new Map<string, WixMenuCatalogItem>();
  for (const raw of rawItems) {
    const name = raw.name.trim();
    const id = raw.id.trim();
    if (!name || !id) continue;
    const key = name.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id,
        name,
        menus: uniqueSorted(raw.menus),
        sections: uniqueSorted(raw.sections),
        price: Number.isFinite(raw.price) ? Math.round(raw.price * 100) / 100 : 0,
        currency: raw.currency.trim() || "GBP",
        visible: raw.visible,
        duplicateIds: [],
      });
      continue;
    }
    if (!existing.duplicateIds.includes(id) && id !== existing.id) existing.duplicateIds.push(id);
    existing.menus = uniqueSorted([...existing.menus, ...raw.menus]);
    existing.sections = uniqueSorted([...existing.sections, ...raw.sections]);
    if (existing.price <= 0 && raw.price > 0) existing.price = Math.round(raw.price * 100) / 100;
    if (raw.visible) existing.visible = true;
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

export function readLocalMenuCatalog(): WixMenuCatalog {
  try {
    const parsed: unknown = JSON.parse(readFileSync(CATALOG_PATH(), "utf8"));
    const record = asRecord(parsed);
    if (!record || !Array.isArray(record.items)) return emptyCatalog();
    const items = record.items.filter(isCatalogItem);
    const source = record.source === "wix-live-readonly" ? "wix-live-readonly" : "local-seed";
    return {
      siteId: text(record.siteId) || WIX_MENU_SITE_ID,
      storeUrl: text(record.storeUrl) || "https://www.sconeteaparty.co.uk/",
      syncedAt: typeof record.syncedAt === "string" ? record.syncedAt : null,
      source,
      menus: Array.isArray(record.menus) ? record.menus.map((menu) => text(menu)).filter(Boolean) : [...WIX_MENU_NAMES],
      items,
    };
  } catch {
    return emptyCatalog();
  }
}

export function writeLocalMenuCatalog(catalog: WixMenuCatalog): void {
  const path = CATALOG_PATH();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

function keptMenuName(name: string): string | null {
  const cleaned = name.trim().toLowerCase();
  return WIX_MENU_NAMES.find((menu) => menu.toLowerCase() === cleaned) ?? null;
}

function itemPrice(item: Record<string, unknown>): number {
  return money(item.price) ?? money(item.priceInfo) ?? money(asRecord(item.pricing)?.price) ?? 0;
}

function rawItemsFromWix(menus: unknown[], items: unknown[]): RawMenuItem[] {
  const sectionMeta = new Map<string, { menu: string; section: string }>();
  for (const menuValue of menus) {
    const menu = asRecord(menuValue);
    if (!menu) continue;
    const menuName = keptMenuName(text(menu.name));
    if (!menuName) continue;
    const sections = Array.isArray(menu.sections) ? menu.sections : [];
    for (const sectionValue of sections) {
      const section = asRecord(sectionValue);
      if (!section) continue;
      const sectionName = text(section.name) || "Menu";
      const sectionId = text(section.id);
      if (sectionId) sectionMeta.set(sectionId, { menu: menuName, section: sectionName });
      const itemIds = Array.isArray(section.itemIds) ? section.itemIds : [];
      for (const itemId of itemIds) {
        const id = text(itemId);
        if (id) sectionMeta.set(`item:${id}`, { menu: menuName, section: sectionName });
      }
    }
  }

  const raw: RawMenuItem[] = [];
  for (const itemValue of items) {
    const item = asRecord(itemValue);
    if (!item) continue;
    const id = text(item.id);
    const name = text(item.name);
    if (!id || !name) continue;
    const links: Array<{ menu: string; section: string }> = [];
    const direct = sectionMeta.get(`item:${id}`);
    if (direct) links.push(direct);
    const sectionId = text(item.sectionId);
    const bySection = sectionId ? sectionMeta.get(sectionId) : undefined;
    if (bySection) links.push(bySection);
    const namedMenu = keptMenuName(text(item.menuName));
    if (namedMenu) links.push({ menu: namedMenu, section: text(item.sectionName) || "Menu" });
    if (links.length === 0) continue;
    raw.push({
      id,
      name,
      menus: links.map((link) => link.menu),
      sections: links.map((link) => link.section),
      price: itemPrice(item),
      currency: text(item.currency) || "GBP",
      visible: item.visible !== false && item.hidden !== true,
    });
  }
  return raw;
}

function cursorString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readCursor(json: Record<string, unknown>): string | undefined {
  const direct = cursorString(json.nextCursor);
  if (direct) return direct;
  const pagingMeta = json.pagingMetadata ?? json.metadata ?? json.paging;
  const record = asRecord(pagingMeta);
  if (!record) return undefined;
  if (record.hasNext === false) return undefined;
  const cursors = asRecord(record.cursors);
  return cursorString(cursors?.next) ?? cursorString(record.next) ?? cursorString(record.cursor);
}

function assertQueryBody(body: Record<string, unknown>): void {
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== "query") {
    throw new Error("Blocked a Wix call that is not a menu query.");
  }
}

async function queryAll(url: string, token: string, siteId: string, accountId: string, listKey: string): Promise<unknown[]> {
  if (!ALLOWED_URLS.has(url)) throw new Error("That Wix address is not a menu read.");
  const collected: unknown[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const headers: Record<string, string> = {
      Authorization: token,
      "Content-Type": "application/json",
      "wix-site-id": siteId,
    };
    if (accountId) headers["wix-account-id"] = accountId;
    const body = { query: { cursorPaging: cursor ? { limit: PAGE_LIMIT, cursor } : { limit: PAGE_LIMIT } } };
    assertQueryBody(body);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Wix menu read returned ${response.status}.`);
    const json: unknown = await response.json();
    const record = asRecord(json);
    if (!record) throw new Error("Wix menu read returned an empty body.");
    const batch = record[listKey];
    const nested = asRecord(record.data);
    const rows = Array.isArray(batch) ? batch : nested && Array.isArray(nested[listKey]) ? nested[listKey] : null;
    if (!rows) throw new Error("Wix menu read did not include a list.");
    collected.push(...rows);
    const next = readCursor(record);
    if (!next || seen.has(next)) return collected;
    seen.add(next);
    cursor = next;
  }
  throw new Error("Wix menu read did not finish.");
}

export async function syncLiveWixMenuCatalog(): Promise<MenuSyncResult> {
  const current = readLocalMenuCatalog();
  if (process.env.WIX_ALLOW_READONLY_QUERY !== "1") {
    return {
      refreshed: false,
      reason: "This deployment uses the saved menu catalog. No request was sent to Wix.",
      catalog: current,
    };
  }
  const key = process.env.WIX_API_KEY?.trim() ?? "";
  if (PLACEHOLDERS.has(key)) {
    return {
      refreshed: false,
      reason: "WIX_API_KEY is not set on the server. No Wix request was made. The local menu catalog is unchanged.",
      catalog: current,
    };
  }
  const siteId = process.env.WIX_SITE_ID?.trim() || WIX_MENU_SITE_ID;
  const accountId = process.env.WIX_ACCOUNT_ID?.trim() ?? "";
  try {
    const menus = await queryAll(MENUS_URL, key, siteId, accountId, "menus");
    const items = await queryAll(ITEMS_URL, key, siteId, accountId, "items");
    const catalog: WixMenuCatalog = {
      siteId,
      storeUrl: "https://www.sconeteaparty.co.uk/",
      syncedAt: new Date().toISOString(),
      source: "wix-live-readonly",
      menus: [...WIX_MENU_NAMES],
      items: normalizeAndDeduplicateItems(rawItemsFromWix(menus, items)),
    };
    if (catalog.items.length === 0) {
      return {
        refreshed: false,
        reason: "Wix returned no items for Classic Menu, Christmas Menu, or Christmas Menu 2026. The local catalog was left unchanged.",
        catalog: current,
      };
    }
    writeLocalMenuCatalog(catalog);
    return { refreshed: true, reason: `Saved ${catalog.items.length} website items from the three menus.`, catalog };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Wix menu read failed.";
    return {
      refreshed: false,
      reason: `${message} The local catalog was left unchanged.`,
      catalog: current,
    };
  }
}
