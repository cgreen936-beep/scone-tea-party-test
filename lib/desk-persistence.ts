"use client";

import { useSyncExternalStore } from "react";
import { SEEDED_BOX_STOCK } from "@/lib/box-stock";
import type { CatalogueItem, EditableRecipe } from "@/lib/costing";

const STORAGE_KEY = "scone-sarah-desk-edits";

export interface DeskEdits {
  stock: Record<string, number>;
  catalogueCosts: Record<string, number>;
  recipes: EditableRecipe[] | null;
  completed: Record<string, true>;
}

const EMPTY: DeskEdits = {
  stock: {},
  catalogueCosts: {},
  recipes: null,
  completed: {},
};

const SEEDED_VIEW: DeskEdits = {
  stock: SEEDED_BOX_STOCK,
  catalogueCosts: {},
  recipes: null,
  completed: {},
};

let presented: DeskEdits = SEEDED_VIEW;
let presentedRaw = JSON.stringify(SEEDED_VIEW);

function present(stored: DeskEdits): DeskEdits {
  const untouched =
    stored.recipes === null &&
    Object.keys(stored.catalogueCosts).length === 0 &&
    Object.keys(stored.completed).length === 0 &&
    Object.keys(stored.stock).length === 0;
  if (untouched) return SEEDED_VIEW;
  const next: DeskEdits = { ...stored, stock: { ...SEEDED_BOX_STOCK, ...stored.stock } };
  const raw = JSON.stringify(next);
  if (raw === presentedRaw) return presented;
  presented = next;
  presentedRaw = raw;
  return presented;
}

let cached: DeskEdits = EMPTY;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (!key.trim() || typeof amount !== "number" || !Number.isFinite(amount)) continue;
    next[key] = amount;
  }
  return next;
}

function completedRecord(value: unknown): Record<string, true> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, true> = {};
  for (const [key, flag] of Object.entries(value)) {
    if (flag === true && key.trim()) next[key] = true;
  }
  return next;
}

function recipeList(value: unknown): EditableRecipe[] | null {
  if (!Array.isArray(value)) return null;
  const recipes = value.filter((entry): entry is EditableRecipe => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as EditableRecipe;
    return typeof row.itemId === "string" && typeof row.itemName === "string" && Array.isArray(row.lines);
  });
  return recipes.length > 0 ? recipes : null;
}

function readStored(): DeskEdits {
  if (typeof window === "undefined") return EMPTY;
  let raw = "";
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  if (!raw) {
    cached = EMPTY;
    return cached;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      cached = EMPTY;
      return cached;
    }
    const row = parsed as Record<string, unknown>;
    cached = {
      stock: numberRecord(row.stock),
      catalogueCosts: numberRecord(row.catalogueCosts),
      recipes: recipeList(row.recipes),
      completed: completedRecord(row.completed),
    };
    return cached;
  } catch {
    cached = EMPTY;
    return cached;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    cachedRaw = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function write(next: DeskEdits) {
  cached = next;
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // The in-memory copy still applies for this tab when storage is blocked.
  }
  notify();
}

/** Server and the hydration render stay on the seeded box counts. Saved edits overlay those counts. */
export function deskEditsServer(): DeskEdits {
  return SEEDED_VIEW;
}

export function deskEditsClient(): DeskEdits {
  return present(readStored());
}

export function useDeskEdits(): DeskEdits {
  return useSyncExternalStore(subscribe, deskEditsClient, deskEditsServer);
}

export function getDeskEdits(): DeskEdits {
  return present(readStored());
}

export function updateDeskEdits(updater: (current: DeskEdits) => DeskEdits) {
  write(updater(present(readStored())));
}

export function mergeSavedRecipes(seed: EditableRecipe[], saved: EditableRecipe[] | null): EditableRecipe[] {
  if (!saved || saved.length === 0) return seed;
  return seed.map((recipe) => {
    const match =
      saved.find((entry) => entry.itemId === recipe.itemId) ??
      saved.find((entry) => entry.itemName.trim().toLowerCase() === recipe.itemName.trim().toLowerCase());
    if (!match) return recipe;
    return { ...recipe, ...match, itemId: recipe.itemId, itemName: recipe.itemName };
  });
}

export function applyCatalogueCosts(seed: CatalogueItem[], costs: Record<string, number>): CatalogueItem[] {
  return seed.map((item) => {
    const cost = costs[item.id];
    return cost === undefined ? item : { ...item, cost };
  });
}
