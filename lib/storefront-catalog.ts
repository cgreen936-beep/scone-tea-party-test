import {
  isRetiredMenuItem,
  MENU_SECTIONS,
  MOCK_CATALOG,
  snapshotItemImageUrl,
  withoutRetiredMenuItems,
  type DietaryTag,
  type MenuItem,
  type ModifierGroup,
  type PriceVariant,
} from "@/lib/mock-data";

export interface StorefrontCatalog {
  source: "snapshot" | "mock" | "menu";
  items: MenuItem[];
}

const SECTION_SET = new Set<string>(MENU_SECTIONS);

export function fallbackCatalog(): StorefrontCatalog {
  return { source: "mock", items: withoutRetiredMenuItems(MOCK_CATALOG) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["original", "translated", "name", "label", "value"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["amount", "price", "formattedAmount", "formattedPrice"]) {
    if (record[key] != null) {
      const parsed = money(record[key]);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function canonicalSection(name: string): string {
  const cleaned = name.trim();
  const known = MENU_SECTIONS.find((section) => section.toLowerCase() === cleaned.toLowerCase());
  return known ?? cleaned;
}

function inferSection(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("gluten")) return "Gluten Free Menu";
  if (value.includes("afternoon tea")) return "Afternoon Tea";
  if (value.includes("scone")) return "Scones";
  if (value.includes("sandwich")) return "Sandwich Platters";
  if (value.includes("grazing")) return "Grazing Boxes";
  if (value.includes("cake") || value.includes("traybake") || value.includes("bake")) return "Cakes";
  if (value.includes("sausage") || value.includes("savoury") || value.includes("savory")) return "Savoury Treats";
  return "Menu";
}

function readTags(item: Record<string, unknown>, name: string): DietaryTag[] {
  const found = new Set<DietaryTag>();
  const sources = [name];
  const labels = item.labels ?? item.dietaryLabels ?? item.tags;
  if (Array.isArray(labels)) {
    for (const label of labels) sources.push(text(asRecord(label)?.name ?? label));
  }
  for (const source of sources) {
    const value = source.trim().toLowerCase();
    if (!value) continue;
    if (value === "gf" || value.includes("gluten free") || value.includes("gluten-free")) found.add("GF");
    if (value === "ve" || value.includes("vegan")) found.add("VE");
    if (value === "v" || value.includes("vegetarian")) found.add("V");
  }
  return (["V", "VE", "GF"] as DietaryTag[]).filter((tag) => found.has(tag));
}

function readVariants(item: Record<string, unknown>): PriceVariant[] {
  const raw = item.priceVariants ?? item.pricing ?? item.priceInfo;
  const record = asRecord(raw);
  const list = Array.isArray(raw) ? raw : record?.variants;
  const variants: PriceVariant[] = [];

  if (Array.isArray(list)) {
    list.forEach((entry, index) => {
      const variant = asRecord(entry);
      if (!variant) return;
      const choiceName = Array.isArray(variant.choices)
        ? variant.choices
            .map((choice) => text(asRecord(choice)?.name ?? asRecord(choice)?.itemName ?? choice))
            .filter(Boolean)
            .join(" / ")
        : "";
      const option = text(variant.name) || text(variant.label) || choiceName || (list.length === 1 ? "Standard" : `Option ${index + 1}`);
      const price =
        money(variant.price) ??
        money(variant.priceInfo) ??
        money(variant.pricing) ??
        money(variant.formattedPrice);
      if (price == null) return;
      variants.push({ option, price });
    });
  }

  if (variants.length === 0) {
    const price = money(item.price) ?? money(item.priceInfo) ?? money(asRecord(item.pricing)?.price);
    if (price != null) variants.push({ option: "Standard", price });
  }

  return variants;
}

function readModifiers(item: Record<string, unknown>): ModifierGroup[] {
  const groups = item.modifierGroups ?? item.modifiers;
  if (!Array.isArray(groups)) return [];
  const result: ModifierGroup[] = [];
  for (const group of groups) {
    const record = asRecord(group);
    if (!record) continue;
    const name = text(record.name) || "Options";
    const rawOptions = record.modifiers ?? record.options ?? record.items;
    if (!Array.isArray(rawOptions)) continue;
    const options = rawOptions
      .map((option) => (typeof option === "string" ? option.trim() : text(asRecord(option)?.name ?? option)))
      .filter(Boolean);
    if (options.length > 0) result.push({ name, options });
  }
  return result;
}

interface ParsedSection {
  id: string;
  name: string;
  itemIds: string[];
}

function collectSections(snapshot: Record<string, unknown>): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const push = (value: unknown) => {
    const record = asRecord(value);
    if (!record) return;
    const name = canonicalSection(text(record.name));
    if (!name) return;
    const itemIds = Array.isArray(record.itemIds)
      ? record.itemIds.map((id) => text(id)).filter(Boolean)
      : Array.isArray(record.items)
        ? record.items.map((item) => text(asRecord(item)?.id ?? item)).filter(Boolean)
        : [];
    sections.push({ id: text(record.id), name, itemIds });
  };

  if (Array.isArray(snapshot.sections)) snapshot.sections.forEach(push);
  if (Array.isArray(snapshot.menus)) {
    for (const menu of snapshot.menus) {
      const record = asRecord(menu);
      if (!record) continue;
      if (Array.isArray(record.sections)) record.sections.forEach(push);
    }
  }
  return sections;
}

function toMenuItem(
  item: Record<string, unknown>,
  category: string,
): MenuItem | null {
  if (item.visible === false) return null;
  const id = text(item.id);
  const name = text(item.name);
  if (!id || !name) return null;
  const priceVariants = readVariants(item);
  if (priceVariants.length === 0) return null;
  const description = text(item.description);
  const dietaryTags = readTags(item, name);
  const modifierGroups = readModifiers(item);
  const imageUrl = snapshotItemImageUrl(item);
  return {
    id,
    name,
    category,
    description: description || undefined,
    dietaryTags: dietaryTags.length > 0 ? dietaryTags : undefined,
    imageUrl,
    priceVariants,
    modifierGroups: modifierGroups.length > 0 ? modifierGroups : undefined,
  };
}

/**
 * Maps a local snapshot from scripts/pull-wix-snapshot.ts into storefront items.
 * Returns null when the file has no usable menu items, so the caller can fall back.
 */
export function mapWixSnapshotToCatalog(snapshot: unknown): MenuItem[] | null {
  const record = asRecord(snapshot);
  if (!record || !Array.isArray(record.items)) return null;

  const sections = collectSections(record);
  const sectionIdToName = new Map<string, string>();
  const itemIdToSection = new Map<string, string>();
  for (const section of sections) {
    if (section.id) sectionIdToName.set(section.id, section.name);
    for (const itemId of section.itemIds) itemIdToSection.set(itemId, section.name);
  }

  const parsed = new Map<string, MenuItem>();
  const snapshotOrder: string[] = [];
  for (const raw of record.items) {
    const item = asRecord(raw);
    if (!item) continue;
    const id = text(item.id);
    const name = text(item.name);
    if (isRetiredMenuItem(id, name)) continue;
    const sectionId = text(item.sectionId);
    const named =
      itemIdToSection.get(id) ||
      (sectionId ? sectionIdToName.get(sectionId) : undefined) ||
      canonicalSection(text(item.sectionName) || text(item.category)) ||
      inferSection(name);
    const category = named || inferSection(name);
    const menuItem = toMenuItem(item, category);
    if (!menuItem || parsed.has(menuItem.id)) continue;
    parsed.set(menuItem.id, menuItem);
    snapshotOrder.push(menuItem.id);
  }

  if (parsed.size === 0) return null;

  const orderedIds: string[] = [];
  const used = new Set<string>();
  const sectionNames = [
    ...MENU_SECTIONS.filter((name) => sections.some((section) => section.name === name)),
    ...sections.map((section) => section.name).filter((name) => !SECTION_SET.has(name)),
  ];
  const uniqueSectionNames = [...new Set(sectionNames)];

  for (const name of uniqueSectionNames) {
    for (const section of sections.filter((entry) => entry.name === name)) {
      for (const itemId of section.itemIds) {
        if (!parsed.has(itemId) || used.has(itemId)) continue;
        orderedIds.push(itemId);
        used.add(itemId);
      }
    }
  }
  for (const itemId of snapshotOrder) {
    if (!used.has(itemId)) orderedIds.push(itemId);
  }

  return withoutRetiredMenuItems(
    orderedIds.map((id) => parsed.get(id)).filter((item): item is MenuItem => Boolean(item)),
  );
}
