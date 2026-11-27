export interface MorrisonsOrderLine {
  name: string;
  trolleyPacks: number;
  netToBuy: number;
  unit: string;
  morrisonsUrl: string;
}

const STORE = Symbol.for("scone-tea-party-morrisons-order-list");

type Store = { items: MorrisonsOrderLine[] };

function store(): Store {
  const root = globalThis as typeof globalThis & { [STORE]?: Store };
  if (!root[STORE]) root[STORE] = { items: [] };
  return root[STORE];
}

export function readMorrisonsOrderList(): MorrisonsOrderLine[] {
  return store().items.map((item) => ({ ...item }));
}

export function saveMorrisonsOrderList(items: MorrisonsOrderLine[]): void {
  store().items = items.map((item) => ({ ...item }));
}

export function parseMorrisonsOrderList(value: unknown): MorrisonsOrderLine[] | null {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : null;
  if (!rows || rows.length > 300) return null;
  const items: MorrisonsOrderLine[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const unit = typeof record.unit === "string" ? record.unit.trim() : typeof record.requiredUnit === "string" ? record.requiredUnit.trim() : "";
    const morrisonsUrl = typeof record.morrisonsUrl === "string" ? record.morrisonsUrl.trim() : "";
    const trolleyPacks = typeof record.trolleyPacks === "number" ? record.trolleyPacks : null;
    const netToBuy = typeof record.netToBuy === "number" ? record.netToBuy : null;
    if (!name || !unit || !morrisonsUrl || trolleyPacks === null || netToBuy === null) return null;
    if (trolleyPacks <= 0) continue;
    items.push({ name, unit, morrisonsUrl, trolleyPacks, netToBuy });
  }
  return items;
}
