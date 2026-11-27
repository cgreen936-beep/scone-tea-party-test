import { MOCK_CATALOG, type MenuItem, type PriceVariant } from "@/lib/mock-data";

export const CORPORATE_COMPANIES = ["Biocomposits", "Leoni", "Codeweavers"] as const;

export type CorporateCompany = (typeof CORPORATE_COMPANIES)[number];

export const LOCAL_PORTAL_USERNAME = "admin";
export const LOCAL_PORTAL_PASSWORD = "12345678";

export interface CorporateAccount {
  companyName: CorporateCompany;
  username: string;
  password: string;
}

export interface HistoricalOrderLine {
  catalogItemId: string;
  name: string;
  category: string;
  imageUrl?: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Record<string, string>;
}

/** Delivered history only. These rows are not operational orders and stay off the schedule. */
export interface HistoricalCorporateOrder {
  id: string;
  companyName: CorporateCompany;
  /** Day the company booked. Seeded locally so the card can show the booking date. */
  bookedDate: string;
  deliveryDate: string;
  headcount: number;
  status: "HISTORICAL_DELIVERED";
  lineItems: HistoricalOrderLine[];
}

export interface CategoryShare {
  category: string;
  percent: number;
}

export interface SuggestedLine {
  catalogItemId: string;
  name: string;
  category: string;
  imageUrl?: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Record<string, string>;
  reason: string;
}

export interface SuggestedMenu {
  headcount: number;
  summary: string;
  categoryShares: CategoryShare[];
  lines: SuggestedLine[];
}

export type MenuTierId = "basic" | "standard" | "deluxe";

export interface MenuTemplatePick {
  name: string;
  covers: number;
  portion: string;
}

export interface MenuTemplate {
  id: MenuTierId;
  label: string;
  blurb: string;
  picks: MenuTemplatePick[];
}

export interface MenuTierOption {
  id: MenuTierId;
  label: string;
  blurb: string;
  lines: SuggestedLine[];
  total: number;
  perPerson: number;
  comparison: string;
}

export interface TieredMenuPlan {
  headcount: number;
  pastPerPerson: number;
  pastOrderCount: number;
  pastLabel: string;
  tiers: MenuTierOption[];
}

export const CORPORATE_ACCOUNTS: CorporateAccount[] = CORPORATE_COMPANIES.map((companyName) => ({
  companyName,
  username: LOCAL_PORTAL_USERNAME,
  password: LOCAL_PORTAL_PASSWORD,
}));

function catalogItem(id: string): MenuItem {
  const item = MOCK_CATALOG.find((entry) => entry.id === id);
  if (!item) throw new Error(`Catalog item ${id} is missing.`);
  return item;
}

function line(
  id: string,
  quantity: number,
  variant: string,
  modifiers?: Record<string, string>,
): HistoricalOrderLine {
  const item = catalogItem(id);
  const price = item.priceVariants.find((entry) => entry.option === variant);
  if (!price) throw new Error(`${item.name} has no variant ${variant}.`);
  return {
    catalogItemId: item.id,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
    variant: price.option,
    quantity,
    unitPrice: price.price,
    modifiers,
  };
}

const SCONE = "a33745c2-bdd0-4b27-b840-70aba010db86";
const LARGE_SANDWICH = "4d8483a6-9826-4136-941e-627df9023b86";
const XL_SANDWICH = "05261f77-5dd2-480d-a82e-2787cc0d09ba";
const VEGAN = "0c5e1611-5679-4000-a6e4-bcd0aa50c9c5";
const GLUTEN_FREE = "d3110813-7bf4-4d18-b2f0-5f39f4e66719";
const GRAZING = "692ddbc9-a009-4691-b87e-1bf8ae481bb2";
const LEMON = "236df360-95d9-451c-ba61-1f0d6ba9d166";
const BISCOFF = "7423d8e8-7a70-4f73-b586-9cd3bcff3b76";
const SAUSAGE = "b22d540e-4c09-4882-90bf-4f02784b3d11";

function plated(
  id: string,
  name: string,
  category: string,
  unitPrice: number,
  quantity: number,
): HistoricalOrderLine {
  return { catalogItemId: id, name, category, variant: "Standard", quantity, unitPrice };
}

/** Portions for a headcount. Codeweavers uses a 1.3 buffer, about 30% over the covers needed. */
function unitsFor(people: number, covers: number, buffer = 1): number {
  return Math.max(1, Math.ceil((people * buffer) / covers - 1e-9));
}

function historical(
  id: string,
  companyName: CorporateCompany,
  bookedDate: string,
  deliveryDate: string,
  headcount: number,
  lineItems: HistoricalOrderLine[],
): HistoricalCorporateOrder {
  return { id, companyName, bookedDate, deliveryDate, headcount, status: "HISTORICAL_DELIVERED", lineItems };
}

