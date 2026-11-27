/**
 * Refresh data/wix-menu-catalog.json from Wix when WIX_API_KEY is set.
 * The calls are menu and item queries only. Nothing is created or changed on Wix.
 * A missing key leaves the local file as it is.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncLiveWixMenuCatalog } from "../lib/wix-menu-sync";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal(): void {
  const envPath = resolve(root, ".env.local");
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if ((process.env[key] ?? "").trim() !== "") continue;
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const result = await syncLiveWixMenuCatalog();
  console.log(result.reason);
  if (!result.refreshed && !result.reason.includes("No Wix request was made")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Menu sync failed.";
  console.error(message);
  process.exitCode = 1;
});
