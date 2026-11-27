"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "scone-sarah-confirmed-ingredients";
const EMPTY: Readonly<Record<string, true>> = Object.freeze({});

let cached: Readonly<Record<string, true>> = EMPTY;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();

function readStored(): Readonly<Record<string, true>> {
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
    const next: Record<string, true> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (value === true && id.trim()) next[id] = true;
    }
    cached = Object.keys(next).length > 0 ? next : EMPTY;
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

/** Server and the hydration render stay empty so saved ticks cannot mismatch the HTML. */
export function sarahConfirmationsServer(): Readonly<Record<string, true>> {
  return EMPTY;
}

export function sarahConfirmationsClient(): Readonly<Record<string, true>> {
  return readStored();
}

export function useSarahConfirmations(): Readonly<Record<string, true>> {
  return useSyncExternalStore(subscribe, sarahConfirmationsClient, sarahConfirmationsServer);
}

export function setSarahConfirmed(itemId: string, confirmed: boolean) {
  const id = itemId.trim();
  if (!id) return;
  const next: Record<string, true> = { ...readStored() };
  if (confirmed) next[id] = true;
  else delete next[id];
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cached = Object.keys(next).length > 0 ? next : EMPTY;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* The tick still updates for this tab when storage is blocked. */
  }
  notify();
}