const MAY_ORDERS: HistoricalCorporateOrder[] = [
  historical("HIST-BIO-1", "Biocomposits", "2026-05-01", "2026-05-07", 20, [
    line(SCONE, 2, "Large (12 Scones)", { Flavours: "Mixed", Preserve: "Strawberry Jam" }),
    line(LEMON, 2, "Full Traybake"),
    line(SAUSAGE, 2, "Box of 12"),
  ]),
  historical("HIST-BIO-2", "Biocomposits", "2026-05-08", "2026-05-14", 30, [
    line(XL_SANDWICH, 3, "Extra Large (10 People)", { "Fillings Choice": "Mixed Classic" }),
    line(SAUSAGE, 3, "Box of 12"),
    line(BISCOFF, 2, "Full Traybake"),
    line(GRAZING, 2, "Standard Box"),
  ]),
  historical("HIST-BIO-3", "Biocomposits", "2026-05-15", "2026-05-21", 40, [
    line(SCONE, 4, "Large (12 Scones)", { Flavours: "Mixed", Preserve: "Strawberry Jam" }),
    line(LEMON, 4, "Full Traybake"),
    line(GLUTEN_FREE, 2, "Standard Platter", { "Fillings Choice": "Cheddar & Tomato" }),
    line(SAUSAGE, 4, "Box of 12"),
  ]),
  historical("HIST-BIO-4", "Biocomposits", "2026-05-22", "2026-05-28", 30, [
    line(XL_SANDWICH, 3, "Extra Large (10 People)", { "Fillings Choice": "Mixed Classic" }),
    line(SAUSAGE, 3, "Box of 12"),
    line(BISCOFF, 2, "Full Traybake"),
    line(GRAZING, 3, "Standard Box"),
    line(LARGE_SANDWICH, 4, "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
  ]),
  historical("HIST-LEO-1", "Leoni", "2026-04-30", "2026-05-06", 40, [
    line(BISCOFF, 4, "Full Traybake"),
    line(LARGE_SANDWICH, 4, "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
    line(SCONE, 4, "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
  ]),
  historical("HIST-LEO-2", "Leoni", "2026-05-07", "2026-05-13", 20, [
    line(XL_SANDWICH, 2, "Extra Large (10 People)", { "Fillings Choice": "No Fish / Meat Heavy" }),
    line(SCONE, 2, "Large (12 Scones)", { Flavours: "Cheese", Preserve: "Clotted Cream Only" }),
    line(SAUSAGE, 2, "Box of 12"),
    line(GLUTEN_FREE, 1, "Standard Platter", { "Fillings Choice": "Ham & Salad" }),
  ]),
  historical("HIST-LEO-3", "Leoni", "2026-05-14", "2026-05-20", 30, [
    line(BISCOFF, 3, "Full Traybake"),
    line(LARGE_SANDWICH, 4, "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
    line(VEGAN, 2, "Large", { "Fillings Choice": "Falafel & Spinach" }),
    line(SCONE, 3, "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
  ]),
  historical("HIST-LEO-4", "Leoni", "2026-05-21", "2026-05-27", 20, [
    line(XL_SANDWICH, 2, "Extra Large (10 People)", { "Fillings Choice": "No Fish / Meat Heavy" }),
    line(SCONE, 2, "Large (12 Scones)", { Flavours: "Cheese", Preserve: "Clotted Cream Only" }),
    line(SAUSAGE, 2, "Box of 12"),
    line(GRAZING, 2, "Deluxe Box"),
  ]),
  historical("HIST-COD-1", "Codeweavers", "2026-05-01", "2026-05-08", 30, [
    line(XL_SANDWICH, unitsFor(30, 10, 1.3), "Extra Large (10 People)", { "Fillings Choice": "Vegetarian Mix" }),
    line(SCONE, unitsFor(30, 12, 1.3), "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
    line(VEGAN, unitsFor(30, 10, 1.3), "Extra Large", { "Fillings Choice": "Hummus & Roasted Pepper" }),
    line(BISCOFF, unitsFor(30, 12, 1.3), "Full Traybake"),
    plated("snapshot:cheese-and-tomato-pastry-pinwheels", "Cheese and Tomato Pastry Pinwheels", "Savoury Treats", 12, unitsFor(30, 12, 1.3)),
    plated("snapshot:homemade-quiche", "Homemade Quiche", "Savoury Treats", 18, unitsFor(30, 8, 1.3)),
  ]),
  historical("HIST-COD-2", "Codeweavers", "2026-05-08", "2026-05-15", 20, [
    line(LEMON, unitsFor(20, 12, 1.3), "Full Traybake"),
    line(GRAZING, unitsFor(20, 8, 1.3), "Deluxe Box"),
    line(SCONE, unitsFor(20, 12, 1.3), "Large (12 Scones)", { Flavours: "Fruit", Preserve: "Strawberry Jam" }),
    plated("snapshot:small-cheese-box", "Small Cheese Box", "Grazing Boxes", 12, unitsFor(20, 6, 1.3)),
    plated("snapshot:selection-of-cupcakes", "Selection of Cupcakes", "Cakes", 12, unitsFor(20, 12, 1.3)),
  ]),
  historical("HIST-COD-3", "Codeweavers", "2026-05-15", "2026-05-22", 40, [
    line(XL_SANDWICH, unitsFor(40, 10, 1.3), "Extra Large (10 People)", { "Fillings Choice": "Vegetarian Mix" }),
    line(SCONE, unitsFor(40, 12, 1.3), "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
    line(VEGAN, unitsFor(40, 10, 1.3), "Extra Large", { "Fillings Choice": "Hummus & Roasted Pepper" }),
    line(BISCOFF, unitsFor(40, 12, 1.3), "Full Traybake"),
    line(GLUTEN_FREE, unitsFor(40, 8, 1.3), "Standard Platter", { "Fillings Choice": "Cheddar & Tomato" }),
    plated("snapshot:brunch-bagel-sandwich-box", "Brunch Bagel Sandwich Box", "Sandwich Platters", 16, unitsFor(40, 8, 1.3)),
    plated("snapshot:deli-meats-grazing-platter", "Deli Meats Grazing Platter", "Grazing Boxes", 30, unitsFor(40, 8, 1.3)),
    plated("snapshot:orange-crunch-tiffin", "Orange Crunch Tiffin", "Cakes", 12, unitsFor(40, 12, 1.3)),
  ]),
  historical("HIST-COD-4", "Codeweavers", "2026-05-22", "2026-05-29", 40, [
    line(LEMON, unitsFor(40, 12, 1.3), "Full Traybake"),
    line(GRAZING, unitsFor(40, 8, 1.3), "Deluxe Box"),
    line(SAUSAGE, unitsFor(40, 12, 1.3), "Box of 12"),
    line(SCONE, unitsFor(40, 12, 1.3), "Large (12 Scones)", { Flavours: "Fruit", Preserve: "Strawberry Jam" }),
    plated("snapshot:brioche-baguette-sandwich-platter", "Brioche Baguette Sandwich Platter", "Sandwich Platters", 18, unitsFor(40, 8, 1.3)),
    plated("snapshot:classic-rocky-road", "Classic Rocky Road", "Cakes", 12, unitsFor(40, 12, 1.3)),
    plated("snapshot:scotch-egg-selection", "Scotch Egg Selection", "Savoury Treats", 12, unitsFor(40, 6, 1.3)),
  ]),
];

/**
 * Local delivered history from April through October.
 * These rows are seeded in this project. They are not written to Wix and stay off the schedule.
 * Codeweavers quantities are about 30% above the covers needed for the headcount.
 */
const APRIL_TO_OCTOBER_ORDERS: HistoricalCorporateOrder[] = [
  historical("HIST-BIO-APR", "Biocomposits", "2026-04-02", "2026-04-09", 40, [
    line(XL_SANDWICH, unitsFor(40, 10), "Extra Large (10 People)", { "Fillings Choice": "Mixed Classic" }),
    plated("snapshot:brunch-bagel-sandwich-box", "Brunch Bagel Sandwich Box", "Sandwich Platters", 16, unitsFor(40, 8)),
    line(GRAZING, unitsFor(40, 8), "Standard Box"),
    plated("snapshot:cheese-and-tomato-pastry-pinwheels", "Cheese and Tomato Pastry Pinwheels", "Savoury Treats", 12, unitsFor(40, 12)),
    plated("snapshot:homemade-quiche", "Homemade Quiche", "Savoury Treats", 18, unitsFor(40, 8)),
    line(SCONE, unitsFor(40, 12), "Large (12 Scones)", { Flavours: "Mixed", Preserve: "Strawberry Jam" }),
    line(LEMON, unitsFor(40, 12), "Full Traybake"),
    plated("snapshot:selection-of-cupcakes", "Selection of Cupcakes", "Cakes", 12, unitsFor(40, 12)),
  ]),
  historical("HIST-LEO-APR", "Leoni", "2026-04-08", "2026-04-16", 40, [
    plated("snapshot:bread-bun-sandwich-platter", "Bread Bun Sandwich Platter", "Sandwich Platters", 16, unitsFor(40, 8)),
    plated("snapshot:deli-meats-grazing-platter", "Deli Meats Grazing Platter", "Grazing Boxes", 30, unitsFor(40, 8)),
    plated("snapshot:cheesy-garlic-pinwheels", "Cheesy Garlic Pinwheels", "Savoury Treats", 12, unitsFor(40, 12)),
    plated("snapshot:bbq-chicken-drumsticks", "BBQ Chicken Drumsticks", "Savoury Treats", 16, unitsFor(40, 10)),
    line(SCONE, unitsFor(40, 12), "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
    plated("snapshot:classic-rocky-road", "Classic Rocky Road", "Cakes", 12, unitsFor(40, 12)),
    plated("snapshot:orange-crunch-tiffin", "Orange Crunch Tiffin", "Cakes", 12, unitsFor(40, 12)),
  ]),
  historical("HIST-COD-APR", "Codeweavers", "2026-04-16", "2026-04-23", 40, [
    line(VEGAN, unitsFor(40, 10, 1.3), "Extra Large", { "Fillings Choice": "Falafel & Spinach" }),
    plated("snapshot:small-vegan-grazing-platter", "Small Vegan Grazing Platter", "Grazing Boxes", 16, unitsFor(40, 8, 1.3)),
    plated("snapshot:spiced-vegan-pinwheels", "Spiced Vegan Pinwheels", "Savoury Treats", 12, unitsFor(40, 12, 1.3)),
    line(LEMON, unitsFor(40, 12, 1.3), "Full Traybake"),
    plated("snapshot:sweet-treats-selection-box", "Sweet Treats Selection Box", "Cakes", 12, unitsFor(40, 8, 1.3)),
  ]),
  historical("HIST-BIO-JUN", "Biocomposits", "2026-06-04", "2026-06-11", 22, [
    line(LARGE_SANDWICH, unitsFor(22, 8), "Large (6-8 People)", { "Fillings Choice": "Egg Mayonnaise" }),
    plated("snapshot:large-salad-selection-box", "Large Salad Selection Box", "Savoury Treats", 14, unitsFor(22, 8)),
    line(SAUSAGE, unitsFor(22, 12), "Box of 12"),
    plated("snapshot:mixed-box-of-pastries", "Mixed Box of Pastries", "Savoury Treats", 14, unitsFor(22, 8)),
  ]),
  historical("HIST-LEO-JUN", "Leoni", "2026-06-11", "2026-06-18", 40, [
    plated("snapshot:brioche-baguette-sandwich-platter", "Brioche Baguette Sandwich Platter", "Sandwich Platters", 18, unitsFor(40, 8)),
    plated("snapshot:crudites-grazing-platter", "Crudites Grazing Platter", "Grazing Boxes", 16, unitsFor(40, 8)),
    plated("snapshot:pork-pie-selection", "Pork Pie Selection", "Savoury Treats", 14, unitsFor(40, 6)),
    line(BISCOFF, unitsFor(40, 12), "Full Traybake"),
    plated("snapshot:open-scones-with-cream-and-jam", "Open Scones with Cream and Jam", "Scones", 12, unitsFor(40, 8)),
  ]),
  historical("HIST-COD-JUN", "Codeweavers", "2026-06-18", "2026-06-25", 30, [
    line(LARGE_SANDWICH, unitsFor(30, 8, 1.3), "Large (6-8 People)", { "Fillings Choice": "Cheese & Chutney" }),
    plated("snapshot:brunch-bagel-sandwich-box", "Brunch Bagel Sandwich Box", "Sandwich Platters", 16, unitsFor(30, 8, 1.3)),
    line(SAUSAGE, unitsFor(30, 12, 1.3), "Box of 12"),
    plated("snapshot:cheese-and-onion-rolls", "Cheese and Onion Rolls", "Savoury Treats", 12, unitsFor(30, 12, 1.3)),
    line(LEMON, unitsFor(30, 12, 1.3), "Full Traybake"),
    plated("snapshot:christmas-cupcakes", "Christmas Cupcakes", "Cakes", 15, unitsFor(30, 12, 1.3)),
  ]),
  historical("HIST-BIO-JUL", "Biocomposits", "2026-07-02", "2026-07-09", 40, [
    plated("snapshot:extra-large-vegetarian-sandwich-platter", "Extra Large Vegetarian Sandwich Platter", "Sandwich Platters", 27, unitsFor(40, 10)),
    plated("snapshot:simple-savoury-grazing-platter", "Simple Savoury Grazing Platter", "Grazing Boxes", 22, unitsFor(40, 8)),
    plated("snapshot:garlic-and-herb-chicken-drumsticks", "Garlic and Herb Chicken Drumsticks", "Savoury Treats", 16, unitsFor(40, 10)),
    plated("snapshot:homemade-pigs-in-blankets", "Homemade Pigs in Blankets", "Savoury Treats", 14, unitsFor(40, 12)),
    line(BISCOFF, unitsFor(40, 12), "Full Traybake"),
    plated("snapshot:mixed-traybake-platter", "Mixed Traybake Platter", "Cakes", 16, unitsFor(40, 12)),
  ]),
  historical("HIST-LEO-JUL", "Leoni", "2026-07-09", "2026-07-16", 18, [
    line(LARGE_SANDWICH, unitsFor(18, 8), "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
    plated("snapshot:small-cheese-box", "Small Cheese Box", "Grazing Boxes", 12, unitsFor(18, 6)),
    line(SAUSAGE, unitsFor(18, 12), "Box of 12"),
    line(SCONE, unitsFor(18, 12), "Large (12 Scones)", { Flavours: "Cheese", Preserve: "Clotted Cream Only" }),
  ]),
  historical("HIST-COD-JUL", "Codeweavers", "2026-07-16", "2026-07-23", 40, [
    line(VEGAN, unitsFor(40, 10, 1.3), "Extra Large", { "Fillings Choice": "Hummus & Roasted Pepper" }),
    plated("snapshot:deli-meats-grazing-platter", "Deli Meats Grazing Platter", "Grazing Boxes", 30, unitsFor(40, 8, 1.3)),
    plated("snapshot:homemade-quiche", "Homemade Quiche", "Savoury Treats", 18, unitsFor(40, 8, 1.3)),
    line(GRAZING, unitsFor(40, 8, 1.3), "Deluxe Box"),
    line(LEMON, unitsFor(40, 12, 1.3), "Full Traybake"),
    plated("snapshot:party-crisp-selection", "Party Crisp Selection", "Savoury Treats", 10, unitsFor(40, 16, 1.3)),
  ]),
  historical("HIST-BIO-AUG", "Biocomposits", "2026-07-30", "2026-08-06", 20, [
    line(LARGE_SANDWICH, unitsFor(20, 8), "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
    plated("snapshot:simple-salad-box", "Simple Salad Box", "Savoury Treats", 8, unitsFor(20, 6)),
    line(SAUSAGE, unitsFor(20, 12), "Box of 12"),
    plated("snapshot:sweet-chilli-topped-crisps", "Sweet Chilli Topped Crisps", "Savoury Treats", 6, unitsFor(20, 8)),
    line(LEMON, unitsFor(20, 12), "Full Traybake"),
  ]),
  historical("HIST-LEO-AUG", "Leoni", "2026-08-06", "2026-08-13", 40, [
    line(XL_SANDWICH, unitsFor(40, 10), "Extra Large (10 People)", { "Fillings Choice": "Mixed Classic" }),
    plated("snapshot:large-vegetarian-sandwich-platter", "Large Vegetarian Sandwich Platter", "Sandwich Platters", 18, unitsFor(40, 8)),
    line(GRAZING, unitsFor(40, 8), "Standard Box"),
    plated("snapshot:scotch-egg-selection", "Scotch Egg Selection", "Savoury Treats", 12, unitsFor(40, 6)),
    line(BISCOFF, unitsFor(40, 12), "Full Traybake"),
    plated("snapshot:one-flavour-scone-platter", "One Flavour Scone Platter", "Scones", 8.5, unitsFor(40, 12)),
  ]),
  historical("HIST-COD-AUG", "Codeweavers", "2026-08-13", "2026-08-20", 24, [
    line(SCONE, unitsFor(24, 12, 1.3), "Large (12 Scones)", { Flavours: "Mixed", Preserve: "Raspberry Jam" }),
    line(GLUTEN_FREE, unitsFor(24, 8, 1.3), "Standard Platter", { "Fillings Choice": "Cheddar & Tomato" }),
    plated("snapshot:cheesy-garlic-pinwheels", "Cheesy Garlic Pinwheels", "Savoury Treats", 12, unitsFor(24, 12, 1.3)),
    line(SAUSAGE, unitsFor(24, 12, 1.3), "Box of 12"),
    plated("snapshot:christmas-traybake-cake", "Christmas Traybake Cake", "Cakes", 15, unitsFor(24, 12, 1.3)),
    plated("snapshot:christmas-sausage-rolls", "Christmas Sausage Rolls", "Savoury Treats", 16, unitsFor(24, 12, 1.3)),
  ]),
  historical("HIST-BIO-SEP", "Biocomposits", "2026-09-03", "2026-09-10", 40, [
    line(XL_SANDWICH, unitsFor(40, 10), "Extra Large (10 People)", { "Fillings Choice": "Vegetarian Mix" }),
    plated("snapshot:bread-bun-sandwich-platter", "Bread Bun Sandwich Platter", "Sandwich Platters", 16, unitsFor(40, 8)),
    line(SAUSAGE, unitsFor(40, 12), "Box of 12"),
    plated("snapshot:cheese-and-tomato-pastry-pinwheels", "Cheese and Tomato Pastry Pinwheels", "Savoury Treats", 12, unitsFor(40, 12)),
    line(GRAZING, unitsFor(40, 8), "Deluxe Box"),
    plated("snapshot:classic-rocky-road", "Classic Rocky Road", "Cakes", 12, unitsFor(40, 12)),
  ]),
  historical("HIST-LEO-SEP", "Leoni", "2026-09-10", "2026-09-17", 22, [
    line(LARGE_SANDWICH, unitsFor(22, 8), "Large (6-8 People)", { "Fillings Choice": "Cucumber & Cream Cheese" }),
    plated("snapshot:small-cheese-box", "Small Cheese Box", "Grazing Boxes", 12, unitsFor(22, 6)),
    line(LEMON, unitsFor(22, 12), "Full Traybake"),
    line(SCONE, unitsFor(22, 12), "Large (12 Scones)", { Flavours: "Plain", Preserve: "Strawberry Jam" }),
    plated("snapshot:classic-crisp-box", "Classic Crisp Box", "Savoury Treats", 8, unitsFor(22, 8)),
  ]),
  historical("HIST-COD-SEP", "Codeweavers", "2026-09-17", "2026-09-24", 30, [
    line(VEGAN, unitsFor(30, 8, 1.3), "Large", { "Fillings Choice": "Vegan Cheese & Pickle" }),
    plated("snapshot:brioche-baguette-sandwich-platter", "Brioche Baguette Sandwich Platter", "Sandwich Platters", 18, unitsFor(30, 8, 1.3)),
    line(BISCOFF, unitsFor(30, 12, 1.3), "Full Traybake"),
    line(GRAZING, unitsFor(30, 8, 1.3), "Standard Box"),
    plated("snapshot:homemade-quiche", "Homemade Quiche", "Savoury Treats", 18, unitsFor(30, 8, 1.3)),
    plated("snapshot:sweet-treats-selection-box", "Sweet Treats Selection Box", "Cakes", 12, unitsFor(30, 8, 1.3)),
  ]),
  historical("HIST-BIO-OCT", "Biocomposits", "2026-10-01", "2026-10-08", 24, [
    line(LARGE_SANDWICH, unitsFor(24, 8), "Large (6-8 People)", { "Fillings Choice": "Ham & Mustard" }),
    plated("snapshot:brunch-bagel-sandwich-box", "Brunch Bagel Sandwich Box", "Sandwich Platters", 16, unitsFor(24, 8)),
    line(SAUSAGE, unitsFor(24, 12), "Box of 12"),
    plated("snapshot:pork-pie-selection", "Pork Pie Selection", "Savoury Treats", 14, unitsFor(24, 6)),
    line(BISCOFF, unitsFor(24, 12), "Full Traybake"),
  ]),
  historical("HIST-LEO-OCT", "Leoni", "2026-10-08", "2026-10-15", 18, [
    line(XL_SANDWICH, unitsFor(18, 10), "Extra Large (10 People)", { "Fillings Choice": "No Fish / Meat Heavy" }),
    plated("snapshot:crudites-grazing-platter", "Crudites Grazing Platter", "Grazing Boxes", 16, unitsFor(18, 8)),
    line(GRAZING, unitsFor(18, 8), "Standard Box"),
    line(LEMON, unitsFor(18, 12), "Full Traybake"),
    plated("snapshot:selection-of-cupcakes", "Selection of Cupcakes", "Cakes", 12, unitsFor(18, 12)),
  ]),
  historical("HIST-COD-OCT", "Codeweavers", "2026-10-15", "2026-10-22", 40, [
    line(XL_SANDWICH, unitsFor(40, 10, 1.3), "Extra Large (10 People)", { "Fillings Choice": "Vegetarian Mix" }),
    plated("snapshot:bread-bun-sandwich-platter", "Bread Bun Sandwich Platter", "Sandwich Platters", 16, unitsFor(40, 8, 1.3)),
    line(SAUSAGE, unitsFor(40, 12, 1.3), "Box of 12"),
    plated("snapshot:cheese-and-tomato-pastry-pinwheels", "Cheese and Tomato Pastry Pinwheels", "Savoury Treats", 12, unitsFor(40, 12, 1.3)),
    line(SCONE, unitsFor(40, 12, 1.3), "Large (12 Scones)", { Flavours: "Fruit", Preserve: "Strawberry Jam" }),
    line(GRAZING, unitsFor(40, 8, 1.3), "Deluxe Box"),
    plated("snapshot:orange-crunch-tiffin", "Orange Crunch Tiffin", "Cakes", 12, unitsFor(40, 12, 1.3)),
    plated("snapshot:small-cheese-box", "Small Cheese Box", "Grazing Boxes", 12, unitsFor(40, 6, 1.3)),
  ]),
];

export const HISTORICAL_CORPORATE_ORDERS: HistoricalCorporateOrder[] = [
  ...APRIL_TO_OCTOBER_ORDERS,
  ...MAY_ORDERS,
];

export function findCorporateAccount(
  accounts: CorporateAccount[],
  companyName: string,
  username: string,
  password: string,
): CorporateAccount | null {
  const account = accounts.find((entry) => entry.companyName === companyName);
  if (!account) return null;
  if (account.username !== username.trim() || account.password !== password) return null;
  return account;
}

export const RECENT_PAST_ORDER_COUNT = 4;

export function pastOrdersFor(companyName: string, orders: HistoricalCorporateOrder[]): HistoricalCorporateOrder[] {
  return orders
    .filter((order) => order.companyName === companyName && order.status === "HISTORICAL_DELIVERED")
    .sort(
      (a, b) =>
        b.bookedDate.localeCompare(a.bookedDate) ||
        b.deliveryDate.localeCompare(a.deliveryDate),
    );
}

/** The newest delivered orders for the corporate page. Older months stay in the yearly accounts. */
export function recentPastOrders(companyName: string, orders: HistoricalCorporateOrder[]): HistoricalCorporateOrder[] {
  return pastOrdersFor(companyName, orders).slice(0, RECENT_PAST_ORDER_COUNT);
}

export function historicalOrderTotal(order: HistoricalCorporateOrder): number {
  return order.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function lineSignature(lineItem: HistoricalOrderLine): string {
  const modifiers = Object.entries(lineItem.modifiers ?? {})
    .sort(([a], [b]) => a.localeCompare(b, "en-GB"))
    .map(([name, value]) => `${name}=${value}`)
    .join("|");
  return `${lineItem.catalogItemId}|${lineItem.variant ?? ""}|${modifiers}`;
}

function clampHeadcount(value: number): number {
  if (!Number.isFinite(value)) return 20;
  return Math.min(500, Math.max(1, Math.round(value)));
}

function perPersonLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, "");
}

/**
 * Builds a menu from one company's delivered orders.
 * Repeating items are scaled by their historical quantity per person.
 * Does not call Wix.
 */
export function suggestMenu(
  orders: HistoricalCorporateOrder[],
  requestedHeadcount: number,
  catalog: MenuItem[],
): SuggestedMenu {
  const headcount = clampHeadcount(requestedHeadcount);
  const history = orders.filter((order) => order.status === "HISTORICAL_DELIVERED");
  if (history.length === 0) {
    return {
      headcount,
      summary: "This company has no delivered orders to learn from yet.",
      categoryShares: [],
      lines: [],
    };
  }

  const categorySpend = new Map<string, number>();
  let totalSpend = 0;
  const grouped = new Map<
    string,
    {
      sample: HistoricalOrderLine;
      orders: Set<string>;
      perPerson: number[];
      spend: number;
    }
  >();

  for (const order of history) {
    const people = order.headcount > 0 ? order.headcount : 1;
    for (const item of order.lineItems) {
      const spend = item.quantity * item.unitPrice;
      totalSpend += spend;
      categorySpend.set(item.category, (categorySpend.get(item.category) ?? 0) + spend);
      const key = lineSignature(item);
      const current = grouped.get(key) ?? { sample: item, orders: new Set<string>(), perPerson: [], spend: 0 };
      current.orders.add(order.id);
      current.perPerson.push(item.quantity / people);
      current.spend += spend;
      grouped.set(key, current);
    }
  }

  const categoryShares: CategoryShare[] = [...categorySpend.entries()]
    .map(([category, spend]) => ({
      category,
      percent: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent || a.category.localeCompare(b.category, "en-GB"));

  const shareByCategory = new Map(categoryShares.map((share) => [share.category, share.percent]));
  const repeating = [...grouped.values()]
    .filter((entry) => entry.orders.size >= 2)
    .sort((a, b) => b.orders.size - a.orders.size || b.spend - a.spend)
    .slice(0, 6);

  const lines: SuggestedLine[] = repeating.map((entry) => {
    const average = entry.perPerson.reduce((sum, value) => sum + value, 0) / entry.perPerson.length;
    const quantity = Math.min(99, Math.max(1, Math.round(average * headcount)));
    const catalogMatch = catalog.find((item) => item.id === entry.sample.catalogItemId);
    const percent = shareByCategory.get(entry.sample.category) ?? 0;
    return {
      catalogItemId: entry.sample.catalogItemId,
      name: catalogMatch?.name ?? entry.sample.name,
      category: catalogMatch?.category ?? entry.sample.category,
      imageUrl: catalogMatch?.imageUrl ?? entry.sample.imageUrl,
      variant: entry.sample.variant,
      quantity,
      unitPrice: entry.sample.unitPrice,
      modifiers: entry.sample.modifiers,
      reason: `${entry.sample.name} was on ${entry.orders.size} of ${history.length} past orders. ${entry.sample.category} was ${percent}% of past spend. Those orders averaged ${perPersonLabel(average)} per person, which scales to ${quantity} for ${headcount} people.`,
    };
  });

  const mix = categoryShares.map((share) => `${share.category} ${share.percent}%`).join(", ");
  return {
    headcount,
    summary: `From ${history.length} delivered orders, past spend sat in ${mix}. Items ordered more than once are kept, then scaled to ${headcount} people.`,
    categoryShares,
    lines,
  };
}

export const DEFAULT_MENU_TEMPLATES: MenuTemplate[] = [
  {
    id: "basic",
    label: "Basic",
    blurb: "A sandwich, a sausage roll, a pinwheel, and one traybake slice for each person.",
    picks: [
      { name: "Large Classic Sandwich Platter", covers: 8, portion: "about one sandwich each" },
      { name: "Pork Sausage Rolls", covers: 12, portion: "one roll each" },
      { name: "Cheese and Tomato Pastry Pinwheels", covers: 12, portion: "one pinwheel each" },
      { name: "Lemon Traybake Cake", covers: 12, portion: "one traybake slice each" },
    ],
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "A sandwich for each person, plus grazing platters with fruit, cheese, and crackers, a salad box, and a traybake slice.",
    picks: [
      { name: "Large Classic Sandwich Platter", covers: 8, portion: "about one sandwich each" },
      { name: "Classic Grazing Platter", covers: 8, portion: "a grazing share, including fruit, for each person" },
      { name: "Large Salad Selection Box", covers: 8, portion: "a salad share for each person" },
      { name: "Lemon Traybake Cake", covers: 12, portion: "one traybake slice each" },
    ],
  },
  {
    id: "deluxe",
    label: "Deluxe",
    blurb: "Brioche sandwiches, a bun platter, quiche, a cheese board, a deli board, cupcakes, and tiffin.",
    picks: [
      { name: "Brioche Baguette Sandwich Platter", covers: 8, portion: "a brioche sandwich each" },
      { name: "Bread Bun Sandwich Platter", covers: 8, portion: "a bun-platter sandwich each" },
      { name: "Homemade Quiche", covers: 8, portion: "a slice of quiche each" },
      { name: "Small Cheese Box", covers: 6, portion: "a cheese-board share each" },
      { name: "Deli Meats Grazing Platter", covers: 8, portion: "a deli-board share each" },
      { name: "Selection of Cupcakes", covers: 12, portion: "one cupcake each" },
      { name: "Orange Crunch Tiffin", covers: 12, portion: "one piece of tiffin each" },
    ],
  },
];

function moneyPounds(value: number): number {
  return Math.round(value * 100) / 100;
}

function gbpLabel(value: number): string {
  return `£${moneyPounds(value).toFixed(2)}`;
}

function findCatalogItem(catalog: MenuItem[], name: string): MenuItem | undefined {
  const key = name.trim().toLowerCase();
  return catalog.find((item) => item.name.trim().toLowerCase() === key);
}

function lowestVariant(item: MenuItem): PriceVariant {
  return item.priceVariants.reduce((best, variant) => (variant.price < best.price ? variant : best));
}

function defaultModifiers(item: MenuItem): Record<string, string> | undefined {
  if (!item.modifierGroups?.length) return undefined;
  const modifiers: Record<string, string> = {};
  for (const group of item.modifierGroups) {
    const option = group.options[0];
    if (option) modifiers[group.name] = option;
  }
  return Object.keys(modifiers).length > 0 ? modifiers : undefined;
}

function tierComparison(perPerson: number, usual: number): string {
  if (usual <= 0) return "There are no delivered orders to compare yet.";
  const delta = moneyPounds(perPerson - usual);
  if (Math.abs(delta) < 0.05) return `In line with the ${gbpLabel(usual)} usually spent per person.`;
  if (delta > 0) return `${gbpLabel(delta)} above the ${gbpLabel(usual)} usually spent per person.`;
  return `${gbpLabel(Math.abs(delta))} below the ${gbpLabel(usual)} usually spent per person.`;
}

/**
 * Builds Basic, Standard, and Deluxe menus from the local catalog.
 * Prices are the platter prices divided by the headcount. Nothing is sent to Wix.
 */
export function buildMenuTiers(
  orders: HistoricalCorporateOrder[],
  requestedHeadcount: number,
  catalog: MenuItem[],
  templates?: MenuTemplate[] | null,
): TieredMenuPlan {
  const headcount = clampHeadcount(requestedHeadcount);
  const history = orders.filter((order) => order.status === "HISTORICAL_DELIVERED");
  let spend = 0;
  let people = 0;
  for (const order of history) {
    spend += historicalOrderTotal(order);
    people += order.headcount > 0 ? order.headcount : 1;
  }
  const pastPerPerson = people > 0 ? moneyPounds(spend / people) : 0;
  const pastLabel =
    pastPerPerson > 0
      ? `Based on your previous orders (~${gbpLabel(pastPerPerson)} per person)`
      : "Based on your previous orders (no delivered orders yet)";

  const tiers: MenuTierOption[] = (templates && templates.length > 0 ? templates : DEFAULT_MENU_TEMPLATES).map((tier) => {
    const lines: SuggestedLine[] = [];
    for (const pick of tier.picks) {
      const item = findCatalogItem(catalog, pick.name);
      if (!item) continue;
      const variant = lowestVariant(item);
      const quantity = Math.min(99, Math.max(1, Math.ceil(headcount / pick.covers)));
      lines.push({
        catalogItemId: item.id,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        variant: variant.option,
        quantity,
        unitPrice: variant.price,
        modifiers: defaultModifiers(item),
        reason: `${pick.portion}. One ${item.name} covers about ${pick.covers} people, so ${headcount} people need ${quantity}.`,
      });
    }
    const total = moneyPounds(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const perPerson = headcount > 0 ? moneyPounds(total / headcount) : 0;
    return {
      id: tier.id,
      label: tier.label,
      blurb: tier.blurb,
      lines,
      total,
      perPerson,
      comparison: tierComparison(perPerson, pastPerPerson),
    };
  });

  return {
    headcount,
    pastPerPerson,
    pastOrderCount: history.length,
    pastLabel,
    tiers,
  };
}
