"use client";

import { useState, type FormEvent } from "react";
import { type CatalogueItem, type SupplyUnit } from "@/lib/costing";
import { isMorrisonsProductUrl, savedMorrisonsProductUrl } from "@/lib/morrisons-url";

const UNITS: SupplyUnit[] = ["g", "ml", "loaves", "units"];

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#7d3044] px-4 py-2 text-sm font-semibold text-white hover:bg-[#682736]";

export default function SupplierAdmin({
  catalogue,
  onChangeCatalogue,
}: {
  catalogue: CatalogueItem[];
  onChangeCatalogue: (next: CatalogueItem[]) => void;
}) {
  const [morrisonsQuery, setMorrisonsQuery] = useState("");
  const [otherQuery, setOtherQuery] = useState("");
  const [newMorrisons, setNewMorrisons] = useState({
    name: "",
    packLabel: "",
    packSize: "1",
    unit: "g" as SupplyUnit,
    cost: "",
    url: "",
  });
  const [newOther, setNewOther] = useState({ name: "", supplier: "", packLabel: "", packSize: "1", unit: "units" as SupplyUnit, cost: "" });

  const morrisons = catalogue.filter((item) => item.channel === "morrisons" && matches(item, morrisonsQuery));
  const others = catalogue.filter((item) => item.channel === "other" && matches(item, otherQuery));

  function updateItem(id: string, patch: Partial<CatalogueItem>) {
    onChangeCatalogue(catalogue.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addMorrisons(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newMorrisons.name.trim();
    const packLabel = newMorrisons.packLabel.trim() || name;
    if (!name) return;
    const cost = Number(newMorrisons.cost);
    const packSize = Number(newMorrisons.packSize);
    const item: CatalogueItem = {
      id: `cat:added-${catalogue.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      channel: "morrisons",
      supplier: "Morrisons",
      unit: newMorrisons.unit,
      packSize: packSize > 0 ? packSize : 1,
      packLabel,
      cost: Number.isFinite(cost) ? cost : 0,
      morrisonsUrl: savedMorrisonsProductUrl(newMorrisons.url),
    };
    onChangeCatalogue([...catalogue, item]);
    setNewMorrisons({ name: "", packLabel: "", packSize: "1", unit: "g", cost: "", url: "" });
  }

  function addOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newOther.name.trim();
    if (!name) return;
    const cost = Number(newOther.cost);
    const packSize = Number(newOther.packSize);
    const item: CatalogueItem = {
      id: `cat:other-${catalogue.length + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      channel: "other",
      supplier: newOther.supplier.trim() || "Other supplier",
      unit: newOther.unit,
      packSize: packSize > 0 ? packSize : 1,
      packLabel: newOther.packLabel.trim() || name,
      cost: Number.isFinite(cost) ? cost : 0,
      morrisonsUrl: "",
    };
    onChangeCatalogue([...catalogue, item]);
    setNewOther({ name: "", supplier: "", packLabel: "", packSize: "1", unit: "units", cost: "" });
  }

  return (
    <section className="mt-6 space-y-10" role="tabpanel" aria-label="Morrisons and supplies">
      <div>
        <h2 className="text-xl font-semibold">Morrisons ingredients</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Shop packs from the trolley recipes and data/morrisons-items.json. Paste a verified
          groceries.morrisons.com/products/… link on each pack. Until then, the trolley searches for the item name.
        </p>
        <input
          className={`${controlClass} mt-3 max-w-md`}
          value={morrisonsQuery}
          onChange={(event) => setMorrisonsQuery(event.target.value)}
          placeholder="Search Morrisons ingredients"
          aria-label="Search Morrisons ingredients"
        />
        <form onSubmit={addMorrisons} className="mt-3 grid gap-2 rounded-lg border border-[#e4d5c3] bg-white p-3 sm:grid-cols-6">
          <input className={controlClass} placeholder="Item name" value={newMorrisons.name} onChange={(event) => setNewMorrisons({ ...newMorrisons, name: event.target.value })} required />
          <input className={controlClass} placeholder="Pack label" value={newMorrisons.packLabel} onChange={(event) => setNewMorrisons({ ...newMorrisons, packLabel: event.target.value })} />
          <input className={controlClass} type="number" min="0.01" step="0.01" placeholder="Pack size" value={newMorrisons.packSize} onChange={(event) => setNewMorrisons({ ...newMorrisons, packSize: event.target.value })} />
          <select className={controlClass} value={newMorrisons.unit} onChange={(event) => setNewMorrisons({ ...newMorrisons, unit: event.target.value as SupplyUnit })}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
          <input className={controlClass} type="number" min="0" step="0.01" placeholder="Cost £" value={newMorrisons.cost} onChange={(event) => setNewMorrisons({ ...newMorrisons, cost: event.target.value })} required />
          <input
            className={`${controlClass} sm:col-span-5`}
            placeholder="https://groceries.morrisons.com/products/…"
            value={newMorrisons.url}
            onChange={(event) => setNewMorrisons({ ...newMorrisons, url: event.target.value })}
            aria-label="Morrisons product URL"
          />
          <button type="submit" className={primaryClass}>Add Morrisons item</button>
        </form>
        <CatalogueTable items={morrisons} onChange={updateItem} showSupplier={false} showUrl />
      </div>

      <div>
        <h2 className="text-xl font-semibold">Non-Morrisons / other suppliers</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Catering trays, cake boxes, wraps, and Cups Direct box sizes 1–5. These stay on the ingredient list and off the Morrisons trolley. Website dishes are edited on Website Menu Items.
        </p>
        <input
          className={`${controlClass} mt-3 max-w-md`}
          value={otherQuery}
          onChange={(event) => setOtherQuery(event.target.value)}
          placeholder="Search other suppliers"
          aria-label="Search other suppliers"
        />
        <form onSubmit={addOther} className="mt-3 grid gap-2 rounded-lg border border-[#e4d5c3] bg-white p-3 sm:grid-cols-6">
          <input className={controlClass} placeholder="Item name" value={newOther.name} onChange={(event) => setNewOther({ ...newOther, name: event.target.value })} required />
          <input className={controlClass} placeholder="Supplier" value={newOther.supplier} onChange={(event) => setNewOther({ ...newOther, supplier: event.target.value })} />
          <input className={controlClass} placeholder="Unit / pack" value={newOther.packLabel} onChange={(event) => setNewOther({ ...newOther, packLabel: event.target.value })} />
          <select className={controlClass} value={newOther.unit} onChange={(event) => setNewOther({ ...newOther, unit: event.target.value as SupplyUnit })}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
          <input className={controlClass} type="number" min="0" step="0.01" placeholder="Cost £" value={newOther.cost} onChange={(event) => setNewOther({ ...newOther, cost: event.target.value })} required />
          <button type="submit" className={primaryClass}>Add supplier item</button>
        </form>
        <CatalogueTable items={others} onChange={updateItem} showSupplier />
      </div>
    </section>
  );
}

function matches(item: CatalogueItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${item.name} ${item.supplier} ${item.packLabel}`.toLowerCase().includes(needle);
}

function CatalogueTable({
  items,
  onChange,
  showSupplier,
  showUrl = false,
}: {
  items: CatalogueItem[];
  onChange: (id: string, patch: Partial<CatalogueItem>) => void;
  showSupplier: boolean;
  showUrl?: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-[#5c5146]">Nothing matches that search.</p>;
  }
  return (
    <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-[#e4d5c3] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-[#fffaf3] text-xs tracking-wide text-[#5c5146] uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Item</th>
            {showSupplier ? <th className="px-3 py-2 font-semibold">Supplier</th> : null}
            <th className="px-3 py-2 font-semibold">Unit / pack</th>
            <th className="px-3 py-2 font-semibold">Pack size</th>
            <th className="px-3 py-2 font-semibold">Cost (£)</th>
            {showUrl ? <th className="px-3 py-2 font-semibold">Product URL</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-[#eadfce]">
              <td className="px-3 py-2">
                <input className={controlClass} value={item.name} onChange={(event) => onChange(item.id, { name: event.target.value })} aria-label={`${item.name} name`} />
              </td>
              {showSupplier ? (
                <td className="px-3 py-2">
                  <input className={controlClass} value={item.supplier} onChange={(event) => onChange(item.id, { supplier: event.target.value })} aria-label={`${item.name} supplier`} />
                </td>
              ) : null}
              <td className="px-3 py-2">
                <input className={controlClass} value={item.packLabel} onChange={(event) => onChange(item.id, { packLabel: event.target.value })} aria-label={`${item.name} pack`} />
                <p className="mt-1 text-xs text-[#5c5146]">{item.unit}</p>
              </td>
              <td className="px-3 py-2">
                <input
                  className={controlClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.packSize}
                  onChange={(event) => onChange(item.id, { packSize: Math.max(0.01, Number(event.target.value) || item.packSize) })}
                  aria-label={`${item.name} pack size`}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.cost}
                  onChange={(event) => onChange(item.id, { cost: Math.max(0, Number(event.target.value) || 0) })}
                  aria-label={`${item.name} cost`}
                />
              </td>
              {showUrl ? (
                <td className="min-w-64 px-3 py-2">
                  <input
                    className={controlClass}
                    value={item.morrisonsUrl}
                    placeholder="https://groceries.morrisons.com/products/…"
                    onChange={(event) => onChange(item.id, { morrisonsUrl: event.target.value })}
                    onBlur={(event) => onChange(item.id, { morrisonsUrl: savedMorrisonsProductUrl(event.target.value) })}
                    aria-label={`${item.name} product URL`}
                  />
                  <p className="mt-1 text-xs text-[#5c5146]">
                    {isMorrisonsProductUrl(item.morrisonsUrl)
                      ? "Product page saved. The trolley export uses this link."
                      : `No product link yet. The trolley searches for “${item.name}”.`}
                  </p>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
