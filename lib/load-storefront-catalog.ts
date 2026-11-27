import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applySnapshotMedia,
  isRetiredMenuItem,
  MOCK_CATALOG,
  withoutRetiredMenuItems,
  type DietaryTag,
  type MenuItem,
  type PublicSiteAssets,
  type PublicSiteImage,
} from "@/lib/mock-data";
import { fallbackCatalog, mapWixSnapshotToCatalog, type StorefrontCatalog } from "@/lib/storefront-catalog";
import { readLocalMenuCatalog, type WixMenuCatalogItem } from "@/lib/wix-menu-sync";

/**
 * Reads data/wix-snapshot.json when it is already on disk.
 * This never calls Wix. A missing or unusable file falls back to MOCK_CATALOG.
 */
export function loadStorefrontCatalog(): StorefrontCatalog {
  const path = resolve(process.cwd(), "data", "wix-snapshot.json");
  if (!existsSync(path)) return fallbackCatalog();

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const items = mapWixSnapshotToCatalog(parsed);
    if (!items || items.length === 0) {
      return { source: "mock", items: withoutRetiredMenuItems(applySnapshotMedia(MOCK_CATALOG, parsed)) };
    }
    return { source: "snapshot", items: withoutRetiredMenuItems(applySnapshotMedia(items, parsed)) };
  } catch {
    return fallbackCatalog();
  }
}

const SECTION_ORDER = [
  "Scones",
  "Sandwich Platters",
  "Grazing Boxes",
  "Cakes",
  "Savoury Treats",
  "Sweet Treats",
  "Gluten Free Menu",
  "Afternoon Tea",
  "Menu",
];

const SECTION_BANNERS = new Set([
  "sandwich platters",
  "grazing boxes",
  "savoury treats",
  "cakes",
  "cupcakes",
  "scones",
  "sweet treats",
  "gluten free menu",
  "extras",
]);

function localFileExists(publicPath: string): boolean {
  if (!publicPath.startsWith("/") || publicPath.includes("..")) return false;
  return existsSync(resolve(process.cwd(), "public", publicPath.slice(1)));
}

function keywordImage(item: MenuItem): string {
  const value = `${item.name} ${item.category}`.toLowerCase();
  if (value.includes("vegan")) return "/images/sandwich-vegan.svg";
  if (value.includes("gluten")) return "/images/sandwich-gf.svg";
  if (value.includes("extra large") || /\bxl\b/.test(value)) return "/images/sandwich-xl.svg";
  if (value.includes("small") && value.includes("sandwich")) return "/images/sandwich-small.svg";
  if (value.includes("sandwich") || value.includes("bagel") || value.includes("brioche") || value.includes("bun")) {
    return "/images/sandwich-large.svg";
  }
  if (value.includes("scone")) return "/images/scone-platter.svg";
  if (value.includes("grazing") || value.includes("cheese")) return "/images/grazing-box.svg";
  if (value.includes("biscoff")) return "/images/biscoff-traybake.svg";
  if (value.includes("afternoon")) return "/images/afternoon-tea.svg";
  if (
    value.includes("lemon") ||
    value.includes("traybake") ||
    value.includes("cake") ||
    value.includes("cupcake") ||
    value.includes("tiffin") ||
    value.includes("rocky") ||
    value.includes("sweet")
  ) {
    return "/images/lemon-traybake.svg";
  }
  return "/images/sausage-rolls.svg";
}

function contentPhoto(image: PublicSiteImage): boolean {
  const path = image.localPath ?? "";
  if (!path.startsWith("/wix-clone-assets/") || !/\.(jpe?g|webp)$/i.test(path)) return false;
  if (image.role === "logo") return false;
  if (SECTION_BANNERS.has((image.alt ?? "").trim().toLowerCase())) return false;
  const label = `${image.alt ?? ""} ${image.sourceUrl ?? ""} ${path}`.toLowerCase();
  if (/twitter|facebook|instagram|logo|favicon|coming soon/.test(label)) return false;
  return localFileExists(path);
}

