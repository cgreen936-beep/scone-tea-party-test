import { foodCatalogueId, type CatalogueItem, type SupplyUnit } from "@/lib/costing";
import { isMorrisonsProductUrl } from "@/lib/morrisons-url";

export { isMorrisonsProductUrl, morrisonsSearchUrl, resolveMorrisonsUrl, savedMorrisonsProductUrl } from "@/lib/morrisons-url";

const UNITS = new Set<SupplyUnit>(["g", "ml", "loaves", "units"]);

export interface MorrisonsPackInput {
  name: string;
  packSize: number;
  price: number;
  url: string;
  unit: SupplyUnit;
  packLabel: string;
}

export interface MorrisonsImportResult {
  items: MorrisonsPackInput[];
  errors: string[];
}

export function parseMorrisonsImport(source: string): MorrisonsImportResult {
  const trimmed = source.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { items: [], errors: ["The file is empty."] };
  try {
    return normalizeRows(trimmed.startsWith("{") || trimmed.startsWith("[") ? rowsFromJson(trimmed) : rowsFromCsv(trimmed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the file.";
    return { items: [], errors: [message] };
  }
}

export function mergeMorrisonsPacks(
  existing: MorrisonsPackInput[],
  incoming: MorrisonsPackInput[],
): { items: MorrisonsPackInput[]; added: number; updated: number } {
  const items = existing.map((item) => ({ ...item }));
  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const index = items.findIndex((entry) => samePack(entry, item));
    if (index === -1) {
      items.push({ ...item });
      added += 1;
      continue;
    }
    items[index] = { ...item };
    updated += 1;
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "en-GB") || a.packLabel.localeCompare(b.packLabel, "en-GB"));
  return { items, added, updated };
}

export function morrisonsPacksToCatalogue(items: MorrisonsPackInput[]): CatalogueItem[] {
  return items.map((item) => ({
    id: foodCatalogueId(item.packLabel),
    name: item.name,
    channel: "morrisons",
    supplier: "Morrisons",
    unit: item.unit,
    packSize: item.packSize,
    packLabel: item.packLabel,
    cost: item.price,
    morrisonsUrl: item.url,
  }));
}

export function mergeMorrisonsCatalogue(catalogue: CatalogueItem[], imported: CatalogueItem[]): CatalogueItem[] {
  if (imported.length === 0) return catalogue;
  const next = catalogue.map((item) => ({ ...item }));
  for (const item of imported) {
    const index = next.findIndex((entry) => entry.channel === "morrisons" && sameCataloguePack(entry, item));
    if (index === -1) {
      next.push({ ...item });
      continue;
    }
    const current = next[index];
    next[index] = {
      ...current,
      name: item.name,
      unit: item.unit,
      packSize: item.packSize,
      packLabel: item.packLabel,
      cost: item.cost,
      morrisonsUrl: item.morrisonsUrl,
    };
  }
  return next.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

function sameCataloguePack(current: CatalogueItem, incoming: CatalogueItem): boolean {
  const name = current.name.trim().toLowerCase();
  const pack = current.packLabel.trim().toLowerCase();
  const incomingName = incoming.name.trim().toLowerCase();
  const incomingPack = incoming.packLabel.trim().toLowerCase();
  return (
    current.id === incoming.id ||
    pack === incomingPack ||
    name === incomingName ||
    name === incomingPack ||
    pack === incomingName ||
    (incoming.morrisonsUrl !== "" && current.morrisonsUrl === incoming.morrisonsUrl)
  );
}

function samePack(left: MorrisonsPackInput, right: MorrisonsPackInput): boolean {
  return (
    left.packLabel.trim().toLowerCase() === right.packLabel.trim().toLowerCase() ||
    left.url === right.url
  );
}

function rowsFromJson(source: string): unknown[] {
  const parsed: unknown = JSON.parse(source);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const record = parsed as { items?: unknown; name?: unknown };
    if (Array.isArray(record.items)) return record.items;
    if (typeof record.name === "string") return [parsed];
  }
  throw new Error("JSON must be a pack object, an array of packs, or { \"items\": [...] }.");
}

function rowsFromCsv(source: string): unknown[] {
  const table = parseCsvTable(source);
  if (table.length < 2) throw new Error("CSV needs a header row and at least one pack.");
  const headers = table[0].map((header) => header.trim().toLowerCase());
  return table.slice(1).flatMap((cells) => {
    if (cells.every((cell) => cell.trim() === "")) return [];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cells[index]?.trim() ?? "";
    });
    return [record];
  });
}

function parseCsvTable(source: string): string[][] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      table.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV has an unterminated quoted value.");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    table.push(row);
  }
  return table;
}

function normalizeRows(rows: unknown[]): MorrisonsImportResult {
  const items: MorrisonsPackInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const result = normalizeRow(row, index + 1);
    if (result.error) errors.push(result.error);
    else if (result.item) items.push(result.item);
  });
  if (items.length === 0 && errors.length === 0) errors.push("No Morrisons packs were found.");
  return { items, errors };
}

function normalizeRow(row: unknown, line: number): { item?: MorrisonsPackInput; error?: string } {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { error: `Row ${line}: expected an object with name, pack size, price, and URL.` };
  }
  const record = row as Record<string, unknown>;
  const name = text(record, ["name", "item", "itemname"]);
  const packLabel = text(record, ["packlabel", "pack_label", "pack", "label"]) || name;
  const unitText = text(record, ["unit", "units"]).toLowerCase();
  const unit = (unitText || "units") as SupplyUnit;
  const packSize = numberValue(record, ["packsize", "pack_size", "size"]);
  const price = moneyValue(record, ["price", "cost", "pricegbp", "price_gbp"]);
  const url = text(record, ["url", "morrisonsurl", "morrisons_url", "link"]);

  if (!name) return { error: `Row ${line}: name is required.` };
  if (!UNITS.has(unit)) return { error: `Row ${line}: unit must be g, ml, loaves, or units.` };
  if (packSize === null || packSize <= 0) return { error: `Row ${line}: pack size must be a number greater than 0.` };
  if (price === null || price <= 0) return { error: `Row ${line}: price must be a GBP amount greater than 0.` };
  if (!isMorrisonsProductUrl(url)) {
    return { error: `Row ${line}: URL must be an https://groceries.morrisons.com/products/… link. Search pages are not saved.` };
  }
  return {
    item: {
      name,
      packLabel,
      unit,
      packSize,
      price: Math.round(price * 100) / 100,
      url,
    },
  };
}

function text(record: Record<string, unknown>, keys: string[]): string {
  for (const [key, value] of Object.entries(record)) {
    if (!keys.includes(key.toLowerCase().replace(/\s+/g, ""))) continue;
    return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  }
  return "";
}

function numberValue(record: Record<string, unknown>, keys: string[]): number | null {
  const raw = text(record, keys).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function moneyValue(record: Record<string, unknown>, keys: string[]): number | null {
  const raw = text(record, keys).replace(/£/g, "").replace(/,/g, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

