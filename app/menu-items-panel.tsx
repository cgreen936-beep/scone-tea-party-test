"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import CupsDirectBoxes from "./cups-direct-boxes";
import { supplyStockKey } from "./stock-amend";
import {
  bakePartnerGroupToken,
  bakePartnerItemToken,
  bakesCanShare,
  batchGroupNote,
  categoryPartnerChoice,
  CUPS_DIRECT_BOX_SIZES,
  DEFAULT_LABOUR_HOURLY_RATE,
  defaultCupsBoxSize,
  defaultPrepMinutes,
  fullDrawElectricityPounds,
  inferBakeProfile,
  notRegisteredItemProfit,
  ovenProfileCost,
  OVEN_BATCH_GROUPS,
  TRAYS_BOTH_OVENS,
  TRAYS_PER_OVEN,
  resolveItemBake,
  setBakePartner,
  type BakeSettings,
  type CatalogueItem,
  type EditableRecipe,
  type EnteredUnit,
  type OvenBatchGroupId,
  type RecipeLine,
} from "@/lib/costing";
import type { UnifiedOrder } from "@/lib/mock-data";
import { setSarahConfirmed, useSarahConfirmations } from "@/lib/sarah-confirmations";
import { addIsoDays } from "@/lib/uk-date";
import { DEFAULT_MENU_TEMPLATES, type MenuTemplate } from "@/lib/corporate-portal";
import { resetMenuTemplates, saveMenuTemplates, useMenuTemplates } from "@/lib/menu-templates";
import type { WixMenuCatalog, WixMenuCatalogItem } from "@/lib/wix-menu-sync";

const UNITS: EnteredUnit[] = ["g", "kg", "ml", "units"];

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef]";

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function blankRecipe(item: WixMenuCatalogItem): EditableRecipe {
  const bake = inferBakeProfile(item.name);
  return {
    itemId: item.id,
    itemName: item.name,
    sandwichesPerUnit: 0,
    boxType: `cups-${defaultCupsBoxSize(item.name)}`,
    notes: "",
    constantCost: 0,
    prepMinutes: defaultPrepMinutes(item.name),
    labourHourlyRate: DEFAULT_LABOUR_HOURLY_RATE,
    bakeGroup: bake.group,
    preBakeMinutes: bake.preBakeMinutes,
    bakeMinutes: bake.minutes,
    bakeTemperatureC: bake.temperatureC,
    lines: [],
  };
}

function storedQuantity(quantity: number, unit: EnteredUnit, catalogueUnit: CatalogueItem["unit"]): number {
  if (unit === "kg" && catalogueUnit === "g") return quantity * 1000;
  return quantity;
}

function lineCost(catalogue: CatalogueItem[], line: RecipeLine): number {
  const item = catalogue.find((entry) => entry.id === line.catalogueId);
  if (!item || item.packSize <= 0) return 0;
  return (line.quantity / item.packSize) * item.cost;
}

function boxesForSize(size: string): string {
  return `cups-${size}`;
}

function ConfirmationBadge({ confirmed, onDark }: { confirmed: boolean; onDark?: boolean }) {
  let tone = "text-[#8a4b12]";
  if (onDark) tone = "text-white/80";
  else if (confirmed) tone = "text-[#1f6b45]";
  return <span className={`text-xs font-semibold ${tone}`}>{confirmed ? "Confirmed by Sarah" : "Needs review"}</span>;
}

