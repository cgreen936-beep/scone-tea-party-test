"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_MENU_TEMPLATES, type MenuTemplate } from "@/lib/corporate-portal";

const STORAGE_KEY = "scone-sarah-menu-templates";
const IDS = new Set(["basic", "standard", "deluxe"]);

let presented: MenuTemplate[] | null = null;
let presentedRaw = "";
let cached: MenuTemplate[] | null = null;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function templatesFrom(value: unknown): MenuTemplate[] | null {
  if (!Array.isArray(value)) return null;
  const rows: MenuTemplate[] = [];
  for (const entry of value.slice(0, 3)) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const id = text(row.id, 20);
    const fallback = DEFAULT_MENU_TEMPLATES.find((tier) => tier.id === id);
    if (!fallback || !IDS.has(id) || rows.some((tier) => tier.id === id)) return null;
    const picks = Array.isArray(row.picks) ? row.picks : [];
    const nextPicks = picks.slice(0, 8).flatMap((pick) => {
      if (!pick || typeof pick !== "object") return [];
      const item = pick as Record<string, unknown>;
      const name = text(item.name, 80);
      const portion = text(item.portion, 120);
      const covers = typeof item.covers === "number" && item.covers > 0 ? Math.round(item.covers) : 0;
      if (!name || !portion || covers <= 0) return [];
      return [{ name, covers, portion }];
    });
    rows.push({
      id: fallback.id,
      label: fallback.label,
      blurb: fallback.blurb,
      picks: nextPicks.length > 0 ? nextPicks : fallback.picks,
    });
  }
  return rows.length === 3 ? rows : null;
}

function present(stored: MenuTemplate[] | null): MenuTemplate[] | null {
  if (!stored) return null;
  const raw = JSON.stringify(stored);
  if (raw === presentedRaw) return presented;
  presented = stored;
  presentedRaw = raw;
  return presented;
}

function readStored(): MenuTemplate[] | null {
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
    return null;
  }
  try {
    cached = templatesFrom(JSON.parse(raw) as unknown);
    return cached;
  } catch {
    cached = null;
    return null;
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

function write(next: MenuTemplate[] | null) {
  cached = next;
  const raw = next ? JSON.stringify(next) : "";
  cachedRaw = raw;
  presented = next;
  presentedRaw = raw;
  try {
    if (!next) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // The in-memory copy still applies for this tab when storage is blocked.
  }
  listeners.forEach((listener) => listener());
}

export function useMenuTemplates(): MenuTemplate[] | null {
  return useSyncExternalStore(subscribe, () => present(readStored()), () => null);
}

export function saveMenuTemplates(next: MenuTemplate[]) {
  const parsed = templatesFrom(next);
  if (parsed) write(parsed);
}

export function resetMenuTemplates() {
  write(null);
}
