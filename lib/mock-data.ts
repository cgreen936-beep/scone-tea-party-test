import { SNAPSHOT_RECIPES } from "@/lib/snapshot-recipes";

export interface PriceVariant {
    option: string;
    price: number;
  }
  
  export interface ModifierGroup {
    name: string;
    options: string[];
  }

  export type DietaryTag = "V" | "VE" | "GF";

  export const MENU_SECTIONS = [
    "Afternoon Tea",
    "Scones",
    "Sandwich Platters",
    "Grazing Boxes",
    "Cakes",
    "Savoury Treats",
    "Gluten Free Menu",
  ] as const;
  
  export interface MenuItem {
    id: string;
    name: string;
    category: string;
    description?: string;
    dietaryTags?: DietaryTag[];
    imageUrl?: string;
    priceVariants: PriceVariant[];
    modifierGroups?: ModifierGroup[];
  }

  const RETIRED_MENU_IDS = new Set(["d8308752-a134-42b5-95c6-12ba9602a88f"]);
  const RETIRED_MENU_NAMES = new Set(["classic afternoon tea"]);

  /** Classic Afternoon Tea is retired from ordering, including snapshot copies of the same item. */
  export function isRetiredMenuItem(id: string, name: string): boolean {
    return RETIRED_MENU_IDS.has(id.trim()) || RETIRED_MENU_NAMES.has(name.trim().toLowerCase());
  }

  export function withoutRetiredMenuItems(items: MenuItem[]): MenuItem[] {
    return items.filter((item) => !isRetiredMenuItem(item.id, item.name));
  }
  
  export interface OrderLineItem {
    catalogItemId: string;
    name: string;
    variant?: string;
    quantity: number;
    unitPrice: number;
    modifiers?: Record<string, string>;
    specialInstructions?: string;
  }
  
  export interface UnifiedOrder {
    id: string;
    source: "WIX_RETAIL" | "CORPORATE_PORTAL" | "WIX_BOOKING";
    poReference?: string;
    companyName?: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    deliveryAddress: string;
    deliveryDate: string;
    deliveryWindow: string;
    paymentStatus: "PAID" | "NOT_PAID";
    /** Canceled Wix orders stay visible on the schedule and are left out of prep. */
    orderStatus?: "CANCELED";
    fulfillment?: "DELIVERY" | "COLLECTION";
    dietaryNotes?: string;
    lineItems: OrderLineItem[];
  }
  
  export interface IngredientRequirement {
    name: string;
    amountPerUnit: number;
    unit: "g" | "ml" | "loaves" | "units";
    packSize: number;
    packLabel: string;
    morrisonsUrl: string;
  }
  
  export interface RecipeMatrixItem {
    itemId: string;
    itemName: string;
    ingredients: IngredientRequirement[];
    /** Sandwiches this one platter or box produces. Omitted for items that are not sandwiches. */
    sandwichesPerUnit?: number;
    /** Extra £ added to every platter, on top of the ingredient lines. */
    constantCost?: number;
  }
  
  export const WIX_REFERENCE = {
    siteId: "f60551ee-19a7-4963-973d-519aaeeac55e",
    locationId: "9cda4b95-db61-4d43-8c5e-fbf559c4b4ef",
    operationId: "8a2ef506-4344-40c3-b826-7624ed137e2d",
    appId: "9a5d83fd-8570-482e-81ab-cfa88942ee60",
    classicMenuId: "e7085c07-e3e2-4f2a-b5f0-e57effecd032",
  };
  
  export const MOCK_CATALOG: MenuItem[] = [
    {
      id: "a33745c2-bdd0-4b27-b840-70aba010db86",
      name: "Classic Flavours Scone Platter",
      category: "Scones",
      imageUrl: "/images/scone-platter.svg",
      description: "A platter of freshly baked scones, served with preserve and Cornish clotted cream.",
      priceVariants: [
        { option: "Small (4 Scones)", price: 8.5 },
        { option: "Medium (8 Scones)", price: 13.5 },
        { option: "Large (12 Scones)", price: 18.0 },
      ],
      modifierGroups: [
        { name: "Flavours", options: ["Plain", "Fruit", "Cheese", "Mixed"] },
        { name: "Preserve", options: ["Strawberry Jam", "Raspberry Jam", "Clotted Cream Only"] },
      ],
    },
    {
      id: "d13672f8-50d1-4c7a-9709-601354f28010",
      name: "Small Classic Sandwich Platter",
      category: "Sandwich Platters",
      imageUrl: "/images/sandwich-small.svg",
      description: "Classic fillings on soft bakery bread, sized for 3–4 people.",
      priceVariants: [{ option: "Small (3-4 People)", price: 10.0 }],
      modifierGroups: [
        { name: "Fillings Choice", options: ["Ham & Mustard", "Egg Mayonnaise", "Cheese & Chutney", "Mixed Selection"] },
      ],
    },
    {
      id: "4d8483a6-9826-4136-941e-627df9023b86",
      name: "Large Classic Sandwich Platter",
      category: "Sandwich Platters",
      imageUrl: "/images/sandwich-large.svg",
      description: "Classic fillings on soft bakery bread, sized for 6–8 people.",
      priceVariants: [{ option: "Large (6-8 People)", price: 18.0 }],
      modifierGroups: [
        { name: "Fillings Choice", options: ["Ham & Mustard", "Egg Mayonnaise", "Cheese & Chutney", "Cucumber & Cream Cheese"] },
      ],
    },
    {
      id: "05261f77-5dd2-480d-a82e-2787cc0d09ba",
      name: "Extra Large Classic Sandwich Platter",
      category: "Sandwich Platters",
      imageUrl: "/images/sandwich-xl.svg",
      description: "A larger classic platter for about 10 people.",
      priceVariants: [{ option: "Extra Large (10 People)", price: 27.0 }],
      modifierGroups: [
        { name: "Fillings Choice", options: ["Mixed Classic", "No Fish / Meat Heavy", "Vegetarian Mix"] },
      ],
    },
    {
      id: "0c5e1611-5679-4000-a6e4-bcd0aa50c9c5",
      name: "Vegan Sandwich Platter",
      category: "Sandwich Platters",
      imageUrl: "/images/sandwich-vegan.svg",
      description: "Plant-based fillings on soft bread. No meat, fish, eggs, or dairy.",
      dietaryTags: ["VE"],
      priceVariants: [
        { option: "Small", price: 10.0 },
        { option: "Large", price: 18.0 },
        { option: "Extra Large", price: 27.0 },
      ],
      modifierGroups: [
        { name: "Fillings Choice", options: ["Hummus & Roasted Pepper", "Vegan Cheese & Pickle", "Falafel & Spinach"] },
      ],
    },
    {
      id: "d3110813-7bf4-4d18-b2f0-5f39f4e66719",
      name: "Gluten Free Sandwich Platter",
      category: "Gluten Free Menu",
      imageUrl: "/images/sandwich-gf.svg",
      description: "Sandwiches on gluten-free bread, labelled and packed separately.",
      dietaryTags: ["GF"],
      priceVariants: [{ option: "Standard Platter", price: 11.5 }],
      modifierGroups: [
        { name: "Fillings Choice", options: ["Cheddar & Tomato", "Ham & Salad", "Egg Mayo"] },
      ],
    },
    {
      id: "692ddbc9-a009-4691-b87e-1bf8ae481bb2",
      name: "Classic Grazing Platter",
      category: "Grazing Boxes",
      imageUrl: "/images/grazing-box.svg",
      description: "A sharing box of cheese, cured meat, crackers, fruit, and chutney.",
      priceVariants: [
        { option: "Standard Box", price: 28.5 },
        { option: "Deluxe Box", price: 30.0 },
      ],
    },
    {
      id: "236df360-95d9-451c-ba61-1f0d6ba9d166",
      name: "Lemon Traybake Cake",
      category: "Cakes",
      imageUrl: "/images/lemon-traybake.svg",
      description: "A zesty lemon traybake, sliced for sharing.",
      dietaryTags: ["V"],
      priceVariants: [{ option: "Full Traybake", price: 12.5 }],
    },
    {
      id: "7423d8e8-7a70-4f73-b586-9cd3bcff3b76",
      name: "Biscoff Traybake Cake",
      category: "Cakes",
      imageUrl: "/images/biscoff-traybake.svg",
      description: "A biscuit-buttercream traybake finished with Biscoff.",
      dietaryTags: ["V"],
      priceVariants: [{ option: "Full Traybake", price: 15.0 }],
    },
    {
      id: "b22d540e-4c09-4882-90bf-4f02784b3d11",
      name: "Pork Sausage Rolls",
      category: "Savoury Treats",
      imageUrl: "/images/sausage-rolls.svg",
      description: "Seasoned pork sausage rolls, baked until golden. Sold as a box of 12.",
      priceVariants: [{ option: "Box of 12", price: 14.0 }],
    },
  ];

  function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  function safeImageUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("//")) return undefined;
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) {
      return trimmed;
    }
    return undefined;
  }

  function nestedImageUrl(value: unknown): string | undefined {
    return safeImageUrl(asRecord(value)?.url);
  }

  export function snapshotItemImageUrl(item: unknown): string | undefined {
    const record = asRecord(item);
    if (!record) return undefined;
    const media = asRecord(record.media);
    const mainMedia = asRecord(media?.mainMedia);
    const additional = Array.isArray(record.additionalImages) ? record.additionalImages[0] : undefined;
    const images = Array.isArray(record.images) ? record.images[0] : undefined;
    return (
      nestedImageUrl(record.image) ||
      nestedImageUrl(mainMedia?.image) ||
      nestedImageUrl(additional) ||
      safeImageUrl(additional) ||
      nestedImageUrl(images) ||
      safeImageUrl(images)
    );
  }

  function snapshotItemName(value: unknown): string {
    if (typeof value === "string") return value.trim();
    const record = asRecord(value);
    if (!record) return "";
    for (const key of ["original", "translated", "name"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
    return "";
  }

  function localImageUrl(id: string, name: string): string | undefined {
    const lowered = name.trim().toLowerCase();
    return MOCK_CATALOG.find(
      (item) => item.id === id || item.name.trim().toLowerCase() === lowered,
    )?.imageUrl;
  }

  /**
   * Copies image URLs from a local snapshot onto catalog items.
   * Matches mediaMap keys and item records by id, then by name.
   * Leaves the built-in /images path in place when the snapshot has no picture.
   */
  export function applySnapshotMedia(items: MenuItem[], snapshot: unknown): MenuItem[] {
    const record = asRecord(snapshot);
    if (!record) return items;

    const mediaMap = asRecord(record.mediaMap);
    const fromItems = new Map<string, string>();
    if (Array.isArray(record.items)) {
      for (const raw of record.items) {
        const url = snapshotItemImageUrl(raw);
        const item = asRecord(raw);
        if (!url || !item) continue;
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const name = snapshotItemName(item.name).toLowerCase();
        if (id && !fromItems.has(id)) fromItems.set(id, url);
        if (name && !fromItems.has(`name:${name}`)) fromItems.set(`name:${name}`, url);
      }
    }

    return items.map((item) => {
      const nameKey = item.name.trim().toLowerCase();
      const url =
        safeImageUrl(mediaMap?.[item.id]) ||
        safeImageUrl(mediaMap?.[item.name]) ||
        fromItems.get(item.id) ||
        fromItems.get(`name:${nameKey}`) ||
        item.imageUrl ||
        localImageUrl(item.id, item.name);
      if (!url || url === item.imageUrl) return item;
      return { ...item, imageUrl: url };
    });
  }

  export interface PublicSiteImage {
    sourceUrl: string;
    localPath: string;
    alt?: string;
    heading?: string;
    pageUrl?: string;
    role?: string;
  }

  export interface PublicSiteAssets {
    logo?: { sourceUrl: string; localPath: string };
    images?: PublicSiteImage[];
  }

  const SECTION_HINTS: Record<string, string[]> = {
    "Afternoon Tea": ["afternoon", "tea"],
    Scones: ["scone"],
    "Sandwich Platters": ["sandwich"],
    "Grazing Boxes": ["grazing"],
    Cakes: ["cake", "cupcake"],
    "Savoury Treats": ["savoury", "savory", "sausage"],
    "Gluten Free Menu": ["gluten"],
  };

  const BANNER_ALTS = new Set([
    "sandwich platters",
    "grazing boxes",
    "savoury treats",
    "cakes",
    "cupcakes",
    "scones",
    "sweet treats",
    "gluten free menu",
    "extras",
    "christmas menu 2026",
    "online ordering",
  ]);

  function publicPhoto(image: PublicSiteImage): boolean {
    const path = image.localPath ?? "";
    if (!path.startsWith("/wix-clone-assets/") || !/\.(jpe?g|webp)$/i.test(path)) return false;
    if (image.role === "logo") return false;
    if (BANNER_ALTS.has((image.alt ?? "").trim().toLowerCase())) return false;
    const label = `${image.alt ?? ""} ${image.sourceUrl ?? ""} ${path}`.toLowerCase();
    if (/twitter|facebook|instagram|logo|favicon|coming soon/.test(label)) return false;
    if (path.includes("453b7f-dc645bd1fc6b46bba1e4006503802ea8")) return false;
    return true;
  }

  function sectionScore(category: string, heading: string): number {
    const value = heading.toLowerCase();
    const hints = SECTION_HINTS[category] ?? [];
    if (hints.some((hint) => value.includes(hint))) return 6;
    if (category === "Afternoon Tea" && /cake|scone|homemade|sweet/.test(value)) return 4;
    return 0;
  }

  /**
   * Replaces built-in card art with photographs from data/public-site-assets.json
   * when a downloaded picture sits under the same menu section.
   * Items with no matching photograph keep their local /images fallback.
   */
  export function applyPublicAssetImages(items: MenuItem[], assets: PublicSiteAssets | null): MenuItem[] {
    const photos = (assets?.images ?? []).filter(publicPhoto);
    if (photos.length === 0) return items;
    const used = new Set<string>();
    return items.map((item) => {
      let bestPath = "";
      let bestScore = 0;
      let bestIndex = Number.POSITIVE_INFINITY;
      photos.forEach((image, index) => {
        if (used.has(image.localPath)) return;
        const score = sectionScore(item.category, image.heading ?? "");
        if (score > bestScore || (score === bestScore && score > 0 && index < bestIndex)) {
          bestScore = score;
          bestIndex = index;
          bestPath = image.localPath;
        }
      });
      if (bestScore < 4 || !bestPath) return item;
      used.add(bestPath);
      if (bestPath === item.imageUrl) return item;
      return { ...item, imageUrl: bestPath };
    });
  }

  export function publicBrandLogo(assets: PublicSiteAssets | null): string | undefined {
    const fromLogo = safeImageUrl(assets?.logo?.localPath);
    if (fromLogo?.startsWith("/wix-clone-assets/")) return fromLogo;
    const image = assets?.images?.find(
      (entry) =>
        entry.role === "logo" ||
        /logo/i.test(entry.alt ?? "") ||
        /logobg/i.test(entry.sourceUrl ?? ""),
    );
    const path = safeImageUrl(image?.localPath);
    return path?.startsWith("/wix-clone-assets/") ? path : undefined;
  }
  
  export const RECIPE_MATRIX: RecipeMatrixItem[] = [
    {
      itemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
      itemName: "Classic Flavours Scone Platter",
      ingredients: [
        { name: "Self-Raising Flour", amountPerUnit: 500, unit: "g", packSize: 1000, packLabel: "Self-Raising Flour per kg", morrisonsUrl: "" },
        { name: "Unsalted Butter", amountPerUnit: 125, unit: "g", packSize: 1000, packLabel: "Unsalted Butter per kg", morrisonsUrl: "" },
        { name: "Whole Milk", amountPerUnit: 150, unit: "ml", packSize: 1000, packLabel: "Whole Milk per litre", morrisonsUrl: "" },
        { name: "Free Range Egg", amountPerUnit: 2, unit: "units", packSize: 1, packLabel: "Free Range Egg each", morrisonsUrl: "" },
        { name: "Blueberries", amountPerUnit: 40, unit: "g", packSize: 1000, packLabel: "Blueberries per kg", morrisonsUrl: "" },
        { name: "Cornish Clotted Cream", amountPerUnit: 200, unit: "g", packSize: 1000, packLabel: "Cornish Clotted Cream per kg", morrisonsUrl: "" },
        { name: "Strawberry Jam", amountPerUnit: 170, unit: "g", packSize: 100, packLabel: "Strawberry Jam per 100g", morrisonsUrl: "" },
      ],
    },
    {
      itemId: "4d8483a6-9826-4136-941e-627df9023b86",
      itemName: "Large Classic Sandwich Platter",
      sandwichesPerUnit: 8,
      ingredients: [
        { name: "Thick White Bread Loaf", amountPerUnit: 1.5, unit: "loaves", packSize: 1, packLabel: "Thick White Bread Loaf each", morrisonsUrl: "" },
        { name: "Unsalted Butter", amountPerUnit: 75, unit: "g", packSize: 1000, packLabel: "Unsalted Butter per kg", morrisonsUrl: "" },
        { name: "Honey Roast Ham", amountPerUnit: 160, unit: "g", packSize: 1000, packLabel: "Honey Roast Ham per kg", morrisonsUrl: "" },
        { name: "Mature Cheddar", amountPerUnit: 140, unit: "g", packSize: 1000, packLabel: "Mature Cheddar per kg", morrisonsUrl: "" },
        { name: "Free Range Egg", amountPerUnit: 2, unit: "units", packSize: 1, packLabel: "Free Range Egg each", morrisonsUrl: "" },
        { name: "Mayonnaise", amountPerUnit: 40, unit: "ml", packSize: 1000, packLabel: "Mayonnaise per litre", morrisonsUrl: "" },
        { name: "Tuna", amountPerUnit: 80, unit: "g", packSize: 1000, packLabel: "Tuna per kg", morrisonsUrl: "" },
        { name: "Cucumber", amountPerUnit: 50, unit: "g", packSize: 1000, packLabel: "Cucumber per kg", morrisonsUrl: "" },
        { name: "English Mustard", amountPerUnit: 15, unit: "g", packSize: 100, packLabel: "English Mustard per 100g", morrisonsUrl: "" },
      ],
    },
    {
      itemId: "236df360-95d9-451c-ba61-1f0d6ba9d166",
      itemName: "Lemon Traybake Cake",
      ingredients: [
        { name: "Self-Raising Flour", amountPerUnit: 275, unit: "g", packSize: 1000, packLabel: "Self-Raising Flour per kg", morrisonsUrl: "" },
        { name: "Unsalted Butter", amountPerUnit: 275, unit: "g", packSize: 1000, packLabel: "Unsalted Butter per kg", morrisonsUrl: "" },
        { name: "Caster Sugar", amountPerUnit: 350, unit: "g", packSize: 1000, packLabel: "Caster Sugar per kg", morrisonsUrl: "" },
        { name: "Free Range Egg", amountPerUnit: 4, unit: "units", packSize: 1, packLabel: "Free Range Egg each", morrisonsUrl: "" },
        { name: "Lemon", amountPerUnit: 2, unit: "units", packSize: 1, packLabel: "Lemon each", morrisonsUrl: "" },
        { name: "Lemon Curd", amountPerUnit: 80, unit: "g", packSize: 100, packLabel: "Lemon Curd per 100g", morrisonsUrl: "" },
        { name: "Icing Sugar", amountPerUnit: 120, unit: "g", packSize: 1000, packLabel: "Icing Sugar per kg", morrisonsUrl: "" },
      ],
    },
    ...SNAPSHOT_RECIPES,
  ];
  
  const TODAY = "2026-11-26";
  
  export const INITIAL_ORDERS: UnifiedOrder[] = [
    {
      id: "WIX-10482",
      source: "WIX_RETAIL",
      contactName: "Eleanor Vance",
      contactEmail: "eleanor.vance@example.co.uk",
      contactPhone: "07700 900412",
      deliveryAddress: "14 High Street, Newcastle-under-Lyme, ST5 1RA",
      deliveryDate: TODAY,
      deliveryWindow: "10:30 - 11:00",
      paymentStatus: "PAID",
      dietaryNotes: "1x Nut allergy in household - keep walnut items separate.",
      lineItems: [
        {
          catalogItemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
          name: "Classic Flavours Scone Platter",
          variant: "Small (4 Scones)",
          quantity: 1,
          unitPrice: 8.5,
          modifiers: { Flavours: "Fruit", Preserve: "Strawberry Jam" },
        },
        {
          catalogItemId: "236df360-95d9-451c-ba61-1f0d6ba9d166",
          name: "Lemon Traybake Cake",
          variant: "Full Traybake",
          quantity: 1,
          unitPrice: 12.5,
        },
      ],
    },
    {
      id: "CORP-2091",
      source: "CORPORATE_PORTAL",
      poReference: "PO-NHS-88412",
      companyName: "Keele University Innovation Centre",
      contactName: "Marcus Bennett",
      contactEmail: "accounts.payable@keele-mock.ac.uk",
      contactPhone: "01782 555019",
      deliveryAddress: "IC5 Building, Keele Science Park, ST5 5NB",
      deliveryDate: TODAY,
      deliveryWindow: "12:00 - 12:30",
      paymentStatus: "NOT_PAID",
      dietaryNotes: "2 attendees strictly Gluten Free. Label platters clearly.",
      lineItems: [
        {
          catalogItemId: "4d8483a6-9826-4136-941e-627df9023b86",
          name: "Large Classic Sandwich Platter",
          variant: "Large (6-8 People)",
          quantity: 3,
          unitPrice: 18.0,
          modifiers: { "Fillings Choice": "Ham & Mustard" },
        },
        {
          catalogItemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
          name: "Classic Flavours Scone Platter",
          variant: "Large (12 Scones)",
          quantity: 2,
          unitPrice: 18.0,
          modifiers: { Flavours: "Mixed", Preserve: "Strawberry Jam" },
        },
        {
          catalogItemId: "d3110813-7bf4-4d18-b2f0-5f39f4e66719",
          name: "Gluten Free Sandwich Platter",
          variant: "Standard Platter",
          quantity: 1,
          unitPrice: 11.5,
          modifiers: { "Fillings Choice": "Cheddar & Tomato" },
        },
      ],
    },
  ];

  /**
   * Ten local orders for 2 December 2026. Three Stoke-on-Trent districts share
   * an 11:30, 11:33, and 11:35 slot so the delivery run can flag the clash.
   * These rows are not written to the Wix snapshot.
   */
  const DECEMBER_CLASH_ORDERS: UnifiedOrder[] = [
    {
      id: "MOCK-DEC2-01",
      source: "CORPORATE_PORTAL",
      companyName: "Burslem Pottery Lunch",
      contactName: "Nina Croft",
      contactEmail: "nina.croft@example.co.uk",
      contactPhone: "07700 900201",
      deliveryAddress: "4 Market Place, Burslem, Stoke-on-Trent, ST6 1BU",
      deliveryDate: "2026-12-02",
      deliveryWindow: "09:00 - 09:15",
      paymentStatus: "PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "d13672f8-50d1-4c7a-9709-601354f28010",
          name: "Small Classic Sandwich Platter",
          variant: "Small (3-4 People)",
          quantity: 1,
          unitPrice: 10,
          modifiers: { "Fillings Choice": "Ham & Mustard" },
        },
      ],
    },
    {
      id: "MOCK-DEC2-02",
      source: "CORPORATE_PORTAL",
      companyName: "Newcastle Treat Box",
      contactName: "Owen Blake",
      contactEmail: "owen.blake@example.co.uk",
      contactPhone: "07700 900202",
      deliveryAddress: "22 High Street, Newcastle-under-Lyme, ST5 1RA",
      deliveryDate: "2026-12-02",
      deliveryWindow: "09:30 - 09:45",
      paymentStatus: "PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "snapshot:classic-rocky-road",
          name: "Classic Rocky Road",
          variant: "Standard",
          quantity: 1,
          unitPrice: 12,
        },
      ],
    },
    {
      id: "MOCK-DEC2-03",
      source: "CORPORATE_PORTAL",
      companyName: "Longton Cake Counter",
      contactName: "Priya Shah",
      contactEmail: "priya.shah@example.co.uk",
      contactPhone: "07700 900203",
      deliveryAddress: "8 Times Square, Longton, Stoke-on-Trent, ST3 2LN",
      deliveryDate: "2026-12-02",
      deliveryWindow: "10:15 - 10:30",
      paymentStatus: "PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "236df360-95d9-451c-ba61-1f0d6ba9d166",
          name: "Lemon Traybake Cake",
          variant: "Full Traybake",
          quantity: 1,
          unitPrice: 12.5,
        },
      ],
    },
    {
      id: "MOCK-DEC2-04",
      source: "CORPORATE_PORTAL",
      poReference: "PO-HANLEY-40",
      companyName: "Hanley Town Hall",
      contactName: "Helen Ward",
      contactEmail: "helen.ward@example.co.uk",
      contactPhone: "07700 900204",
      deliveryAddress: "18 Piccadilly, Hanley, Stoke-on-Trent, ST1 1HH",
      deliveryDate: "2026-12-02",
      deliveryWindow: "11:30 - 11:35",
      paymentStatus: "NOT_PAID",
      fulfillment: "DELIVERY",
      dietaryNotes: "About 40 guests. Large spread.",
      lineItems: [
        {
          catalogItemId: "05261f77-5dd2-480d-a82e-2787cc0d09ba",
          name: "Extra Large Classic Sandwich Platter",
          variant: "Extra Large (10 People)",
          quantity: 4,
          unitPrice: 27,
          modifiers: { "Fillings Choice": "Mixed Classic" },
        },
        {
          catalogItemId: "692ddbc9-a009-4691-b87e-1bf8ae481bb2",
          name: "Classic Grazing Platter",
          variant: "Standard Box",
          quantity: 5,
          unitPrice: 28.5,
        },
        {
          catalogItemId: "snapshot:homemade-quiche",
          name: "Homemade Quiche",
          variant: "Standard",
          quantity: 5,
          unitPrice: 18,
        },
        {
          catalogItemId: "snapshot:selection-of-cupcakes",
          name: "Selection of Cupcakes",
          variant: "Standard",
          quantity: 4,
          unitPrice: 12,
        },
        {
          catalogItemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
          name: "Classic Flavours Scone Platter",
          variant: "Large (12 Scones)",
          quantity: 4,
          unitPrice: 18,
          modifiers: { Flavours: "Mixed", Preserve: "Strawberry Jam" },
        },
      ],
    },
    {
      id: "MOCK-DEC2-05",
      source: "CORPORATE_PORTAL",
      companyName: "Fenton Works Canteen",
      contactName: "Mark Doyle",
      contactEmail: "mark.doyle@example.co.uk",
      contactPhone: "07700 900205",
      deliveryAddress: "51 Victoria Road, Fenton, Stoke-on-Trent, ST4 3FT",
      deliveryDate: "2026-12-02",
      deliveryWindow: "11:33 - 11:38",
      paymentStatus: "NOT_PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "4d8483a6-9826-4136-941e-627df9023b86",
          name: "Large Classic Sandwich Platter",
          variant: "Large (6-8 People)",
          quantity: 2,
          unitPrice: 18,
          modifiers: { "Fillings Choice": "Cheese & Chutney" },
        },
        {
          catalogItemId: "snapshot:cheese-and-tomato-pastry-pinwheels",
          name: "Cheese and Tomato Pastry Pinwheels",
          variant: "Standard",
          quantity: 2,
          unitPrice: 12,
        },
        {
          catalogItemId: "236df360-95d9-451c-ba61-1f0d6ba9d166",
          name: "Lemon Traybake Cake",
          variant: "Full Traybake",
          quantity: 1,
          unitPrice: 12.5,
        },
      ],
    },
    {
      id: "MOCK-DEC2-06",
      source: "WIX_RETAIL",
      companyName: "Shelton Studio",
      contactName: "Asha Green",
      contactEmail: "asha.green@example.co.uk",
      contactPhone: "07700 900206",
      deliveryAddress: "9 College Road, Shelton, Stoke-on-Trent, ST1 4SH",
      deliveryDate: "2026-12-02",
      deliveryWindow: "11:35 - 11:40",
      paymentStatus: "PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "snapshot:selection-of-cupcakes",
          name: "Selection of Cupcakes",
          variant: "Standard",
          quantity: 1,
          unitPrice: 12,
        },
      ],
    },
    {
      id: "MOCK-DEC2-07",
      source: "CORPORATE_PORTAL",
      companyName: "Blurton Family Centre",
      contactName: "Joanne Kirk",
      contactEmail: "joanne.kirk@example.co.uk",
      contactPhone: "07700 900207",
      deliveryAddress: "27 Blurton Road, Blurton, Stoke-on-Trent, ST3 4BL",
      deliveryDate: "2026-12-02",
      deliveryWindow: "12:10 - 12:25",
      paymentStatus: "NOT_PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "4d8483a6-9826-4136-941e-627df9023b86",
          name: "Large Classic Sandwich Platter",
          variant: "Large (6-8 People)",
          quantity: 2,
          unitPrice: 18,
          modifiers: { "Fillings Choice": "Egg Mayonnaise" },
        },
        {
          catalogItemId: "b22d540e-4c09-4882-90bf-4f02784b3d11",
          name: "Pork Sausage Rolls",
          variant: "Box of 12",
          quantity: 1,
          unitPrice: 14,
        },
      ],
    },
    {
      id: "MOCK-DEC2-08",
      source: "CORPORATE_PORTAL",
      poReference: "PO-HARTSHILL-30",
      companyName: "Hartshill Community Hall",
      contactName: "Steven Moss",
      contactEmail: "steven.moss@example.co.uk",
      contactPhone: "07700 900208",
      deliveryAddress: "3 Ashlands Road, Hartshill, Stoke-on-Trent, ST4 7HA",
      deliveryDate: "2026-12-02",
      deliveryWindow: "14:00 - 14:20",
      paymentStatus: "NOT_PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "05261f77-5dd2-480d-a82e-2787cc0d09ba",
          name: "Extra Large Classic Sandwich Platter",
          variant: "Extra Large (10 People)",
          quantity: 3,
          unitPrice: 27,
          modifiers: { "Fillings Choice": "Vegetarian Mix" },
        },
        {
          catalogItemId: "692ddbc9-a009-4691-b87e-1bf8ae481bb2",
          name: "Classic Grazing Platter",
          variant: "Deluxe Box",
          quantity: 3,
          unitPrice: 30,
        },
        {
          catalogItemId: "snapshot:homemade-quiche",
          name: "Homemade Quiche",
          variant: "Standard",
          quantity: 3,
          unitPrice: 18,
        },
        {
          catalogItemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
          name: "Classic Flavours Scone Platter",
          variant: "Large (12 Scones)",
          quantity: 2,
          unitPrice: 18,
          modifiers: { Flavours: "Plain", Preserve: "Clotted Cream Only" },
        },
      ],
    },
    {
      id: "MOCK-DEC2-09",
      source: "CORPORATE_PORTAL",
      companyName: "Keele Afternoon Meeting",
      contactName: "Claire Dunn",
      contactEmail: "claire.dunn@example.co.uk",
      contactPhone: "07700 900209",
      deliveryAddress: "IC2, Keele Science Park, Keele, ST5 5NB",
      deliveryDate: "2026-12-02",
      deliveryWindow: "15:00 - 15:20",
      paymentStatus: "NOT_PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "692ddbc9-a009-4691-b87e-1bf8ae481bb2",
          name: "Classic Grazing Platter",
          variant: "Standard Box",
          quantity: 1,
          unitPrice: 28.5,
        },
        {
          catalogItemId: "a33745c2-bdd0-4b27-b840-70aba010db86",
          name: "Classic Flavours Scone Platter",
          variant: "Medium (8 Scones)",
          quantity: 1,
          unitPrice: 13.5,
          modifiers: { Flavours: "Fruit", Preserve: "Raspberry Jam" },
        },
        {
          catalogItemId: "snapshot:selection-of-cupcakes",
          name: "Selection of Cupcakes",
          variant: "Standard",
          quantity: 1,
          unitPrice: 12,
        },
      ],
    },
    {
      id: "MOCK-DEC2-10",
      source: "WIX_RETAIL",
      companyName: "Tunstall Bookshop",
      contactName: "Paul Ike",
      contactEmail: "paul.ike@example.co.uk",
      contactPhone: "07700 900210",
      deliveryAddress: "12 High Street, Tunstall, Stoke-on-Trent, ST6 6TN",
      deliveryDate: "2026-12-02",
      deliveryWindow: "16:15 - 16:30",
      paymentStatus: "PAID",
      fulfillment: "DELIVERY",
      lineItems: [
        {
          catalogItemId: "snapshot:classic-crisp-box",
          name: "Classic Crisp Box",
          variant: "Standard",
          quantity: 1,
          unitPrice: 8,
        },
      ],
    },
  ];

  INITIAL_ORDERS.push(...DECEMBER_CLASH_ORDERS);