export default function MenuItemsPanel({
  catalog,
  catalogue,
  recipes,
  orders,
  stock,
  todayIso,
  onChangeRecipes,
  onChangeCatalogue,
  onChangeStock,
  bakeSettings,
  onChangeBakeSettings,
}: {
  catalog: WixMenuCatalog;
  catalogue: CatalogueItem[];
  recipes: EditableRecipe[];
  orders: UnifiedOrder[];
  stock: Record<string, number>;
  todayIso: string;
  onChangeRecipes: Dispatch<SetStateAction<EditableRecipe[]>>;
  onChangeCatalog: (next: WixMenuCatalog) => void;
  onChangeCatalogue: Dispatch<SetStateAction<CatalogueItem[]>>;
  onChangeStock: Dispatch<SetStateAction<Record<string, number>>>;
  bakeSettings: BakeSettings;
  onChangeBakeSettings: Dispatch<SetStateAction<BakeSettings>>;
}) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"live" | "hidden">("live");
  const [menu, setMenu] = useState("All");
  const [section, setSection] = useState("All");
  const [confirmation, setConfirmation] = useState<"all" | "confirmed" | "unconfirmed">("all");
  const confirmations = useSarahConfirmations();
  const [selectedId, setSelectedId] = useState(catalog.items.find((item) => item.visible)?.id ?? catalog.items[0]?.id ?? "");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [ingredientQty, setIngredientQty] = useState("1");
  const [ingredientUnit, setIngredientUnit] = useState<EnteredUnit>("g");
  const savedTemplates = useMenuTemplates();
  const templates = savedTemplates ?? DEFAULT_MENU_TEMPLATES;
  const [partnerQuery, setPartnerQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.items.filter((item) => {
      if (visibility === "live" && !item.visible) return false;
      if (visibility === "hidden" && item.visible) return false;
      if (menu !== "All" && !item.menus.includes(menu)) return false;
      if (section !== "All" && !item.sections.includes(section)) return false;
      const confirmed = confirmations[item.id] === true;
      if (confirmation === "confirmed" && !confirmed) return false;
      if (confirmation === "unconfirmed" && confirmed) return false;
      if (!needle) return true;
      return `${item.name} ${item.sections.join(" ")} ${item.menus.join(" ")}`.toLowerCase().includes(needle);
    });
  }, [catalog.items, confirmation, confirmations, menu, query, section, visibility]);

  const sections = useMemo(() => {
    const names = new Set<string>();
    for (const item of catalog.items) {
      if (menu !== "All" && !item.menus.includes(menu)) continue;
      for (const name of item.sections) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "en-GB"));
  }, [catalog.items, menu]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const saved = selected
    ? recipes.find((recipe) => recipe.itemId === selected.id) ??
      recipes.find((recipe) => recipe.itemName.trim().toLowerCase() === selected.name.trim().toLowerCase())
    : undefined;
  const recipe = selected ? saved ?? blankRecipe(selected) : null;
  const recipeRef = useRef(recipe);
  useEffect(() => {
    recipeRef.current = recipe;
  }, [recipe]);

  const ingredientCost = recipe
    ? Math.round(recipe.lines.reduce((sum, line) => sum + lineCost(catalogue, line), 0) * 100) / 100
    : 0;
  const currentBake = recipe ? resolveItemBake(recipe.itemName, recipe.itemId, [recipe], bakeSettings) : null;
  const profit =
    recipe && selected
      ? notRegisteredItemProfit({
          catalogPrice: selected.price,
          salePriceOverride: recipe.salePriceOverride,
          ingredientCost,
          boxCost: recipe.boxType.startsWith("cups-")
            ? (catalogue.find((item) => item.id === `box:${recipe.boxType}`)?.cost ?? 0)
            : 0,
          potCount: recipe.potCount,
          potUnitCost: recipe.potUnitCost,
          electricityCost: currentBake?.soloCost ?? 0,
          prepMinutes: recipe.prepMinutes,
          labourHourlyRate: recipe.labourHourlyRate,
          coversUnits: recipe.coversUnits,
        })
      : null;
  const matches = useMemo(() => {
    const needle = ingredientQuery.trim().toLowerCase();
    if (!needle) return catalogue.slice(0, 8);
    return catalogue
      .filter((item) => `${item.name} ${item.supplier} ${item.packLabel}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [catalogue, ingredientQuery]);

  const boxSize = recipe?.boxType.startsWith("cups-") ? recipe.boxType.slice(5) : "";
  const boxItem = boxSize ? catalogue.find((item) => item.id === `box:${boxesForSize(boxSize)}`) : undefined;
  const boxKey = boxItem ? supplyStockKey(boxItem) : "";
  const boxStock = boxKey ? Math.max(0, stock[boxKey] ?? 0) : 0;
  const fortnightEnd = todayIso ? addIsoDays(todayIso, 13) : "";
  const boxesNeeded = useMemo(() => {
    if (!selected || !todayIso) return 0;
    let total = 0;
    for (const order of orders) {
      if (order.orderStatus === "CANCELED") continue;
      if (order.deliveryDate < todayIso || order.deliveryDate > fortnightEnd) continue;
      for (const line of order.lineItems) {
        if (line.name.trim().toLowerCase() === selected.name.trim().toLowerCase()) total += line.quantity;
      }
    }
    return total;
  }, [fortnightEnd, orders, selected, todayIso]);
  const shortfall = Math.max(0, boxesNeeded - boxStock);
  const partnerNames = recipe
    ? [...new Set([...catalog.items.map((item) => item.name), ...recipes.map((entry) => entry.itemName)])]
        .filter((name) => {
          if (name.trim().toLowerCase() === recipe.itemName.trim().toLowerCase()) return false;
          return resolveItemBake(name, undefined, recipes, bakeSettings).baked;
        })
        .sort((a, b) => a.localeCompare(b, "en-GB"))
    : [];
  const partnerNeedle = partnerQuery.trim().toLowerCase();
  const visiblePartners = partnerNeedle
    ? partnerNames.filter((name) => name.toLowerCase().includes(partnerNeedle))
    : partnerNames;

  function commit(next: EditableRecipe) {
    recipeRef.current = next;
    onChangeRecipes((current) => {
      const index = current.findIndex(
        (entry) => entry.itemId === next.itemId || entry.itemName.trim().toLowerCase() === next.itemName.trim().toLowerCase(),
      );
      if (index === -1) return [...current, next];
      return current.map((entry, entryIndex) => (entryIndex === index ? next : entry));
    });
  }

  function update(patch: Partial<EditableRecipe>) {
    const current = recipeRef.current;
    if (!current) return;
    commit({ ...current, ...patch });
  }

  function addIngredient(item: CatalogueItem) {
    if (!recipe) return;
    const entered = Number(ingredientQty);
    if (!Number.isFinite(entered) || entered <= 0) return;
    const quantity = storedQuantity(entered, ingredientUnit, item.unit);
    const existing = recipe.lines.find((line) => line.catalogueId === item.id);
    const lines = existing
      ? recipe.lines.map((line) =>
          line.catalogueId === item.id
            ? { ...line, quantity: line.quantity + quantity, enteredQuantity: entered, enteredUnit: ingredientUnit }
            : line,
        )
      : [...recipe.lines, { catalogueId: item.id, quantity, enteredQuantity: entered, enteredUnit: ingredientUnit }];
    update({ lines });
  }

  function changeTemplatePick(tierId: MenuTemplate["id"], index: number, name: string) {
    saveMenuTemplates(
      templates.map((tier) =>
        tier.id === tierId
          ? { ...tier, picks: tier.picks.map((pick, pickIndex) => (pickIndex === index ? { ...pick, name } : pick)) }
          : tier,
      ),
    );
  }

  return (
    <section className="mt-6 space-y-6" role="tabpanel" aria-label="Website menu items">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Website menu items</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
            {`Items sold on sconeteaparty.co.uk, kept in the saved menu catalog. This deployment does not contact Wix. Live means visible on the site. Hidden keeps archived lines such as Classic Afternoon Tea off the live list.`}
          </p>
        </div>
      </div>
      <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Mock menu templates">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Mock menu templates</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
              Basic, Standard, and Deluxe picks for the company portal. Changes stay in this browser and remain after a refresh.
            </p>
          </div>
          <button type="button" className={secondaryClass} onClick={resetMenuTemplates}>
            Reset templates
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {templates.map((tier) => (
            <div key={tier.id}>
              <h4 className="font-semibold">{tier.label}</h4>
              <div className="mt-2 space-y-2">
                {tier.picks.map((pick, index) => (
                  <label key={`${tier.id}-${index}`} className="block text-sm">
                    <span className="mb-1 block text-[#5c5146]">{`Pick ${index + 1}`}</span>
                    <select
                      className={controlClass}
                      value={pick.name}
                      aria-label={`${tier.label} pick ${index + 1}`}
                      onChange={(event) => changeTemplatePick(tier.id, index, event.target.value)}
                    >
                      {catalog.items.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <CupsDirectBoxes catalogue={catalogue} stock={stock} onChangeCatalogue={onChangeCatalogue} onChangeStock={onChangeStock} />
      <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Baking and electricity">
        <h2 className="text-xl font-semibold">Baking and electricity</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
          One oven costs kW × duty cycle × hours × £/kWh. The default oven is 5.6 kW three-phase and the default rate is £0.30/kWh. That kW is already the total three-phase power, so neither kWh nor £/kWh is multiplied by 3. Duty cycle 1.00 bills the full rated draw. A lower duty cycle is the average draw while the oven cycles, and the full-draw cost stays visible beside it.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c5146]">
          {`One oven holds ${TRAYS_PER_OVEN} trays and a normal run uses that one oven. Both ovens together hold ${TRAYS_BOTH_OVENS} trays. A busy bake can split them, for example 4 trays of sausage rolls or pinwheels and 2 trays of scones or cakes. One box of sausage rolls or pinwheels is 1 tray. Cakes and brownies stay in their own oven. Quiche uses a 30-minute pre-bake and then a 40-minute bake.`}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Electricity rate (£ / kWh)</span>
            <input
              className={controlClass}
              type="number"
              min="0"
              step="0.01"
              value={bakeSettings.electricityRatePerKwh}
              aria-label="Electricity rate"
              onChange={(event) =>
                onChangeBakeSettings((current) => ({
                  ...current,
                  electricityRatePerKwh: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Oven power (kW)</span>
            <input
              className={controlClass}
              type="number"
              min="0"
              step="0.1"
              value={bakeSettings.ovenKw}
              aria-label="Oven power"
              onChange={(event) =>
                onChangeBakeSettings((current) => ({
                  ...current,
                  ovenKw: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Duty cycle (average draw)</span>
            <input
              className={controlClass}
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={bakeSettings.dutyCycle ?? 1}
              aria-label="Duty cycle"
              onChange={(event) => {
                const raw = event.target.value;
                const next = raw === "" ? 1 : Math.min(1, Math.max(0, Number(raw) || 0));
                onChangeBakeSettings((current) => ({ ...current, dutyCycle: next }));
              }}
            />
          </label>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Search menu items</span>
          <input className={controlClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" aria-label="Search menu items" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Visibility</span>
          <select className={controlClass} value={visibility} onChange={(event) => setVisibility(event.target.value as "live" | "hidden")} aria-label="Visibility">
            <option value="live">Live on the website</option>
            <option value="hidden">Hidden or archived</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Menu</span>
          <select
            className={controlClass}
            value={menu}
            onChange={(event) => {
              setMenu(event.target.value);
              setSection("All");
            }}
            aria-label="Menu"
          >
            <option value="All">All menus</option>
            {catalog.menus.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Section</span>
          <select className={controlClass} value={section} onChange={(event) => setSection(event.target.value)} aria-label="Section">
            <option value="All">All sections</option>
            {sections.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sarah confirmation</span>
          <select
            className={controlClass}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value as "all" | "confirmed" | "unconfirmed")}
            aria-label="Sarah confirmation"
          >
            <option value="all">All</option>
            <option value="confirmed">Confirmed by Sarah</option>
            <option value="unconfirmed">Unconfirmed</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="max-h-[40rem] space-y-2 overflow-auto rounded-lg border border-[#e4d5c3] bg-white p-2">
          {filtered.map((item) => {
            const confirmed = confirmations[item.id] === true;
            const picked = item.id === selected?.id;
            return (
              <div key={item.id} className={`rounded-md ${picked ? "bg-[#7d3044] text-white" : "hover:bg-[#fffaf3]"}`}>
                <label className={`flex items-start gap-2 px-3 pt-2 text-xs leading-5 ${picked ? "text-white" : "text-[#5c5146]"}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmed}
                    aria-label={`Sarah confirmed ingredients & quantities for ${item.name}`}
                    onChange={(event) => setSarahConfirmed(item.id, event.target.checked)}
                  />
                  <span>Sarah confirmed ingredients & quantities</span>
                </label>
                <button type="button" className="block w-full px-3 pb-2 text-left text-sm" onClick={() => setSelectedId(item.id)}>
                  <span className="font-semibold">{item.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <ConfirmationBadge confirmed={confirmed} onDark={picked} />
                  </span>
                  <span className={`mt-1 block text-xs ${picked ? "text-white/80" : "text-[#5c5146]"}`}>
                    {item.menus.join(", ")} · {gbp(item.price)}
                  </span>
                </button>
              </div>
            );
          })}
          {filtered.length === 0 ? <p className="px-2 py-3 text-sm text-[#5c5146]">No menu items match those filters.</p> : null}
        </div>
        {selected && recipe ? (
          <div className="space-y-4 rounded-lg border border-[#e4d5c3] bg-white p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Item</p>
              <h3 className="text-xl font-semibold">{selected.name}</h3>
              <p className="mt-1 text-sm text-[#5c5146]">
                {`${selected.sections.join(", ")} · ${selected.menus.join(", ")} · ${selected.visible ? "Live" : "Hidden"} · Catalog ${gbp(selected.price)} ${selected.currency}`}
              </p>
              <label className="mt-3 flex items-start gap-2 rounded-md border border-[#eadfce] bg-[#fffaf3] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmations[selected.id] === true}
                  aria-label="Sarah confirmed ingredients & quantities"
                  onChange={(event) => setSarahConfirmed(selected.id, event.target.checked)}
                />
                <span>
                  <span className="block font-medium">Sarah confirmed ingredients & quantities</span>
                  <ConfirmationBadge confirmed={confirmations[selected.id] === true} />
                </span>
              </label>
            </div>
            {profit ? (
              <div className="space-y-3 rounded-md border border-[#eadfce] bg-[#fffaf3] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Sale price (£ per item)</span>
                    <input
                      className={controlClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={recipe.salePriceOverride ?? selected.price}
                      aria-label="Sale price"
                      onChange={(event) => update({ salePriceOverride: Math.max(0, Number(event.target.value) || 0) })}
                    />
                  </label>
                  <div className="text-sm leading-6 text-[#5c5146]">
                    <p>{`Catalog price ${gbp(selected.price)}.`}</p>
                    {selected.price <= 0 ? (
                      <p>This catalog price is £0.00, so enter the price for the variant or option the customer buys.</p>
                    ) : (
                      <p>Changing this price overrides the catalog figure for this item in this session.</p>
                    )}
                    {profit.usingOverride ? (
                      <button type="button" className={`${secondaryClass} mt-2`} onClick={() => update({ salePriceOverride: undefined })}>
                        Use catalog price
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm leading-6 text-[#5c5146]">Current VAT is £0.00. Sarah is not VAT-registered, so nothing is taken off this sale price.</p>
              </div>
            ) : null}
            <label className="block max-w-xs text-sm">
              <span className="mb-1 block font-medium">Box size</span>
              <select
                className={controlClass}
                value={boxSize}
                onChange={(event) => update({ boxType: event.target.value ? boxesForSize(event.target.value) : "none" })}
                aria-label="Cups Direct box size"
              >
                <option value="">Choose 1–5</option>
                {CUPS_DIRECT_BOX_SIZES.map((size) => (
                  <option key={size} value={size}>Size {size}</option>
                ))}
              </select>
            </label>
            <div className={`rounded-md border px-3 py-3 text-sm leading-6 ${shortfall > 0 ? "border-[#e7c2c2] bg-[#fff6f6] text-[#8a2b2b]" : "border-[#eadfce] bg-[#fffaf3] text-[#2c241c]"}`} role={shortfall > 0 ? "alert" : "status"}>
              {!todayIso
                ? "The next 14 days are being set from the UK date."
                : !boxSize
                  ? "Choose a Cups Direct box size to compare the next 14 days of orders with box stock. Cups Direct takes about two weeks, so a shortfall cannot be filled in time."
                  : shortfall > 0
                    ? `Cups Direct 2-week deficit: ${selected.name} needs ${boxesNeeded} size ${boxSize} box${boxesNeeded === 1 ? "" : "es"} from ${todayIso} through ${fortnightEnd}, and ${boxStock} ${boxStock === 1 ? "is" : "are"} in stock. That is ${shortfall} short. Order them now — a new Cups Direct delivery will not arrive inside this fortnight.`
                    : `Box stock covers this item through ${fortnightEnd}. ${boxesNeeded} size ${boxSize} box${boxesNeeded === 1 ? "" : "es"} are booked and ${boxStock} ${boxStock === 1 ? "is" : "are"} in stock.`}
            </div>
            <div className="space-y-3 rounded-md border border-[#eadfce] bg-[#fffaf3] p-3">
              <h4 className="text-sm font-semibold">Bake</h4>
              <p className="text-sm leading-6 text-[#5c5146]">{currentBake ? batchGroupNote(currentBake.group) : ""}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {recipe.itemName.toLowerCase().includes("quiche") || (recipe.preBakeMinutes ?? inferBakeProfile(recipe.itemName).preBakeMinutes) > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Pre-bake (minutes)</span>
                    <input
                      className={controlClass}
                      type="number"
                      min="0"
                      step="1"
                      value={recipe.preBakeMinutes ?? inferBakeProfile(recipe.itemName).preBakeMinutes}
                      aria-label="Pre-bake minutes"
                      onChange={(event) => update({ preBakeMinutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                    />
                  </label>
                ) : null}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Bake time (minutes)</span>
                  <input
                    className={controlClass}
                    type="number"
                    min="0"
                    step="1"
                    value={recipe.bakeMinutes ?? 0}
                    aria-label="Bake time minutes"
                    onChange={(event) => update({ bakeMinutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Bake time (hours)</span>
                  <input
                    className={controlClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={Number((((recipe.bakeMinutes ?? 0) / 60).toFixed(2)))}
                    aria-label="Bake time hours"
                    onChange={(event) => update({ bakeMinutes: Math.max(0, Math.round((Number(event.target.value) || 0) * 60)) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Bake temperature (°C)</span>
                  <input
                    className={controlClass}
                    type="number"
                    min="0"
                    step="1"
                    value={recipe.bakeTemperatureC ?? 0}
                    aria-label="Bake temperature"
                    onChange={(event) => update({ bakeTemperatureC: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Oven batch</span>
                  <select
                    className={controlClass}
                    value={recipe.bakeGroup ?? "none"}
                    aria-label="Oven batch group"
                    onChange={(event) => {
                      const bakeGroup = event.target.value as OvenBatchGroupId;
                      const defaults = OVEN_BATCH_GROUPS.find((entry) => entry.id === bakeGroup);
                      const inferred = inferBakeProfile(recipe.itemName);
                      const quichePreBake = bakeGroup === "savoury-hot" && inferred.preBakeMinutes > 0 ? inferred.preBakeMinutes : 0;
                      update({
                        bakeGroup,
                        bakeMinutes: quichePreBake > 0 ? inferred.minutes : (defaults?.defaultMinutes ?? 0),
                        bakeTemperatureC: defaults?.defaultTemperatureC ?? 0,
                        preBakeMinutes: quichePreBake,
                        canBakeWith: undefined,
                        cannotBakeWith: undefined,
                      });
                    }}
                  >
                    {OVEN_BATCH_GROUPS.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">Direct electric cost per bake (£, optional)</span>
                  <input
                    className={controlClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={recipe.electricityCost ?? ""}
                    placeholder="Use kW × time × rate"
                    aria-label="Direct bake electricity"
                    onChange={(event) => {
                      const raw = event.target.value;
                      update({ electricityCost: raw === "" ? undefined : Math.max(0, Number(raw) || 0) });
                    }}
                  />
                </label>
              </div>
              {currentBake?.baked ? (
                <>
                  <p className="text-sm leading-6 text-[#5c5146]">
                    {currentBake.usesDirectCost
                      ? `This bake uses a direct cost of ${gbp(currentBake.soloCost)}, so the £/kWh rate and the duty cycle leave it unchanged.`
                      : currentBake.preBakeMinutes > 0
                        ? `${bakeSettings.ovenKw.toFixed(2)} kW × ${(bakeSettings.dutyCycle ?? 1).toFixed(2)} duty × ${currentBake.preBakeMinutes}-minute pre-bake + ${currentBake.minutes}-minute bake (${currentBake.preBakeMinutes + currentBake.minutes} minutes, ${((currentBake.preBakeMinutes + currentBake.minutes) / 60).toFixed(2)} hours) at ${currentBake.temperatureC}°C × ${gbp(bakeSettings.electricityRatePerKwh)}/kWh = ${gbp(currentBake.soloCost)} for one oven. Full draw at duty 1.00 is ${gbp(ovenProfileCost(currentBake.preBakeMinutes, currentBake.minutes, bakeSettings, 1))}. The pre-bake is included whenever this quiche is baked. Three-phase kW is not multiplied by 3.`
                        : `${bakeSettings.ovenKw.toFixed(2)} kW × ${(bakeSettings.dutyCycle ?? 1).toFixed(2)} duty × ${currentBake.minutes} minutes (${(currentBake.minutes / 60).toFixed(2)} hours) at ${currentBake.temperatureC}°C × ${gbp(bakeSettings.electricityRatePerKwh)}/kWh = ${gbp(currentBake.soloCost)} for one oven. Full draw at duty 1.00 is ${gbp(fullDrawElectricityPounds(currentBake.minutes, bakeSettings))}. Three-phase kW is not multiplied by 3.`}
                  </p>
                  <p className="text-sm leading-6 text-[#5c5146]">
                    Tick Can bake with for categories and items that can share this oven. Tick Cannot bake with for the ones that need their own oven. Sausage rolls and pastry pinwheels start able to share. Cakes and brownies start unable to share with savoury pastry. The day then puts compatible trays in one batch, up to 4 in one oven and 6 across both, and splits that oven cost by tray.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["can", "cannot"] as const).map((choice) => (
                      <div key={choice}>
                        <p className="text-sm font-medium">{choice === "can" ? "Can bake with" : "Cannot bake with"}</p>
                        <ul className="mt-2 space-y-1">
                          {OVEN_BATCH_GROUPS.filter((entry) => entry.id !== "none").map((entry) => {
                            const selectedChoice = categoryPartnerChoice(recipe, entry.id);
                            return (
                              <li key={entry.id}>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedChoice === choice}
                                    aria-label={`${choice === "can" ? "Can bake with" : "Cannot bake with"} ${entry.label}`}
                                    onChange={() => onChangeRecipes((current) => setBakePartner(current, recipe.itemName, bakePartnerGroupToken(entry.id), choice))}
                                  />
                                  <span>{entry.label}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Search items</span>
                    <input
                      className={controlClass}
                      value={partnerQuery}
                      onChange={(event) => setPartnerQuery(event.target.value)}
                      placeholder="Search sausage rolls, pinwheels, cakes"
                      aria-label="Search bake partners"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["can", "cannot"] as const).map((choice) => (
                      <div key={choice}>
                        <p className="text-sm font-medium">{choice === "can" ? "Can bake with" : "Cannot bake with"}</p>
                        <ul className="mt-2 max-h-64 space-y-1 overflow-auto">
                          {visiblePartners.map((name) => {
                            const other = resolveItemBake(name, undefined, recipes, bakeSettings);
                            const shares = currentBake ? bakesCanShare(currentBake, other, recipes) : false;
                            const selectedChoice = shares ? "can" : "cannot";
                            return (
                              <li key={name}>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedChoice === choice}
                                    aria-label={`${choice === "can" ? "Can bake with" : "Cannot bake with"} ${name}`}
                                    onChange={() => onChangeRecipes((current) => setBakePartner(current, recipe.itemName, bakePartnerItemToken(name), choice))}
                                  />
                                  <span>{name}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        {visiblePartners.length === 0 ? <p className="mt-1 text-sm text-[#5c5146]">No baked items match that search.</p> : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Time to prepare (minutes)</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="1"
                  value={recipe.prepMinutes ?? 0}
                  aria-label="Prep time"
                  onChange={(event) => update({ prepMinutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Labour rate (£ per hour, optional)</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={recipe.labourHourlyRate ?? ""}
                  placeholder="Leave blank to exclude labour"
                  aria-label="Labour hourly rate"
                  onChange={(event) => {
                    const raw = event.target.value;
                    update({ labourHourlyRate: raw === "" ? undefined : Math.max(0, Number(raw) || 0) });
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Small pots per item</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="1"
                  value={recipe.potCount ?? 0}
                  aria-label="Small pot count"
                  onChange={(event) => update({ potCount: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Price per small pot (£)</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={recipe.potUnitCost ?? 0.1}
                  aria-label="Small pot price"
                  onChange={(event) => update({ potUnitCost: Math.max(0, Number(event.target.value) || 0) })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Items this recipe covers</span>
                <input
                  className={controlClass}
                  type="number"
                  min="1"
                  step="1"
                  value={recipe.coversUnits ?? 1}
                  aria-label="Batch size"
                  onChange={(event) => update({ coversUnits: Math.max(1, Math.round(Number(event.target.value) || 1)) })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Target margin (%)</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  value={recipe.targetMarginPercent ?? 30}
                  aria-label="Target margin"
                  onChange={(event) => update({ targetMarginPercent: Math.min(99, Math.max(0, Number(event.target.value) || 0)) })}
                />
              </label>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Ingredients</h4>
              <p className="mt-1 text-sm text-[#5c5146]">Search the supplies list and add a quantity or weight. Costs update from the pack price.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                <input
                  className={controlClass}
                  value={ingredientQuery}
                  onChange={(event) => setIngredientQuery(event.target.value)}
                  placeholder="Search ingredients"
                  aria-label="Search ingredients"
                />
                <input
                  className={controlClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ingredientQty}
                  onChange={(event) => setIngredientQty(event.target.value)}
                  aria-label="Ingredient quantity"
                />
                <select className={controlClass} value={ingredientUnit} onChange={(event) => setIngredientUnit(event.target.value as EnteredUnit)} aria-label="Ingredient unit">
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <ul className="mt-2 space-y-1">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`${secondaryClass} w-full justify-between`} onClick={() => addIngredient(item)}>
                      <span>{item.name}</span>
                      <span className="text-[#5c5146]">{item.supplier} · add</span>
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 space-y-2">
                {recipe.lines.map((line) => {
                  const item = catalogue.find((entry) => entry.id === line.catalogueId);
                  const shownQty = line.enteredQuantity ?? line.quantity;
                  const shownUnit = line.enteredUnit ?? item?.unit ?? "units";
                  return (
                    <li key={line.catalogueId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#eadfce] px-3 py-2 text-sm">
                      <span className="font-medium">{item?.name ?? "Missing supply"}</span>
                      <label className="flex items-center gap-2 text-[#5c5146]">
                        <input
                          className={`${controlClass} w-24`}
                          type="number"
                          min="0"
                          step="1"
                          value={shownQty}
                          aria-label={`${item?.name ?? "Ingredient"} quantity`}
                          onChange={(event) => {
                            const entered = Math.max(0, Number(event.target.value) || 0);
                            const weighed = shownUnit === "g" || shownUnit === "kg" || shownUnit === "ml";
                            const enteredUnit: EnteredUnit = weighed ? shownUnit : "units";
                            const quantity = weighed
                              ? storedQuantity(entered, enteredUnit, item?.unit ?? "units")
                              : entered;
                            update({
                              lines: recipe.lines.map((entry) =>
                                entry.catalogueId === line.catalogueId
                                  ? weighed
                                    ? { ...entry, quantity, enteredQuantity: entered, enteredUnit }
                                    : { ...entry, quantity, enteredQuantity: undefined, enteredUnit: undefined }
                                  : entry,
                              ),
                            });
                          }}
                        />
                        <span>{`${shownUnit} · ${gbp(lineCost(catalogue, line))}`}</span>
                      </label>
                      <button
                        type="button"
                        className={secondaryClass}
                        onClick={() => update({ lines: recipe.lines.filter((entry) => entry.catalogueId !== line.catalogueId) })}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {profit ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[#2c241c]">Current figures, £0.00 VAT</p>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Ingredients cost</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.ingredientCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Cups Direct box</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.boxCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Pots</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.potCost)}</dd>
                    <p className="text-sm text-[#5c5146]">{`${profit.potCount} × small pots @ ${gbp(profit.potUnitCost)} = ${gbp(profit.potCost)}`}</p>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Electricity</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.electricityCost)}</dd>
                    <p className="text-sm text-[#5c5146]">
                      {currentBake?.baked
                        ? currentBake.preBakeMinutes > 0
                          ? `One oven for this item alone is ${gbp(currentBake.soloCost)}, including the ${currentBake.preBakeMinutes}-minute pre-bake and the ${currentBake.minutes}-minute bake. Full draw for the same time is ${gbp(ovenProfileCost(currentBake.preBakeMinutes, currentBake.minutes, bakeSettings, 1))}. On an order, a shared bake is split by tray and the pre-bake stays in full on the quiche.`
                          : `One oven at this duty cycle is ${gbp(currentBake.soloCost)}. Full draw for the same bake is ${gbp(fullDrawElectricityPounds(currentBake.minutes, bakeSettings))}. On an order, a shared oven is split across the trays in that batch. A separate oven is charged in full.`
                        : "This item is not baked, so electricity on this card is £0.00."}
                    </p>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Labour</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.labourCost)}</dd>
                    <p className="text-sm text-[#5c5146]">{`${recipe.prepMinutes ?? 0} min at ${gbp(recipe.labourHourlyRate ?? 0)} an hour. Labour stays at 0% VAT.`}</p>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Total direct cost</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.directCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Sale price</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.salePrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Current profit</dt>
                    <dd className="text-xl font-semibold">{gbp(profit.profit)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Current margin</dt>
                    <dd className="text-xl font-semibold">{`${profit.marginPercent}%`}</dd>
                  </div>
                </dl>
                <p className="text-sm leading-6 text-[#5c5146]">
                  {boxSize
                    ? `Cups Direct box size ${boxSize} is ${gbp(profit.boxCost)} each. VAT on this card is £0.00.`
                    : "Choose a Cups Direct box size from 1 to 5. The box cost stays £0.00 until then, and VAT on this card is £0.00."}
                </p>
                <div
                  className="rounded-md border border-[#e4d5c3] bg-[#f3f0ea] p-3 text-[#8a8178]"
                  style={{ opacity: 0.72, backgroundColor: "#f3f0ea", color: "#8a8178" }}
                >
                  <p className="text-xs font-semibold tracking-wide uppercase">If VAT registered — 20% VAT applied</p>
                  <p className="mt-1 text-sm leading-6">
                    Preview only. Sarah is not VAT-registered, so this 20% figure is not live tax.
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold tracking-wide uppercase">Illustrative 20% VAT</dt>
                      <dd className="text-lg font-semibold">{gbp(profit.registeredVatAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide uppercase">Sale price after VAT</dt>
                      <dd className="text-lg font-semibold">{gbp(profit.registeredNetSale)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide uppercase">Profit</dt>
                      <dd className="text-lg font-semibold">{gbp(profit.registeredProfit)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-wide uppercase">Margin</dt>
                      <dd className="text-lg font-semibold">{`${profit.registeredMarginPercent}%`}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-sm leading-6">
                    {`The 20% is worked out of the ${gbp(profit.salePrice)} sale price. Labour and raw ingredients stay at 0% VAT, so their cost is unchanged. Current profit ${gbp(profit.profit)} would become ${gbp(profit.registeredProfit)}.`}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#5c5146]">Choose a website item.</p>
        )}
      </div>
    </section>
  );
}
