import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PublicSiteAssets } from "@/lib/mock-data";

/**
 * Reads data/public-site-assets.json when scripts/pull-public-site-assets.ts has already saved it.
 * This never calls the public site.
 */
export function loadPublicSiteAssets(): PublicSiteAssets | null {
  const path = resolve(process.cwd(), "data", "public-site-assets.json");
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as PublicSiteAssets;
  } catch {
    return null;
  }
}
