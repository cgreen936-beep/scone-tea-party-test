export function isMorrisonsProductUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "groceries.morrisons.com") return false;
    const path = url.pathname.replace(/\/+$/, "");
    return path.length > 1 && path !== "/search" && !path.startsWith("/search/");
  } catch {
    return false;
  }
}

export function morrisonsSearchUrl(name: string): string {
  const query = name.trim() || "morrisons";
  return `https://groceries.morrisons.com/search?q=${encodeURIComponent(query)}`;
}

/** Keep a verified product or exact item link. Search pages are not saved. */
export function savedMorrisonsProductUrl(value: string): string {
  const trimmed = value.trim();
  return isMorrisonsProductUrl(trimmed) ? trimmed : "";
}

/** Product link when one is saved, otherwise a temporary search for the item name. */
export function resolveMorrisonsUrl(value: string, name: string): string {
  const trimmed = value.trim();
  if (isMorrisonsProductUrl(trimmed)) return trimmed;
  return morrisonsSearchUrl(name);
}
