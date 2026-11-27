"use client";

import { useSyncExternalStore } from "react";
import {
  EXTRA_CATEGORIES,
  SEEDED_OVERHEADS,
  type ExtraCategory,
  type ExtraCost,
  type FixedOverhead,
} from "@/lib/business-records";

export type { ExtraCategory, ExtraCost, FixedOverhead } from "@/lib/business-records";
export { EXTRA_CATEGORIES, extraCategoryLabel, SEEDED_OVERHEADS } from "@/lib/business-records";

interface BusinessBooks {
  overheads: FixedOverhead[];
  extras: ExtraCost[];
  nextFixedId: number;
  nextExtraId: number;
}

const STORAGE_KEY = "scone-sarah-business-books";
const CATEGORIES = new Set(EXTRA_CATEGORIES.map((entry) => entry.id));

const INITIAL_BOOKS: BusinessBooks = {
  overheads: SEEDED_OVERHEADS,
  extras: [],
  nextFixedId: 1,
  nextExtraId: 1,
};

let presented: BusinessBooks = INITIAL_BOOKS;
let presentedRaw = JSON.stringify(INITIAL_BOOKS);
let cached: BusinessBooks | null = null;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

function money(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function withCarAndFuel(rows: FixedOverhead[]): FixedOverhead[] {
  const named = rows.map((row) =>
    row.id === "car" || row.name.trim().toLowerCase() === "car / fuel" ? { ...row, id: "car", name: "Car" } : row,
  );
  if (named.some((row) => row.id === "fuel" || row.name.trim().toLowerCase() === "fuel")) return named;
  const carAt = named.findIndex((row) => row.id === "car");
  const fuel: FixedOverhead = { id: "fuel", name: "Fuel", monthlyAmount: 0, enabled: true };
  if (carAt < 0) return [{ id: "car", name: "Car", monthlyAmount: 0, enabled: true }, fuel, ...named];
  return [...named.slice(0, carAt + 1), fuel, ...named.slice(carAt + 1)];
}

function overheadsFrom(value: unknown): FixedOverhead[] {
  if (!Array.isArray(value)) return SEEDED_OVERHEADS;
  const rows: FixedOverhead[] = [];
  for (const entry of value.slice(0, 40)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = text(row.id, 40);
    const name = text(row.name, 80);
    if (!id || !name) continue;
    rows.push({ id, name, monthlyAmount: Math.max(0, money(row.monthlyAmount)), enabled: row.enabled !== false });
  }
  return rows.length > 0 ? withCarAndFuel(rows) : SEEDED_OVERHEADS;
}

function extrasFrom(value: unknown): ExtraCost[] {
  if (!Array.isArray(value)) return [];
  const rows: ExtraCost[] = [];
  for (const entry of value.slice(0, 200)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = text(row.id, 40);
    const category = text(row.category, 40);
    if (!id || !CATEGORIES.has(category as ExtraCategory)) continue;
    const date = text(row.date, 10);
    rows.push({
      id,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
      category: category as ExtraCategory,
      description: text(row.description, 120),
      amount: Math.max(0, money(row.amount)),
      notes: text(row.notes, 240),
    });
  }
  return rows;
}

function booksFrom(value: unknown): BusinessBooks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const nextFixedId = typeof row.nextFixedId === "number" && row.nextFixedId > 0 ? Math.round(row.nextFixedId) : 1;
  const nextExtraId = typeof row.nextExtraId === "number" && row.nextExtraId > 0 ? Math.round(row.nextExtraId) : 1;
  return {
    overheads: overheadsFrom(row.overheads),
    extras: extrasFrom(row.extras),
    nextFixedId,
    nextExtraId,
  };
}

function present(stored: BusinessBooks | null): BusinessBooks {
  if (!stored) return INITIAL_BOOKS;
  const raw = JSON.stringify(stored);
  if (raw === JSON.stringify(INITIAL_BOOKS)) return INITIAL_BOOKS;
  if (raw === presentedRaw) return presented;
  presented = stored;
  presentedRaw = raw;
  return presented;
}

function readStored(): BusinessBooks | null {
  if (typeof window === "undefined") return null;
  let raw = "";
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  if (!raw) {
    cached = null;
    return cached;
  }
  try {
    cached = booksFrom(JSON.parse(raw) as unknown);
    return cached;
  } catch {
    cached = null;
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

function write(next: BusinessBooks) {
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

export function subscribeBusinessBooks(listener: () => void): () => void {
  return subscribe(listener);
}

export function getBusinessBooks(): BusinessBooks {
  return present(readStored());
}

export function getServerBusinessBooks(): BusinessBooks {
  return INITIAL_BOOKS;
}

export function updateBusinessBooks(updater: (current: BusinessBooks) => BusinessBooks) {
  write(updater(present(readStored())));
}

export function useBusinessBooks(): BusinessBooks {
  return useSyncExternalStore(subscribeBusinessBooks, getBusinessBooks, getServerBusinessBooks);
}
