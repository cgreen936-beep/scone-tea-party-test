/**
 * Opens a visible Chromium window and adds Morrisons lines from shopping-list.json.
 * Stops before checkout so a person can check items, substitutions, and payment.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Locator, type Page } from "playwright";

interface ShoppingListItem {
  ingredient: string;
  packLabel: string;
  url: string;
  quantity: number;
}

const FALLBACK_LIST: ShoppingListItem[] = [
  {
    ingredient: "Self-Raising Flour",
    packLabel: "Morrisons Self Raising Flour 1.5kg",
    url: "https://groceries.morrisons.com/search?q=Self-Raising%20Flour",
    quantity: 1,
  },
  {
    ingredient: "Unsalted Butter",
    packLabel: "Morrisons Unsalted Butter 250g",
    url: "https://groceries.morrisons.com/search?q=Unsalted%20Butter",
    quantity: 1,
  },
  {
    ingredient: "Cornish Clotted Cream",
    packLabel: "Rodda's Cornish Clotted Cream 200g",
    url: "https://groceries.morrisons.com/search?q=Cornish%20Clotted%20Cream",
    quantity: 1,
  },
];

const ADD_SELECTORS = [
  "button:has-text('Add to trolley')",
  "button:has-text('Add to basket')",
  "button[aria-label*='Add to']",
  "button:has-text('Add')",
];

const INCREMENT_SELECTORS = [
  "button[aria-label*='Increase']",
  "button[aria-label*='Increment']",
  "button[aria-label*='quantity']",
  "button:has-text('+')",
];

function readShoppingItem(value: unknown): ShoppingListItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const ingredient = typeof item.name === "string" ? item.name : typeof item.ingredient === "string" ? item.ingredient : "";
  const url = typeof item.morrisonsUrl === "string" ? item.morrisonsUrl : typeof item.url === "string" ? item.url : "";
  const quantity = typeof item.trolleyPacks === "number" ? item.trolleyPacks : typeof item.quantity === "number" ? item.quantity : null;
  if (!ingredient || !url || quantity === null) return null;
  const packLabel = typeof item.packLabel === "string" && item.packLabel.trim() ? item.packLabel : ingredient;
  return { ingredient, packLabel, url, quantity };
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function loadShoppingList(): ShoppingListItem[] {
  const path = resolve(process.cwd(), "shopping-list.json");
  if (!existsSync(path)) {
    console.log("shopping-list.json was not found. Using the fallback sample list.");
    return FALLBACK_LIST;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    console.error("Could not parse shopping-list.json. Fix the file or remove it.");
    process.exit(1);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.log("shopping-list.json has no items. Using the fallback sample list.");
    return FALLBACK_LIST;
  }

  const items = parsed.flatMap((entry) => {
    const item = readShoppingItem(entry);
    return item && isHttpUrl(item.url) ? [item] : [];
  });
  if (items.length === 0) {
    console.log("shopping-list.json had no usable http(s) items. Using the fallback sample list.");
    return FALLBACK_LIST;
  }

  return items;
}

async function firstVisible(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function dismissCookies(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: /accept all|accept cookies|allow all/i }).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    console.log("Dismissed the cookie banner.");
  }
}

async function addQuantity(page: Page, quantity: number): Promise<void> {
  const capped = Math.min(Math.max(Math.floor(quantity), 0), 99);
  if (capped !== quantity) {
    console.log(`Quantity ${quantity} was adjusted to ${capped}.`);
  }
  if (capped < 1) {
    console.log("Skipped an item with a quantity below 1.");
    return;
  }

  const addButton = await firstVisible(page, ADD_SELECTORS);
  if (!addButton) {
    console.log("No add control was visible. Add this line by hand before checkout.");
    return;
  }

  await addButton.click();
  console.log("Clicked the add control.");

  for (let added = 1; added < capped; added += 1) {
    const increment = await firstVisible(page, INCREMENT_SELECTORS);
    if (increment) {
      await increment.click();
      console.log(`Clicked increment (${added + 1} of ${capped}).`);
    } else if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      console.log(`Clicked add again (${added + 1} of ${capped}).`);
    } else {
      console.log(`Stopped at ${added} of ${capped}. The increment control was not visible.`);
      return;
    }
  }
}

async function main(): Promise<void> {
  const items = loadShoppingList();
  console.log(`Scone Tea Party trolley helper: ${items.length} line(s). Checkout stays manual.`);

  let context;
  try {
    context = await chromium.launchPersistentContext("./.morrisons-session", {
      headless: false,
      viewport: { width: 1366, height: 840 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chromium did not launch.";
    console.error(message);
    console.error("Install the browser with: npx playwright install chromium");
    process.exit(1);
  }

  const page = context.pages()[0] ?? (await context.newPage());

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.quantity < 1) {
      console.log(`[${index + 1}/${items.length}] ${item.ingredient} is covered. 0 packs were added.`);
      continue;
    }
    console.log(
      `[${index + 1}/${items.length}] ${item.ingredient} — ${item.packLabel} × ${item.quantity}`,
    );
    try {
      await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await dismissCookies(page);
      await addQuantity(page, item.quantity);
    } catch (error) {
      const message = error instanceof Error ? error.message : "This line failed.";
      console.log(`Could not finish ${item.packLabel}. ${message}`);
    }
  }

  console.log("Paused before checkout. Check items, substitutions, and payment yourself.");
  await page.pause();
  console.log("Resumed. No checkout was automated.");
  await context.close();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Trolley helper failed.";
  console.error(message);
  process.exit(1);
});
