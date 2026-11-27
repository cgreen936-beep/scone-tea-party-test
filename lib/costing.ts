import { RECIPE_MATRIX, type IngredientRequirement, type RecipeMatrixItem } from "@/lib/mock-data";
import { resolveMorrisonsUrl, savedMorrisonsProductUrl } from "@/lib/morrisons-url";

export type SupplyChannel = "morrisons" | "other";
export type SupplyUnit = IngredientRequirement["unit"];

export interface CatalogueItem {
  id: string;
  name: string;
  channel: SupplyChannel;
  supplier: string;
  unit: SupplyUnit;
  packSize: number;
  packLabel: string;
  cost: number;
  morrisonsUrl: string;
}

export type EnteredUnit = "g" | "kg" | "ml" | "units";

export const OVEN_BATCH_GROUPS = [
  { id: "none", label: "Not baked", defaultMinutes: 0, defaultTemperatureC: 0 },
  { id: "savoury-pastry", label: "Savoury pastry", defaultMinutes: 25, defaultTemperatureC: 190 },
  { id: "cakes", label: "Cakes", defaultMinutes: 35, defaultTemperatureC: 180 },
  { id: "brownies", label: "Brownies", defaultMinutes: 25, defaultTemperatureC: 160 },
  { id: "scones", label: "Scones", defaultMinutes: 15, defaultTemperatureC: 200 },
  { id: "savoury-hot", label: "Savoury hot food", defaultMinutes: 40, defaultTemperatureC: 190 },
] as const;

export type OvenBatchGroupId = (typeof OVEN_BATCH_GROUPS)[number]["id"];

/** Total three-phase power of one oven. Do not multiply this, or £/kWh, by 3. */
export const DEFAULT_OVEN_KW = 5.6;
export const DEFAULT_ELECTRICITY_RATE_PER_KWH = 0.3;
/** 1 charges the full rated kW. A lower figure is the average draw while the oven cycles. */
export const DEFAULT_DUTY_CYCLE = 1;
export const TRAYS_PER_OVEN = 4;
export const TRAYS_BOTH_OVENS = 6;

export interface BakeSettings {
  electricityRatePerKwh: number;
  ovenKw: number;
  /** 1 uses the full oven kW. Lower is average draw. This is not a three-phase multiplier. */
  dutyCycle: number;
}

export const DEFAULT_BAKE_SETTINGS: BakeSettings = {
  electricityRatePerKwh: DEFAULT_ELECTRICITY_RATE_PER_KWH,
  ovenKw: DEFAULT_OVEN_KW,
  dutyCycle: DEFAULT_DUTY_CYCLE,
};

export interface RecipeLine {
  catalogueId: string;
  /** Quantity in the catalogue item's unit, used by the calculator and trolley. */
  quantity: number;
  enteredQuantity?: number;
  enteredUnit?: EnteredUnit;
}

export interface EditableRecipe {
  itemId: string;
  itemName: string;
  sandwichesPerUnit: number;
  boxType: string;
  notes: string;
  constantCost: number;
  /** Optional £ for one bake. When set, this replaces kW × time × £/kWh for this item. */
  electricityCost?: number;
  /** Minutes to prepare one item or batch. Labour uses this. Bake time is separate. */
  prepMinutes?: number;
  /** Customer price for one item. When omitted, the catalog price is used. */
  salePriceOverride?: number;
  /** VAT percent charged on the sale. Cold takeaway food is often 0. */
  vatRate?: number;
  /** True when the sale price already includes VAT. */
  salePriceIncludesVat?: boolean;
  /** When true, supplier and box costs are reduced by their input VAT. */
  recoverInputVat?: boolean;
  /** VAT percent included in ingredient pack prices. */
  supplyInputVatRate?: number;
  /** VAT percent included in the box price. */
  boxInputVatRate?: number;
  /** Optional £ per hour. Labour stays out of the cost until this is set. */
  labourHourlyRate?: number;
  /** How many sale items this ingredient list and prep time cover. */
  coversUnits?: number;
  /** Small pots used for one sold item. */
  potCount?: number;
  /** £ paid for each small pot. Defaults to £0.10 when a count is set. */
  potUnitCost?: number;
  /** Margin Sarah wants on net revenue, as a percent. */
  targetMarginPercent?: number;
  /** Oven batch. `none` means the item is not baked. */
  bakeGroup?: OvenBatchGroupId;
  /** Minutes the oven is on before the main bake. Quiche uses 30. Other items use 0. */
  preBakeMinutes?: number;
  /** Minutes the oven is on for the main bake. Quiche uses 40 after its pre-bake. */
  bakeMinutes?: number;
  /** Bake temperature in °C. Items share an oven only when this matches, unless a partner choice says otherwise. */
  bakeTemperatureC?: number;
  /**
   * Extra partners that may share an oven. Tokens are `group:<oven group>` or `item:<lowercase name>`.
   * An item choice beats a category choice. With no token, the same oven group and temperature still share.
   */
  canBakeWith?: string[];
  /** Partners that must take their own oven. Same token shape as `canBakeWith`. */
  cannotBakeWith?: string[];
  lines: RecipeLine[];
}

export const VAT_RATE_PRESETS = [0, 5, 20] as const;
export const SMALL_POT_UNIT_COST = 0.1;

export interface NotRegisteredProfit {
  salePrice: number;
  usingOverride: boolean;
  ingredientCost: number;
  boxCost: number;
  potCount: number;
  potUnitCost: number;
  potCost: number;
  electricityCost: number;
  labourCost: number;
  directCost: number;
  vatAmount: number;
  profit: number;
  marginPercent: number;
  registeredVatAmount: number;
  registeredNetSale: number;
  registeredProfit: number;
  registeredMarginPercent: number;
  coversUnits: number;
}

export function notRegisteredItemProfit(input: {
  catalogPrice: number;
  salePriceOverride?: number;
  ingredientCost: number;
  boxCost: number;
  potCount?: number;
  potUnitCost?: number;
  electricityCost?: number;
  prepMinutes?: number;
  labourHourlyRate?: number;
  coversUnits?: number;
}): NotRegisteredProfit {
  const covers = Math.max(1, Math.round(input.coversUnits ?? 1) || 1);
  const usingOverride = input.salePriceOverride !== undefined && Number.isFinite(input.salePriceOverride);
  const salePrice = pence(Math.max(0, usingOverride ? (input.salePriceOverride ?? 0) : input.catalogPrice || 0));
  const ingredientCost = pence(Math.max(0, input.ingredientCost || 0) / covers);
  const boxCost = pence(Math.max(0, input.boxCost || 0));
  const potCount = Math.max(0, Math.round(input.potCount ?? 0) || 0);
  const potUnitCost = pence(input.potUnitCost === undefined ? SMALL_POT_UNIT_COST : Math.max(0, input.potUnitCost));
  const potCost = pence(potCount * potUnitCost);
  const electricityCost = pence(Math.max(0, input.electricityCost ?? 0) / covers);
  const labourBatch =
    input.labourHourlyRate !== undefined && input.labourHourlyRate > 0
      ? (Math.max(0, input.prepMinutes ?? 0) / 60) * input.labourHourlyRate
      : 0;
  const labourCost = pence(labourBatch / covers);
  const directCost = pence(ingredientCost + boxCost + potCost + electricityCost + labourCost);
  const settled = profitOnAmounts(salePrice, directCost);
  return {
    salePrice: settled.salePrice,
    usingOverride,
    ingredientCost,
    boxCost,
    potCount,
    potUnitCost,
    potCost,
    electricityCost,
    labourCost,
    directCost: settled.directCost,
    vatAmount: settled.vatAmount,
    profit: settled.profit,
    marginPercent: settled.marginPercent,
    registeredVatAmount: settled.registeredVatAmount,
    registeredNetSale: settled.registeredNetSale,
    registeredProfit: settled.registeredProfit,
    registeredMarginPercent: settled.registeredMarginPercent,
    coversUnits: covers,
  };
}

