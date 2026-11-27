import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogueItem } from "@/lib/costing";
import { morrisonsPacksToCatalogue, parseMorrisonsImport } from "@/lib/morrisons-import";

/**
 * Reads data/morrisons-items.json when scripts/import-morrisons-items.ts has saved it.
 * This never calls Morrisons.
 */
export function loadMorrisonsItems(): CatalogueItem[] {
  const path = resolve(process.cwd(), "data", "morrisons-items.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = parseMorrisonsImport(readFileSync(path, "utf8"));
    if (parsed.errors.length > 0) return [];
    return morrisonsPacksToCatalogue(parsed.items);
  } catch {
    return [];
  }
}