function photoPools(assets: PublicSiteAssets | null): Map<string, string[]> {
  const pools = new Map<string, string[]>();
  let current = "general";
  for (const image of assets?.images ?? []) {
    const alt = (image.alt ?? "").trim().toLowerCase();
    if (SECTION_BANNERS.has(alt)) {
      current = alt;
      continue;
    }
    if (!contentPhoto(image)) continue;
    const list = pools.get(current) ?? [];
    if (!list.includes(image.localPath)) list.push(image.localPath);
    pools.set(current, list);
  }
  return pools;
}

function poolName(item: MenuItem): string {
  const name = item.name.toLowerCase();
  const category = item.category.toLowerCase();
  if (name.includes("cupcake")) return "cupcakes";
  if (name.includes("sweet treat") || name.includes("rocky") || name.includes("tiffin")) return "sweet treats";
  if (category.includes("scone") || name.includes("scone")) return "scones";
  if (category.includes("gluten") || name.includes("gluten")) return "gluten free menu";
  if (category.includes("cake") || name.includes("cake") || name.includes("traybake")) return "cakes";
  if (category.includes("grazing") || name.includes("grazing") || name.includes("cheese box")) return "grazing boxes";
  if (category.includes("sandwich") || name.includes("sandwich") || name.includes("bagel") || name.includes("brioche")) {
    return "sandwich platters";
  }
  return "savoury treats";
}

function tagsFor(name: string): DietaryTag[] | undefined {
  const value = name.toLowerCase();
  const tags: DietaryTag[] = [];
  if (value.includes("vegetarian")) tags.push("V");
  if (value.includes("vegan")) tags.push("VE");
  if (value.includes("gluten")) tags.push("GF");
  return tags.length > 0 ? tags : undefined;
}

function itemFromCatalog(raw: WixMenuCatalogItem): MenuItem | null {
  if (!raw.visible || isRetiredMenuItem(raw.id, raw.name)) return null;
  const category = raw.sections[0] || "Menu";
  const mock = MOCK_CATALOG.find(
    (item) => item.id === raw.id || item.name.trim().toLowerCase() === raw.name.trim().toLowerCase(),
  );
  if (mock) {
    return {
      ...mock,
      id: raw.id,
      name: raw.name,
      category: raw.sections[0] || mock.category,
    };
  }
  return {
    id: raw.id,
    name: raw.name,
    category,
    description: `${raw.name}, from the ${category} menu.`,
    dietaryTags: tagsFor(raw.name),
    priceVariants: [{ option: "Standard", price: raw.price }],
  };
}

function withLocalImages(items: MenuItem[], assets: PublicSiteAssets | null): MenuItem[] {
  const pools = photoPools(assets);
  const imageById = new Map<string, string>();
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = poolName(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, group] of groups) {
    const photos = pools.get(key) ?? [];
    const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
    sorted.forEach((item, index) => {
      const photo = photos.length > 0 ? photos[index % photos.length] : keywordImage(item);
      imageById.set(item.id, localFileExists(photo) ? photo : keywordImage(item));
    });
  }
  return items.map((item) => {
    const imageUrl = imageById.get(item.id) ?? keywordImage(item);
    return imageUrl === item.imageUrl ? item : { ...item, imageUrl };
  });
}

/**
 * The corporate ordering menu is every visible item in the local menu catalog.
 * Pictures are files already saved under public/. This never calls Wix.
 */
export function loadOrderingCatalog(assets: PublicSiteAssets | null): StorefrontCatalog {
  const catalog = readLocalMenuCatalog();
  const items = catalog.items
    .map(itemFromCatalog)
    .filter((item): item is MenuItem => Boolean(item));
  if (items.length === 0) return fallbackCatalog();
  items.sort((a, b) => {
    const sectionA = SECTION_ORDER.indexOf(a.category);
    const sectionB = SECTION_ORDER.indexOf(b.category);
    const left = sectionA === -1 ? SECTION_ORDER.length : sectionA;
    const right = sectionB === -1 ? SECTION_ORDER.length : sectionB;
    return left - right || a.name.localeCompare(b.name, "en-GB");
  });
  return { source: "menu", items: withoutRetiredMenuItems(withLocalImages(items, assets)) };
}