export function profitOnAmounts(salePrice: number, directCost: number) {
  const sale = pence(Math.max(0, salePrice));
  const direct = pence(Math.max(0, directCost));
  const profit = pence(sale - direct);
  const marginPercent = sale > 0 ? Math.round((profit / sale) * 1000) / 10 : 0;
  const registeredNetSale = pence(sale / 1.2);
  const registeredVatAmount = pence(sale - registeredNetSale);
  const registeredProfit = pence(registeredNetSale - direct);
  const registeredMarginPercent =
    registeredNetSale > 0 ? Math.round((registeredProfit / registeredNetSale) * 1000) / 10 : 0;
  return {
    salePrice: sale,
    directCost: direct,
    vatAmount: 0,
    profit,
    marginPercent,
    registeredVatAmount,
    registeredNetSale,
    registeredProfit,
    registeredMarginPercent,
  };
}

export interface ItemProfitBreakdown {
  catalogPrice: number;
  priceMissing: boolean;
  usingOverride: boolean;
  vatRate: number;
  priceIncludesVat: boolean;
  grossSale: number;
  vatAmount: number;
  netRevenue: number;
  ingredientCost: number;
  boxCost: number;
  electricityCost: number;
  labourCost: number;
  otherCost: number;
  recoverableVat: number;
  directCost: number;
  batchDirectCost: number;
  netProfit: number;
  batchNetProfit: number;
  marginPercent: number;
  coversUnits: number;
  prepMinutes: number;
  labourRateSet: boolean;
  targetMarginPercent: number;
  suggestedSalePrice: number | null;
  belowTarget: boolean;
}

export const CUPS_DIRECT_BOX_SIZES = ["1", "2", "3", "4", "5"] as const;

export const BOX_TYPES: Array<{ id: string; label: string }> = [
  { id: "none", label: "None / Loose" },
  { id: "cups-1", label: "Cups Direct box size 1" },
  { id: "cups-2", label: "Cups Direct box size 2" },
  { id: "cups-3", label: "Cups Direct box size 3" },
  { id: "cups-4", label: "Cups Direct box size 4" },
  { id: "cups-5", label: "Cups Direct box size 5" },
  { id: "xl-tray", label: "XL Catering Platter Tray & Dome" },
  { id: "standard-tray", label: "Standard Platter Tray" },
  { id: "window-cake", label: "Window Cake Box" },
  { id: "pastry", label: "Pastry Box" },
  { id: "salad", label: "Salad Box" },
];

const BOX_COSTS: Record<string, number> = {
  "cups-1": 0.35,
  "cups-2": 0.45,
  "cups-3": 0.55,
  "cups-4": 0.7,
  "cups-5": 0.9,
  "xl-tray": 1.25,
  "standard-tray": 0.85,
  "window-cake": 0.7,
  pastry: 0.45,
  salad: 0.55,
};

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function boxCatalogueId(boxType: string): string {
  return `box:${boxType}`;
}

export function foodCatalogueId(packLabel: string): string {
  return `cat:${slug(packLabel)}`;
}

function packagingBox(ingredientName: string, itemName: string): string | null {
  const name = ingredientName.trim().toLowerCase();
  if (name === "catering platter tray & wrap") {
    return /extra large/i.test(itemName) ? "xl-tray" : "standard-tray";
  }
  if (name === "pastry liner & box" || name === "pastry box" || name === "box & liner") return "pastry";
  if (name === "traybake liner & box" || name === "cupcake box") return "window-cake";
  return null;
}

function isOtherSupply(name: string): boolean {
  return /tray|liner|wrap|box|dome/i.test(name) && !/fillings|buttercream|cupcake cases/i.test(name);
}

function boxItem(boxType: string): CatalogueItem | null {
  const label = BOX_TYPES.find((entry) => entry.id === boxType)?.label;
  if (!label || boxType === "none") return null;
  return {
    id: boxCatalogueId(boxType),
    name: label,
    channel: "other",
    supplier: boxType.startsWith("cups-") ? "Cups Direct" : "Catering packaging",
    unit: "units",
    packSize: 1,
    packLabel: label,
    cost: BOX_COSTS[boxType] ?? 0.5,
    morrisonsUrl: "",
  };
}

