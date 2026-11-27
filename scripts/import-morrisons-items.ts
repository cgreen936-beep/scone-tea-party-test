/**
 * Add Morrisons packs to the local trolley catalogue.
 *
 * Reads one JSON or CSV file of packs you already know:
 * name, pack size, price in GBP, and a Morrisons product URL (https://groceries.morrisons.com/products/…).
 * Merges them into data/morrisons-items.json. The ops desk loads that file
 * into the Morrisons ingredient list. This script never opens a browser and
 * never requests the Morrisons website.
 *
 *   npx tsx scripts/import-morrisons-items.ts data/morrisons-items.example.json
 *   npx tsx scripts/import-morrisons-items.ts packs.csv --dry-run
 *
 * JSON: one pack, an array of packs, or { "items": [ ... ] }.
 * CSV header: name,packSize,price,url  with optional unit and packLabel.
 * unit is g, ml, loaves, or units.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeMorrisonsPacks, parseMorrisonsImport, type MorrisonsPackInput } from "../lib/morrisons-import";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(PROJECT_ROOT, "data", "morrisons-items.json");

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((arg) => arg !== "--dry-run");
  if (!fileArg) {
    console.error("Usage: npx tsx scripts/import-morrisons-items.ts <packs.json|packs.csv> [--dry-run]");
    process.exit(1);
  }

  const sourcePath = resolve(process.cwd(), fileArg);
  if (!existsSync(sourcePath)) {
    console.error(`File not found: ${sourcePath}`);
    process.exit(1);
  }

  const incoming = parseMorrisonsImport(readFileSync(sourcePath, "utf8"));
  if (incoming.errors.length > 0) {
    for (const error of incoming.errors) console.error(error);
    console.error("Nothing was written.");
    process.exit(1);
  }

  const existing = readCurrent();
  const merged = mergeMorrisonsPacks(existing, incoming.items);
  if (dryRun) {
    console.log(
      `Dry run: ${merged.added} to add, ${merged.updated} to update. data/morrisons-items.json was not written.`,
    );
    return;
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify({ source: "local-morrisons-import", items: merged.items }, null, 2)}\n`);
  console.log(
    `Added ${merged.added} and updated ${merged.updated}. Wrote data/morrisons-items.json (${merged.items.length} packs).`,
  );
}

function readCurrent(): MorrisonsPackInput[] {
  if (!existsSync(OUTPUT)) return [];
  const current = parseMorrisonsImport(readFileSync(OUTPUT, "utf8"));
  if (current.errors.length > 0) {
    for (const error of current.errors) console.error(error);
    console.error("Existing data/morrisons-items.json was left unchanged.");
    process.exit(1);
  }
  return current.items;
}

main();