export function seedCatalogue(priceFor: (label: string) => number): CatalogueItem[] {
  const items = new Map<string, CatalogueItem>();
  for (const boxType of Object.keys(BOX_COSTS)) {
    const item = boxItem(boxType);
    if (item) items.set(item.id, item);
  }
  items.set("pot:small", {
    id: "pot:small",
    name: "Small pot",
    channel: "other",
    supplier: "Catering packaging",
    unit: "units",
    packSize: 1,
    packLabel: "Small pot",
    cost: SMALL_POT_UNIT_COST,
    morrisonsUrl: "",
  });
  for (const recipe of RECIPE_MATRIX) {
    for (const ingredient of recipe.ingredients) {
      if (packagingBox(ingredient.name, recipe.itemName)) continue;
      const id = foodCatalogueId(ingredient.packLabel);
      if (items.has(id)) continue;
      const other = isOtherSupply(ingredient.name);
      items.set(id, {
        id,
        name: ingredient.name,
        channel: other ? "other" : "morrisons",
        supplier: other ? "Catering packaging" : "Morrisons",
        unit: ingredient.unit,
        packSize: ingredient.packSize,
        packLabel: ingredient.packLabel,
        cost: priceFor(ingredient.packLabel),
        morrisonsUrl: other ? "" : savedMorrisonsProductUrl(ingredient.morrisonsUrl),
      });
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
}

/** £15 an hour is £0.25 a minute. Prep minutes are the labour time, separate from oven minutes. */
export const DEFAULT_LABOUR_HOURLY_RATE = 15;

/**
 * Cups Direct size for a menu item.
 * 5 is extra large, 4 is a standard platter or mixed pastry box, 2 is a salad, quiche, or small pastry, and 3 is everything else.
 */
export function defaultCupsBoxSize(itemName: string): "2" | "3" | "4" | "5" {
  const name = itemName.trim().toLowerCase();
  if (/\bxl\b|extra[ -]?large/.test(name)) return "5";
  if (/salad|quiche/.test(name)) return "2";
  if (/pinwheel|sausage roll|cheese and onion/.test(name)) return "2";
  if (/sandwich|grazing|platter|mixed box of pastries|fruit platter/.test(name)) return "4";
  return "3";
}

/** About 20 minutes for a standard pack, shorter for cold assembly, longer for bakes. */
export function defaultPrepMinutes(itemName: string): number {
  const name = itemName.trim().toLowerCase();
  if (/quiche/.test(name)) return 50;
  if (/traybake/.test(name)) return 45;
  if (/pork pie/.test(name)) return 45;
  if (/cupcake|scone|scotch egg/.test(name)) return 40;
  if (/sausage roll|pinwheel|pastr|cheese and onion|rocky road|tiffin/.test(name)) return 35;
  if (/drumstick|pigs in blanket/.test(name)) return 30;
  if (/afternoon tea|deli/.test(name)) return 25;
  if (/crudites/.test(name)) return 15;
  if (/grazing|cheese box|sweet treat/.test(name)) return 20;
  if (/large salad/.test(name)) return 15;
  if (/sandwich|bagel|bread bun|brioche/.test(name)) return /children|small classic|small vegetarian/.test(name) ? 10 : 15;
  if (/salad|crisp/.test(name)) return 10;
  return 20;
}

export function seedRecipes(): EditableRecipe[] {
  return RECIPE_MATRIX.map((recipe) => {
    const lines: RecipeLine[] = [];
    for (const ingredient of recipe.ingredients) {
      if (packagingBox(ingredient.name, recipe.itemName)) continue;
      lines.push({ catalogueId: foodCatalogueId(ingredient.packLabel), quantity: ingredient.amountPerUnit });
    }
    const namedXl = /extra large/i.test(recipe.itemName) && /sandwich/i.test(recipe.itemName);
    const bake = inferBakeProfile(recipe.itemName);
    return {
      itemId: recipe.itemId,
      itemName: recipe.itemName,
      sandwichesPerUnit: recipe.sandwichesPerUnit ?? (namedXl ? 10 : 0),
      boxType: `cups-${defaultCupsBoxSize(recipe.itemName)}`,
      notes: "",
      constantCost: 0,
      prepMinutes: defaultPrepMinutes(recipe.itemName),
      labourHourlyRate: DEFAULT_LABOUR_HOURLY_RATE,
      bakeGroup: bake.group,
      preBakeMinutes: bake.preBakeMinutes,
      bakeMinutes: bake.minutes,
      bakeTemperatureC: bake.temperatureC,
      lines,
    };
  }).sort((a, b) => a.itemName.localeCompare(b.itemName, "en-GB"));
}

export function resolvedLines(recipe: EditableRecipe): RecipeLine[] {
  const lines = recipe.lines.filter((line) => !line.catalogueId.startsWith("box:"));
  if (recipe.boxType !== "none") {
    lines.push({ catalogueId: boxCatalogueId(recipe.boxType), quantity: 1 });
  }
  return lines;
}

export function recipesToMatrix(recipes: EditableRecipe[], catalogue: CatalogueItem[]): RecipeMatrixItem[] {
  return recipes.map((recipe) => ({
    itemId: recipe.itemId,
    itemName: recipe.itemName,
    sandwichesPerUnit: recipe.sandwichesPerUnit > 0 ? recipe.sandwichesPerUnit : undefined,
    constantCost: Math.round((recipe.constantCost ?? 0) * 100) / 100,
    ingredients: resolvedLines(recipe).flatMap((line) => {
      const item = catalogue.find((entry) => entry.id === line.catalogueId);
      if (!item || line.quantity <= 0) return [];
      return [
        {
          name: item.name,
          amountPerUnit: line.quantity,
          unit: item.unit,
          packSize: item.packSize > 0 ? item.packSize : 1,
          packLabel: item.packLabel,
          morrisonsUrl: item.channel === "morrisons" ? resolveMorrisonsUrl(item.morrisonsUrl, item.name) : "",
        },
      ];
    }),
  }));
}

export function cataloguePrice(catalogue: CatalogueItem[], packLabel: string): number {
  return catalogue.find((item) => item.packLabel === packLabel)?.cost ?? 2.5;
}

export function unitRecipeCost(recipe: RecipeMatrixItem, priceFor: (label: string) => number): number {
  const ingredients = recipe.ingredients.reduce((sum, ingredient) => {
    if (ingredient.packSize <= 0) return sum;
    return sum + (ingredient.amountPerUnit / ingredient.packSize) * priceFor(ingredient.packLabel);
  }, 0);
  return Math.round((ingredients + (recipe.constantCost ?? 0)) * 100) / 100;
}

function pence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function withoutVat(gross: number, ratePercent: number): { net: number; vat: number } {
  const rate = Math.max(0, ratePercent);
  const amount = Math.max(0, gross);
  if (rate === 0) return { net: pence(amount), vat: 0 };
  const net = amount / (1 + rate / 100);
  const roundedNet = pence(net);
  return { net: roundedNet, vat: pence(amount - roundedNet) };
}

export function itemProfitBreakdown(input: {
  catalogPrice: number;
  salePriceOverride?: number;
  vatRate?: number;
  salePriceIncludesVat?: boolean;
  recoverInputVat?: boolean;
  supplyInputVatRate?: number;
  boxInputVatRate?: number;
  ingredientCost: number;
  boxCost: number;
  electricityCost?: number;
  constantCost?: number;
  prepMinutes?: number;
  labourHourlyRate?: number;
  coversUnits?: number;
  targetMarginPercent?: number;
}): ItemProfitBreakdown {
  const catalogPrice = Math.max(0, input.catalogPrice || 0);
  const usingOverride = input.salePriceOverride !== undefined && Number.isFinite(input.salePriceOverride);
  const entered = usingOverride ? Math.max(0, input.salePriceOverride ?? 0) : catalogPrice;
  const vatRate = Math.max(0, input.vatRate ?? 0);
  const priceIncludesVat = input.salePriceIncludesVat !== false;
  const coversUnits = Math.max(1, Math.round(input.coversUnits ?? 1) || 1);
  const prepMinutes = Math.max(0, input.prepMinutes ?? 0);
  const labourRateSet = input.labourHourlyRate !== undefined && input.labourHourlyRate > 0;
  const labourBatch = labourRateSet ? (prepMinutes / 60) * (input.labourHourlyRate ?? 0) : 0;
  const recover = Boolean(input.recoverInputVat);
  const supplyVat = recover ? Math.max(0, input.supplyInputVatRate ?? 0) : 0;
  const boxVat = recover ? Math.max(0, input.boxInputVatRate ?? 20) : 0;
  const ingredientGross = Math.max(0, input.ingredientCost || 0);
  const boxEach = Math.max(0, input.boxCost || 0);
  const ingredientNet = withoutVat(ingredientGross, supplyVat).net;
  const boxEachNet = withoutVat(boxEach, boxVat).net;
  const electricity = Math.max(0, input.electricityCost ?? 0);
  const other = Math.max(0, input.constantCost ?? 0);
  const recoverableVat = pence(ingredientGross - ingredientNet + (boxEach - boxEachNet) * coversUnits);
  const batchDirectCost = pence(ingredientNet + boxEachNet * coversUnits + electricity + other + labourBatch);
  const directCost = pence(batchDirectCost / coversUnits);
  const priced = priceIncludesVat ? withoutVat(entered, vatRate) : { net: pence(entered), vat: pence(entered * (vatRate / 100)) };
  const netRevenue = priced.net;
  const vatAmount = priceIncludesVat ? priced.vat : pence(entered * (vatRate / 100));
  const grossSale = priceIncludesVat ? pence(entered) : pence(netRevenue + vatAmount);
  const netProfit = pence(netRevenue - directCost);
  const marginPercent = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : 0;
  const targetMarginPercent = Math.max(0, input.targetMarginPercent ?? 30);
  const keep = 1 - targetMarginPercent / 100;
  let suggestedSalePrice: number | null = null;
  if (keep > 0 && directCost > 0) {
    const requiredNet = directCost / keep;
    suggestedSalePrice = pence(priceIncludesVat ? requiredNet * (1 + vatRate / 100) : requiredNet);
  }
  return {
    catalogPrice: pence(catalogPrice),
    priceMissing: catalogPrice <= 0,
    usingOverride,
    vatRate,
    priceIncludesVat,
    grossSale,
    vatAmount,
    netRevenue,
    ingredientCost: pence(ingredientNet / coversUnits),
    boxCost: pence(boxEachNet),
    electricityCost: pence(electricity / coversUnits),
    labourCost: pence(labourBatch / coversUnits),
    otherCost: pence(other / coversUnits),
    recoverableVat: pence(recoverableVat / coversUnits),
    directCost,
    batchDirectCost,
    netProfit,
    batchNetProfit: pence(netRevenue * coversUnits - batchDirectCost),
    marginPercent,
    coversUnits,
    prepMinutes,
    labourRateSet,
    targetMarginPercent,
    suggestedSalePrice,
    belowTarget: netRevenue <= 0 || marginPercent < targetMarginPercent,
  };
}

const OVEN_CONFLICTS: Array<{ left: OvenBatchGroupId; right: OvenBatchGroupId; reason: string }> = [
  {
    left: "savoury-pastry",
    right: "cakes",
    reason: "Cakes cannot bake with sausage rolls or pastry pinwheels. Temperature, moisture, and savoury odour do not match.",
  },
  {
    left: "savoury-pastry",
    right: "brownies",
    reason: "Brownies cannot bake with sausage rolls or pastry pinwheels.",
  },
  {
    left: "cakes",
    right: "brownies",
    reason: "Brownies bake cooler and wetter than cakes, so they need their own oven run.",
  },
  {
    left: "savoury-pastry",
    right: "scones",
    reason: "Scones pick up the odour of savoury pastry, so they cannot share that oven.",
  },
  {
    left: "savoury-hot",
    right: "cakes",
    reason: "Roasted savoury food and cakes cannot share an oven.",
  },
  {
    left: "savoury-hot",
    right: "brownies",
    reason: "Roasted savoury food and brownies cannot share an oven.",
  },
  {
    left: "savoury-hot",
    right: "scones",
    reason: "Roasted savoury food and scones cannot share an oven.",
  },
  {
    left: "savoury-pastry",
    right: "savoury-hot",
    reason: "Pastry and roasted savoury food use different oven schedules.",
  },
  {
    left: "cakes",
    right: "scones",
    reason: "Scones and cakes finish at different times and temperatures.",
  },
  {
    left: "brownies",
    right: "scones",
    reason: "Brownies and scones cannot share an oven.",
  },
];

export function ovenGroupLabel(group: OvenBatchGroupId): string {
  return OVEN_BATCH_GROUPS.find((entry) => entry.id === group)?.label ?? "Not baked";
}

export function inferBakeProfile(itemName: string): {
  group: OvenBatchGroupId;
  minutes: number;
  temperatureC: number;
  preBakeMinutes: number;
} {
  const name = itemName.trim().toLowerCase();
  let group: OvenBatchGroupId = "none";
  let preBakeMinutes = 0;
  if (name.includes("brownie")) group = "brownies";
  else if (name.includes("scone")) group = "scones";
  else if (name.includes("pinwheel") || name.includes("sausage roll") || name.includes("cheese and onion roll")) group = "savoury-pastry";
  else if (name.includes("traybake") || name.includes("cupcake") || name.includes("cake")) group = "cakes";
  else if (name.includes("quiche")) {
    group = "savoury-hot";
    preBakeMinutes = 30;
  } else if (name.includes("drumstick") || name.includes("pigs in blanket")) group = "savoury-hot";
  const defaults = OVEN_BATCH_GROUPS.find((entry) => entry.id === group);
  return {
    group,
    minutes: defaults?.defaultMinutes ?? 0,
    temperatureC: defaults?.defaultTemperatureC ?? 0,
    preBakeMinutes,
  };
}

export function dutyFactor(settings: BakeSettings): number {
  const value = settings.dutyCycle;
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** One oven for this many minutes. kW is already the whole three-phase load. */
export function oneOvenElectricity(minutes: number, settings: BakeSettings, duty: number): number {
  const hours = Math.max(0, minutes) / 60;
  const factor = Math.min(1, Math.max(0, duty));
  return pence(Math.max(0, settings.ovenKw) * factor * hours * Math.max(0, settings.electricityRatePerKwh));
}

export function bakeElectricityPounds(minutes: number, settings: BakeSettings, directCost?: number): number {
  if (directCost !== undefined && Number.isFinite(directCost)) return pence(Math.max(0, directCost));
  return oneOvenElectricity(minutes, settings, dutyFactor(settings));
}

export function fullDrawElectricityPounds(minutes: number, settings: BakeSettings): number {
  return oneOvenElectricity(minutes, settings, 1);
}

/** Pre-bake plus main bake for one oven start. A zero pre-bake leaves the main bake unchanged. */
export function ovenProfileCost(preBakeMinutes: number, bakeMinutes: number, settings: BakeSettings, duty?: number): number {
  const factor = duty === undefined ? dutyFactor(settings) : Math.min(1, Math.max(0, duty));
  return pence(oneOvenElectricity(preBakeMinutes, settings, factor) + oneOvenElectricity(bakeMinutes, settings, factor));
}

export function formatBakeOffset(minute: number): string {
  const value = Math.max(0, Math.round(Number.isFinite(minute) ? minute : 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours <= 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

/** One ordered box or platter uses one tray. Sausage-roll and pinwheel boxes are one tray each. */
export function traysForQuantity(quantity: number): number {
  const count = Number.isFinite(quantity) ? quantity : 0;
  return Math.max(0, Math.round(count));
}

/** How many times an oven must be switched on to bake this many trays, capped at 4 per oven and 6 at once. */
export function ovenStartsForTrays(trays: number): number {
  if (trays <= 0) return 0;
  const fullWaves = Math.floor(trays / TRAYS_BOTH_OVENS);
  const remainder = trays % TRAYS_BOTH_OVENS;
  const remainderOvens = remainder === 0 ? 0 : remainder <= TRAYS_PER_OVEN ? 1 : 2;
  return fullWaves * 2 + remainderOvens;
}

export interface ResolvedBake {
  name: string;
  group: OvenBatchGroupId;
  groupLabel: string;
  /** Main bake, after any pre-bake. */
  minutes: number;
  preBakeMinutes: number;
  temperatureC: number;
  baked: boolean;
  usesDirectCost: boolean;
  soloCost: number;
}

export function resolveItemBake(
  name: string,
  itemId: string | undefined,
  recipes: EditableRecipe[],
  settings: BakeSettings,
): ResolvedBake {
  const recipe =
    (itemId ? recipes.find((entry) => entry.itemId === itemId) : undefined) ??
    recipes.find((entry) => entry.itemName.trim().toLowerCase() === name.trim().toLowerCase());
  const inferred = inferBakeProfile(recipe?.itemName ?? name);
  const group = recipe?.bakeGroup ?? inferred.group;
  const minutes = recipe?.bakeMinutes ?? inferred.minutes;
  const preBakeMinutes = recipe?.preBakeMinutes ?? inferred.preBakeMinutes;
  const temperatureC = recipe?.bakeTemperatureC ?? inferred.temperatureC;
  const usesDirectCost = recipe?.electricityCost !== undefined;
  const baked = group !== "none" && (minutes > 0 || preBakeMinutes > 0);
  return {
    name: recipe?.itemName ?? name,
    group,
    groupLabel: ovenGroupLabel(group),
    minutes: baked ? minutes : 0,
    preBakeMinutes: baked ? preBakeMinutes : 0,
    temperatureC: baked ? temperatureC : 0,
    baked,
    usesDirectCost: baked && usesDirectCost,
    soloCost: !baked
      ? 0
      : usesDirectCost
        ? bakeElectricityPounds(minutes, settings, recipe?.electricityCost)
        : ovenProfileCost(preBakeMinutes, minutes, settings),
  };
}

export function conflictReason(left: OvenBatchGroupId, right: OvenBatchGroupId, leftTemp: number, rightTemp: number): string {
  if (left !== "none" && left === right && leftTemp !== rightTemp) {
    return `${rightTemp}°C does not match this ${leftTemp}°C bake, so they need separate oven runs.`;
  }
  const row = OVEN_CONFLICTS.find(
    (entry) => (entry.left === left && entry.right === right) || (entry.left === right && entry.right === left),
  );
  if (row) return row.reason;
  if (left !== right) return `${ovenGroupLabel(left)} and ${ovenGroupLabel(right)} cannot share an oven run.`;
  return "These items need separate oven runs.";
}

export function itemsShareOven(left: ResolvedBake, right: ResolvedBake): boolean {
  return (
    left.baked &&
    right.baked &&
    left.group !== "none" &&
    left.group === right.group &&
    left.temperatureC > 0 &&
    left.temperatureC === right.temperatureC
  );
}

export function bakePartnerGroupToken(group: OvenBatchGroupId): string {
  return `group:${group}`;
}

export function bakePartnerItemToken(name: string): string {
  return `item:${name.trim().toLowerCase()}`;
}

function recipeForBake(bake: ResolvedBake, recipes: EditableRecipe[]): EditableRecipe | undefined {
  return recipes.find((entry) => entry.itemName.trim().toLowerCase() === bake.name.trim().toLowerCase());
}

function partnerList(recipe: EditableRecipe | undefined, key: "canBakeWith" | "cannotBakeWith"): string[] {
  return recipe?.[key] ?? [];
}

/** True when these two bakes may sit in the same oven. Same item always may. A named item block wins, then a named item allow, then a category block, then a category allow, then the same group and temperature. */
export function bakesCanShare(left: ResolvedBake, right: ResolvedBake, recipes: EditableRecipe[]): boolean {
  if (!left.baked || !right.baked) return false;
  const leftName = left.name.trim().toLowerCase();
  const rightName = right.name.trim().toLowerCase();
  if (!leftName || leftName === rightName) return leftName === rightName;
  const leftRecipe = recipeForBake(left, recipes);
  const rightRecipe = recipeForBake(right, recipes);
  const leftCannot = partnerList(leftRecipe, "cannotBakeWith");
  const rightCannot = partnerList(rightRecipe, "cannotBakeWith");
  const leftCan = partnerList(leftRecipe, "canBakeWith");
  const rightCan = partnerList(rightRecipe, "canBakeWith");
  const leftItem = bakePartnerItemToken(left.name);
  const rightItem = bakePartnerItemToken(right.name);
  if (leftCannot.includes(rightItem) || rightCannot.includes(leftItem)) return false;
  if (leftCan.includes(rightItem) || rightCan.includes(leftItem)) return true;
  if (leftCannot.includes(bakePartnerGroupToken(right.group)) || rightCannot.includes(bakePartnerGroupToken(left.group))) return false;
  if (leftCan.includes(bakePartnerGroupToken(right.group)) || rightCan.includes(bakePartnerGroupToken(left.group))) return true;
  return itemsShareOven(left, right);
}

/** Category checkbox. Own oven group starts as can bake with. Any other group starts as cannot. */
export function categoryPartnerChoice(recipe: EditableRecipe, categoryId: OvenBatchGroupId): "can" | "cannot" {
  const token = bakePartnerGroupToken(categoryId);
  if (recipe.cannotBakeWith?.includes(token)) return "cannot";
  if (recipe.canBakeWith?.includes(token)) return "can";
  const group = recipe.bakeGroup ?? inferBakeProfile(recipe.itemName).group;
  return group === categoryId ? "can" : "cannot";
}

function withPartnerToken(recipe: EditableRecipe, token: string, choice: "can" | "cannot"): EditableRecipe {
  const can = (recipe.canBakeWith ?? []).filter((entry) => entry !== token);
  const cannot = (recipe.cannotBakeWith ?? []).filter((entry) => entry !== token);
  if (choice === "can") can.push(token);
  else cannot.push(token);
  return { ...recipe, canBakeWith: can, cannotBakeWith: cannot };
}

/** Writes the choice on this item and the matching items, so both cards show the same tick. */
export function setBakePartner(
  recipes: EditableRecipe[],
  itemName: string,
  token: string,
  choice: "can" | "cannot",
): EditableRecipe[] {
  const currentName = itemName.trim().toLowerCase();
  const current = recipes.find((entry) => entry.itemName.trim().toLowerCase() === currentName);
  if (!current || (!token.startsWith("group:") && !token.startsWith("item:"))) return recipes;
  const currentGroup = current.bakeGroup ?? inferBakeProfile(current.itemName).group;
  if (token.startsWith("group:")) {
    const otherGroup = token.slice("group:".length) as OvenBatchGroupId;
    const mirror = bakePartnerGroupToken(currentGroup);
    return recipes.map((recipe) => {
      const name = recipe.itemName.trim().toLowerCase();
      if (name === currentName) return withPartnerToken(recipe, token, choice);
      const group = recipe.bakeGroup ?? inferBakeProfile(recipe.itemName).group;
      if (group === otherGroup && otherGroup !== currentGroup) return withPartnerToken(recipe, mirror, choice);
      if (otherGroup === currentGroup && group === currentGroup) return withPartnerToken(recipe, token, choice);
      return recipe;
    });
  }
  const otherName = token.slice("item:".length);
  const mirror = bakePartnerItemToken(current.itemName);
  return recipes.map((recipe) => {
    const name = recipe.itemName.trim().toLowerCase();
    if (name === currentName) return withPartnerToken(recipe, token, choice);
    if (name === otherName) return withPartnerToken(recipe, mirror, choice);
    return recipe;
  });
}

export interface BakeCompanion {
  name: string;
  reason: string;
}

export function bakeCompanions(
  current: ResolvedBake,
  names: string[],
  recipes: EditableRecipe[],
  settings: BakeSettings,
): { compatible: string[]; incompatible: BakeCompanion[] } {
  const compatible: string[] = [];
  const incompatible: BakeCompanion[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || key === current.name.trim().toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    const other = resolveItemBake(name, undefined, recipes, settings);
    if (!other.baked) continue;
    if (bakesCanShare(current, other, recipes)) compatible.push(other.name);
    else incompatible.push({ name: other.name, reason: conflictReason(current.group, other.group, current.temperatureC, other.temperatureC) });
  }
  compatible.sort((a, b) => a.localeCompare(b, "en-GB"));
  incompatible.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  return { compatible, incompatible };
}

export function batchGroupNote(group: OvenBatchGroupId): string {
  if (group === "savoury-pastry") {
    return "Pastry pinwheels and sausage rolls can share this oven when the temperature matches. Cakes and brownies cannot bake with them.";
  }
  if (group === "cakes") {
    return "Cakes can share an oven with other cakes at the same temperature. They cannot bake with sausage rolls, pastry pinwheels, or brownies.";
  }
  if (group === "brownies") {
    return "Brownies can share an oven with other brownies at the same temperature. They cannot bake with sausage rolls, pastry pinwheels, or cakes.";
  }
  if (group === "scones") {
    return "Scones can share an oven with other scones at the same temperature. They stay off savoury pastry, cakes, and brownies.";
  }
  if (group === "savoury-hot") {
    return "Drumsticks, quiche, and pigs in blankets can share the main bake when the temperature matches. Quiche also has a 30-minute pre-bake before its 40-minute bake, and that pre-bake stays on the quiche. They cannot bake with cakes, brownies, scones, or savoury pastry.";
  }
  return "This item is not baked, so it does not take an oven run or an electricity charge.";
}

export interface OvenRunItem {
  name: string;
  quantity: number;
  trays: number;
  minutes: number;
  preBakeMinutes: number;
  temperatureC: number;
  soloCost: number;
  /** This item's share of the oven stages it sits in. */
  allocatedCost: number;
}

export interface OvenStageShare {
  name: string;
  trays: number;
  cost: number;
}

export type StageAllocation = "split" | "full";

export interface OvenStage {
  key: string;
  label: string;
  minutes: number;
  startMinute: number;
  trays: number;
  items: OvenStageShare[];
  allocation: StageAllocation;
  electricityCost: number;
  fullDrawCost: number;
  explanation: string;
}

export interface OvenRun {
  key: string;
  wave: number;
  ovenIndex: number;
  ovenCount: number;
  group: OvenBatchGroupId;
  groupLabel: string;
  temperatureC: number;
  /** Pre-bake plus bake for this oven start. */
  minutes: number;
  startMinute: number;
  endMinute: number;
  trays: number;
  shared: boolean;
  items: OvenRunItem[];
  stages: OvenStage[];
  electricityCost: number;
  separateCost: number;
  fullDrawCost: number;
}

export interface OrderOvenPlan {
  runs: OvenRun[];
  trays: number;
  ovenStarts: number;
  electricityCost: number;
  fullDrawElectricityCost: number;
  separateElectricityCost: number;
  electricitySaved: number;
}

interface PendingBakeItem {
  name: string;
  group: OvenBatchGroupId;
  groupLabel: string;
  minutes: number;
  preBakeMinutes: number;
  temperatureC: number;
  traysLeft: number;
  originalTrays: number;
  directCost?: number;
  aloneCost: number;
}

interface PendingBakeGroup {
  key: string;
  group: OvenBatchGroupId;
  groupLabel: string;
  temperatureC: number;
  minutes: number;
  items: PendingBakeItem[];
  traysLeft: number;
}

function itemAloneCost(
  trays: number,
  minutes: number,
  preBakeMinutes: number,
  settings: BakeSettings,
  directCost?: number,
): number {
  const starts = ovenStartsForTrays(trays);
  if (directCost !== undefined && Number.isFinite(directCost)) return pence(starts * Math.max(0, directCost));
  return pence(starts * ovenProfileCost(preBakeMinutes, minutes, settings));
}

function money(value: number): string {
  return `£${pence(value).toFixed(2)}`;
}

function allocateByWeights(total: number, weights: number[]): number[] {
  const pennies = Math.round(pence(total) * 100);
  const weight = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (pennies <= 0 || weight <= 0) return weights.map(() => 0);
  const shares = weights.map((value) => Math.floor((pennies * Math.max(0, value)) / weight));
  let leftover = pennies - shares.reduce((sum, value) => sum + value, 0);
  const ranked = weights
    .map((value, index) => ({ index, fraction: (pennies * Math.max(0, value)) / weight - shares[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const row of ranked) {
    if (leftover <= 0) break;
    shares[row.index] += 1;
    leftover -= 1;
  }
  return shares.map((value) => value / 100);
}

type StageReason = "shared" | "pre-bake" | "incompatible" | "overflow" | "alone";

function explainStage(
  label: string,
  minutes: number,
  cost: number,
  shares: OvenStageShare[],
  reason: StageReason,
  followBakeMinutes = 40,
): string {
  const list = shares
    .map((share) => `${share.name} ${money(share.cost)} (${share.trays} tray${share.trays === 1 ? "" : "s"})`)
    .join(", ");
  if (reason === "shared") {
    const trays = shares.reduce((sum, share) => sum + share.trays, 0);
    return `Split across ${trays} trays: ${list}. This ${minutes}-minute ${label.toLowerCase()} costs ${money(cost)} for the oven once, then that amount is divided by tray.`;
  }
  if (reason === "pre-bake") {
    return `Charged in full at ${money(cost)}. Quiche keeps a ${minutes}-minute pre-bake before its ${followBakeMinutes}-minute bake, and that pre-bake is not split with other items. ${list}.`;
  }
  const only = shares[0]?.name ?? "This item";
  if (reason === "incompatible") {
    return `Charged in full at ${money(cost)}. ${only} cannot share this oven with the other bakes, so this ${minutes}-minute run stays on ${only}. The cost is not multiplied per tray.`;
  }
  if (reason === "overflow") {
    return `Charged in full at ${money(cost)}. These trays do not fit in the earlier oven, so this ${minutes}-minute run is a separate start. The cost is not multiplied per tray. ${list}.`;
  }
  return `Charged in full at ${money(cost)}. ${only} has this oven to itself for ${minutes} minutes, so the run is not split. The cost is not multiplied per tray.`;
}

interface OvenPick {
  item: PendingBakeItem;
  trays: number;
}

function pendingCanShare(left: PendingBakeItem, right: PendingBakeItem, recipes: EditableRecipe[], settings: BakeSettings): boolean {
  if (left.name.trim().toLowerCase() === right.name.trim().toLowerCase()) return true;
  return bakesCanShare(resolveItemBake(left.name, undefined, recipes, settings), resolveItemBake(right.name, undefined, recipes, settings), recipes);
}

function shareComponents(items: PendingBakeItem[], recipes: EditableRecipe[], settings: BakeSettings): PendingBakeItem[][] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      parent[cursor] = parent[parent[cursor]];
      cursor = parent[cursor];
    }
    return cursor;
  };
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (!pendingCanShare(items[left], items[right], recipes, settings)) continue;
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    }
  }
  const grouped = new Map<number, PendingBakeItem[]>();
  items.forEach((item, index) => {
    const root = find(index);
    const list = grouped.get(root) ?? [];
    list.push(item);
    grouped.set(root, list);
  });
  return [...grouped.values()];
}

function selectOvenLoad(
  candidates: PendingBakeItem[],
  seed: PendingBakeItem,
  cap: number,
  reserved: Map<PendingBakeItem, number>,
  recipes: EditableRecipe[],
  settings: BakeSettings,
): OvenPick[] {
  const free = (item: PendingBakeItem) => item.traysLeft - (reserved.get(item) ?? 0);
  if (cap <= 0 || free(seed) <= 0) return [];
  const picks: OvenPick[] = [];
  let room = cap;
  const seedTake = Math.min(room, free(seed));
  picks.push({ item: seed, trays: seedTake });
  room -= seedTake;
  const rest = candidates
    .filter((item) => item !== seed && free(item) > 0)
    .sort((a, b) => free(b) - free(a) || a.name.localeCompare(b.name, "en-GB"));
  for (const item of rest) {
    if (room <= 0) break;
    if (!picks.every((pick) => pendingCanShare(pick.item, item, recipes, settings))) continue;
    const take = Math.min(room, free(item));
    if (take <= 0) continue;
    picks.push({ item, trays: take });
    room -= take;
  }
  return picks;
}

function consumeOvenPicks(picks: OvenPick[], settings: BakeSettings): OvenRunItem[] {
  const taken: OvenRunItem[] = [];
  for (const pick of picks) {
    const use = Math.min(pick.item.traysLeft, pick.trays);
    if (use <= 0) continue;
    pick.item.traysLeft -= use;
    taken.push({
      name: pick.item.name,
      quantity: use,
      trays: use,
      minutes: pick.item.minutes,
      preBakeMinutes: pick.item.preBakeMinutes,
      temperatureC: pick.item.temperatureC,
      soloCost: itemAloneCost(use, pick.item.minutes, pick.item.preBakeMinutes, settings, pick.item.directCost),
      allocatedCost: 0,
    });
  }
  return taken;
}

function groupFromPicks(picks: OvenPick[]): PendingBakeGroup {
  const seed = picks[0]?.item;
  const groups = new Set(picks.map((pick) => pick.item.group));
  return {
    key: seed?.name ?? "oven",
    group: seed?.group ?? "none",
    groupLabel: groups.size > 1 ? "Shared bake" : (seed?.groupLabel ?? "Not baked"),
    temperatureC: seed?.temperatureC ?? 0,
    minutes: picks.reduce((max, pick) => Math.max(max, pick.item.minutes), 0),
    items: picks.map((pick) => pick.item),
    traysLeft: 0,
  };
}

function buildStages(
  taken: OvenRunItem[],
  group: PendingBakeGroup,
  settings: BakeSettings,
  context: { groupCount: number; continued: boolean },
): OvenStage[] {
  const drafts: Array<{ label: string; minutes: number; rows: OvenRunItem[] }> = [];
  const preRows = taken.filter((item) => item.preBakeMinutes > 0);
  if (preRows.length > 0) {
    drafts.push({
      label: "Pre-bake",
      minutes: Math.max(...preRows.map((item) => item.preBakeMinutes)),
      rows: preRows,
    });
  }
  const bakeMinutes = taken.reduce((max, item) => Math.max(max, item.minutes), 0);
  if (bakeMinutes > 0) drafts.push({ label: "Bake", minutes: bakeMinutes, rows: taken });
  const directCosts = taken
    .map((item) => group.items.find((entry) => entry.name === item.name)?.directCost)
    .filter((cost): cost is number => cost !== undefined && Number.isFinite(cost));
  const allDirect = taken.length > 0 && directCosts.length === taken.length;
  const minuteWeights = drafts.map((draft) => draft.minutes);
  const dutyCosts = allDirect
    ? allocateByWeights(pence(Math.max(...directCosts)), minuteWeights)
    : drafts.map((draft) => oneOvenElectricity(draft.minutes, settings, dutyFactor(settings)));
  const ratedCosts = drafts.map((draft) => oneOvenElectricity(draft.minutes, settings, 1));
  return drafts.map((draft, index) => {
    const uniqueNames = new Set(draft.rows.map((row) => row.name.trim().toLowerCase()));
    const allocation: StageAllocation = draft.label === "Bake" && uniqueNames.size > 1 ? "split" : "full";
    const shareCosts = allocateByWeights(dutyCosts[index] ?? 0, draft.rows.map((row) => row.trays));
    const shares = draft.rows.map((row, rowIndex) => ({
      name: row.name,
      trays: row.trays,
      cost: shareCosts[rowIndex] ?? 0,
    }));
    const reason: StageReason =
      draft.label === "Pre-bake"
        ? "pre-bake"
        : allocation === "split"
          ? "shared"
          : context.continued
            ? "overflow"
            : context.groupCount > 1
              ? "incompatible"
              : "alone";
    const followBake = Math.max(...preRows.map((item) => item.minutes), 0);
    return {
      key: `${draft.label.toLowerCase()}-${index}`,
      label: draft.label,
      minutes: draft.minutes,
      startMinute: 0,
      trays: draft.rows.reduce((sum, row) => sum + row.trays, 0),
      items: shares,
      allocation,
      electricityCost: pence(dutyCosts[index] ?? 0),
      fullDrawCost: ratedCosts[index] ?? 0,
      explanation: explainStage(draft.label, draft.minutes, pence(dutyCosts[index] ?? 0), shares, reason, followBake),
    };
  });
}

function stampTimeline(runs: OvenRun[]): void {
  const waves = [...new Set(runs.map((run) => run.wave))].sort((a, b) => a - b);
  let clock = 0;
  for (const wave of waves) {
    let longest = 0;
    for (const run of runs) {
      if (run.wave !== wave) continue;
      run.startMinute = clock;
      let cursor = clock;
      for (const stage of run.stages) {
        stage.startMinute = cursor;
        cursor += stage.minutes;
      }
      run.endMinute = cursor;
      longest = Math.max(longest, cursor - clock);
    }
    clock += longest;
  }
}

export function planOvenRuns(
  lines: Array<{ catalogItemId?: string; name: string; quantity: number }>,
  recipes: EditableRecipe[],
  settings: BakeSettings,
): OrderOvenPlan {
  const merged = new Map<string, { name: string; catalogItemId?: string; quantity: number }>();
  for (const line of lines) {
    const key = line.name.trim().toLowerCase();
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    const current = merged.get(key);
    if (!current) merged.set(key, { name: line.name, catalogItemId: line.catalogItemId, quantity });
    else current.quantity += quantity;
  }
  const waitingItems: PendingBakeItem[] = [];
  let separateElectricityCost = 0;
  for (const line of merged.values()) {
    const bake = resolveItemBake(line.name, line.catalogItemId, recipes, settings);
    if (!bake.baked) continue;
    const trays = traysForQuantity(line.quantity);
    if (trays <= 0) continue;
    const directCost = bake.usesDirectCost
      ? recipes.find((entry) => entry.itemName.trim().toLowerCase() === bake.name.trim().toLowerCase())?.electricityCost
      : undefined;
    const aloneCost = itemAloneCost(trays, bake.minutes, bake.preBakeMinutes, settings, directCost);
    separateElectricityCost += aloneCost;
    waitingItems.push({
      name: bake.name,
      group: bake.group,
      groupLabel: bake.groupLabel,
      minutes: bake.minutes,
      preBakeMinutes: bake.preBakeMinutes,
      temperatureC: bake.temperatureC,
      traysLeft: trays,
      originalTrays: trays,
      directCost,
      aloneCost,
    });
  }
  waitingItems.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  const runs: OvenRun[] = [];
  let wave = 0;
  while (waitingItems.some((item) => item.traysLeft > 0) && wave < 100) {
    wave += 1;
    const waiting = waitingItems.filter((item) => item.traysLeft > 0);
    const components = shareComponents(waiting, recipes, settings).sort((a, b) => {
      const traysOf = (rows: PendingBakeItem[]) => rows.reduce((sum, item) => sum + item.traysLeft, 0);
      const labelOf = (rows: PendingBakeItem[]) => [...rows].sort((left, right) => left.name.localeCompare(right.name, "en-GB"))[0]?.name ?? "";
      return traysOf(b) - traysOf(a) || labelOf(a).localeCompare(labelOf(b), "en-GB");
    });
    const primary = components[0];
    if (!primary) break;
    const seed = [...primary].sort((a, b) => b.traysLeft - a.traysLeft || a.name.localeCompare(b.name, "en-GB"))[0];
    if (!seed) break;
    const traysAtStart = waiting.reduce((sum, item) => sum + item.traysLeft, 0);
    const reserved = new Map<PendingBakeItem, number>();
    const oven1 = selectOvenLoad(primary, seed, TRAYS_PER_OVEN, reserved, recipes, settings);
    for (const pick of oven1) reserved.set(pick.item, (reserved.get(pick.item) ?? 0) + pick.trays);
    const oven1Trays = oven1.reduce((sum, pick) => sum + pick.trays, 0);
    const oven2Cap = Math.min(TRAYS_PER_OVEN, TRAYS_BOTH_OVENS - oven1Trays);
    let oven2: OvenPick[] = [];
    if (traysAtStart > TRAYS_PER_OVEN && oven2Cap > 0) {
      const other = components.slice(1).find((rows) => rows.some((item) => item.traysLeft - (reserved.get(item) ?? 0) > 0));
      const pool = other ?? primary;
      const overflowSeed = [...pool].sort((a, b) => {
        const freeA = a.traysLeft - (reserved.get(a) ?? 0);
        const freeB = b.traysLeft - (reserved.get(b) ?? 0);
        return freeB - freeA || a.name.localeCompare(b.name, "en-GB");
      })[0];
      if (overflowSeed && overflowSeed.traysLeft - (reserved.get(overflowSeed) ?? 0) > 0) {
        oven2 = selectOvenLoad(pool, overflowSeed, oven2Cap, reserved, recipes, settings);
      }
    }
    const loaded = [oven1, oven2].filter((plan) => plan.length > 0);
    if (oven1.length === 0) break;
    loaded.forEach((plan, index) => {
      const continued =
        plan.some((pick) => pick.item.traysLeft < pick.item.originalTrays) ||
        (index > 0 && plan.some((pick) => primary.includes(pick.item)));
      const items = consumeOvenPicks(plan, settings);
      const group = groupFromPicks(plan);
      const stages = buildStages(items, group, settings, {
        groupCount: components.length,
        continued,
      });
      for (const item of items) {
        item.allocatedCost = pence(
          stages.reduce((sum, stage) => sum + (stage.items.find((share) => share.name === item.name)?.cost ?? 0), 0),
        );
      }
      const dutyCost = pence(stages.reduce((sum, stage) => sum + stage.electricityCost, 0));
      const ratedCost = pence(stages.reduce((sum, stage) => sum + stage.fullDrawCost, 0));
      runs.push({
        key: `wave-${wave}-oven-${index + 1}`,
        wave,
        ovenIndex: index + 1,
        ovenCount: loaded.length,
        group: group.group,
        groupLabel: group.groupLabel,
        temperatureC: group.temperatureC,
        minutes: stages.reduce((sum, stage) => sum + stage.minutes, 0),
        startMinute: 0,
        endMinute: 0,
        trays: items.reduce((sum, item) => sum + item.trays, 0),
        shared: stages.some((stage) => stage.allocation === "split"),
        items,
        stages,
        electricityCost: dutyCost,
        separateCost: pence(items.reduce((sum, item) => sum + item.soloCost, 0)),
        fullDrawCost: ratedCost,
      });
    });
  }
  stampTimeline(runs);
  const electricityCost = pence(runs.reduce((sum, run) => sum + run.electricityCost, 0));
  const fullDrawElectricityCost = pence(runs.reduce((sum, run) => sum + run.fullDrawCost, 0));
  const separate = pence(separateElectricityCost);
  return {
    runs,
    trays: runs.reduce((sum, run) => sum + run.trays, 0),
    ovenStarts: runs.length,
    electricityCost,
    fullDrawElectricityCost,
    separateElectricityCost: separate,
    electricitySaved: pence(separate - electricityCost),
  };
}

export function orderElectricityCost(
  lines: Array<{ catalogItemId?: string; name: string; quantity: number }>,
  recipes: EditableRecipe[],
  settings: BakeSettings,
): number {
  return planOvenRuns(lines, recipes, settings).electricityCost;
}

/** Labour for one sold item at the recipe's hourly rate and prep minutes. */
export function recipeLabourUnitCost(recipe: EditableRecipe): number {
  return notRegisteredItemProfit({
    catalogPrice: 0,
    ingredientCost: 0,
    boxCost: 0,
    potCount: 0,
    potUnitCost: 0,
    electricityCost: 0,
    prepMinutes: recipe.prepMinutes,
    labourHourlyRate: recipe.labourHourlyRate,
    coversUnits: recipe.coversUnits,
  }).labourCost;
}

/**
 * Raw stock used by one order, keyed as `name|packLabel`.
 * Ingredient amounts follow the recipe batch. One Cups Direct box is taken per sold item.
 */
export function stockDrawForOrder(
  order: { lineItems: Array<{ catalogItemId?: string; name: string; quantity: number }> },
  recipes: EditableRecipe[],
  catalogue: CatalogueItem[],
): Record<string, number> {
  const used: Record<string, number> = {};
  const add = (key: string, amount: number) => {
    if (!key || !Number.isFinite(amount) || amount === 0) return;
    used[key] = Math.round(((used[key] ?? 0) + amount) * 1000) / 1000;
  };
  for (const line of order.lineItems) {
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    if (quantity === 0) continue;
    const recipe =
      (line.catalogItemId ? recipes.find((entry) => entry.itemId === line.catalogItemId) : undefined) ??
      recipes.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase());
    if (!recipe) continue;
    const covers = Math.max(1, Math.round(recipe.coversUnits ?? 1) || 1);
    for (const entry of recipe.lines) {
      const item = catalogue.find((catalogueItem) => catalogueItem.id === entry.catalogueId);
      if (!item) continue;
      add(`${item.name}|${item.packLabel}`, (entry.quantity / covers) * quantity);
    }
    if (recipe.boxType.startsWith("cups-")) {
      const box = catalogue.find((item) => item.id === `box:${recipe.boxType}`);
      if (box) add(`${box.name}|${box.packLabel}`, quantity);
    }
    const pots = Math.max(0, Math.round(recipe.potCount ?? 0) || 0);
    if (pots > 0) add("Small pot|Small pot", pots * quantity);
  }
  return used;
}

/** Ingredients, Cups Direct box, pots, and labour for one sold item. Oven electricity is left out so a day can add it once. */
export function recipeFoodUnitCost(recipe: EditableRecipe, catalogue: CatalogueItem[]): number {
  const ingredientCost = recipe.lines.reduce((sum, line) => {
    const item = catalogue.find((entry) => entry.id === line.catalogueId);
    if (!item || item.packSize <= 0) return sum;
    return sum + (line.quantity / item.packSize) * item.cost;
  }, 0);
  const boxCost = recipe.boxType.startsWith("cups-")
    ? (catalogue.find((item) => item.id === `box:${recipe.boxType}`)?.cost ?? 0)
    : 0;
  return notRegisteredItemProfit({
    catalogPrice: 0,
    ingredientCost,
    boxCost,
    potCount: recipe.potCount,
    potUnitCost: recipe.potUnitCost,
    electricityCost: 0,
    prepMinutes: recipe.prepMinutes,
    labourHourlyRate: recipe.labourHourlyRate,
    coversUnits: recipe.coversUnits,
  }).directCost;
}

export interface DayProfitLine {
  orderId: string;
  name: string;
  catalogItemId?: string;
  quantity: number;
  unitSale: number;
}

export interface DayProfit {
  salePrice: number;
  foodCost: number;
  electricityCost: number;
  directCost: number;
  vatAmount: number;
  profit: number;
  marginPercent: number;
  registeredVatAmount: number;
  registeredNetSale: number;
  registeredProfit: number;
  registeredMarginPercent: number;
  plan: OrderOvenPlan;
  /** This order's tray share of the day's oven batches. The shares add up to `electricityCost`. */
  orderElectricity: Record<string, number>;
}

function splitElectricityByOrder(lines: DayProfitLine[], plan: OrderOvenPlan): Record<string, number> {
  const traysByItem = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const trays = traysForQuantity(line.quantity);
    if (trays <= 0 || !line.orderId) continue;
    const name = line.name.trim().toLowerCase();
    const orders = traysByItem.get(name) ?? new Map<string, number>();
    orders.set(line.orderId, (orders.get(line.orderId) ?? 0) + trays);
    traysByItem.set(name, orders);
  }
  const costByItem = new Map<string, number>();
  for (const run of plan.runs) {
    for (const item of run.items) {
      const name = item.name.trim().toLowerCase();
      costByItem.set(name, pence((costByItem.get(name) ?? 0) + item.allocatedCost));
    }
  }
  const shares: Record<string, number> = {};
  for (const [name, orders] of traysByItem) {
    const cost = costByItem.get(name) ?? 0;
    if (cost <= 0) continue;
    const ids = [...orders.keys()];
    const weights = ids.map((id) => orders.get(id) ?? 0);
    const parts = allocateByWeights(cost, weights);
    ids.forEach((id, index) => {
      shares[id] = pence((shares[id] ?? 0) + (parts[index] ?? 0));
    });
  }
  return shares;
}

/**
 * Profit for one day. Compatible trays from every order share an oven, up to 4 trays in one oven and 6 across both.
 * That oven cost is split by tray and deducted once. A batch that cannot be shared is its own oven cost.
 */
export function settleDayProfit(
  lines: DayProfitLine[],
  recipes: EditableRecipe[],
  catalogue: CatalogueItem[],
  settings: BakeSettings,
): DayProfit {
  let sale = 0;
  let food = 0;
  for (const line of lines) {
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    if (quantity === 0) continue;
    sale += quantity * Math.max(0, line.unitSale || 0);
    const recipe =
      (line.catalogItemId ? recipes.find((entry) => entry.itemId === line.catalogItemId) : undefined) ??
      recipes.find((entry) => entry.itemName.trim().toLowerCase() === line.name.trim().toLowerCase());
    if (!recipe) continue;
    food += quantity * recipeFoodUnitCost(recipe, catalogue);
  }
  const plan = planOvenRuns(lines, recipes, settings);
  const settled = profitOnAmounts(sale, food + plan.electricityCost);
  return {
    salePrice: settled.salePrice,
    foodCost: pence(food),
    electricityCost: plan.electricityCost,
    directCost: settled.directCost,
    vatAmount: settled.vatAmount,
    profit: settled.profit,
    marginPercent: settled.marginPercent,
    registeredVatAmount: settled.registeredVatAmount,
    registeredNetSale: settled.registeredNetSale,
    registeredProfit: settled.registeredProfit,
    registeredMarginPercent: settled.registeredMarginPercent,
    plan,
    orderElectricity: splitElectricityByOrder(lines, plan),
  };
}

export function findRecipe(matrix: RecipeMatrixItem[], catalogItemId: string, name: string): RecipeMatrixItem | undefined {
  return (
    matrix.find((entry) => entry.itemId === catalogItemId) ??
    matrix.find((entry) => entry.itemName.trim().toLowerCase() === name.trim().toLowerCase())
  );
}
