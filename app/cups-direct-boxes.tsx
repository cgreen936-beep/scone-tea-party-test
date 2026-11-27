"use client";

import { type Dispatch, type SetStateAction } from "react";
import { supplyStockKey } from "./stock-amend";
import { CUPS_DIRECT_BOX_SIZES, boxCatalogueId, type CatalogueItem } from "@/lib/costing";

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

export default function CupsDirectBoxes({
  catalogue,
  stock,
  onChangeCatalogue,
  onChangeStock,
}: {
  catalogue: CatalogueItem[];
  stock: Record<string, number>;
  onChangeCatalogue: Dispatch<SetStateAction<CatalogueItem[]>>;
  onChangeStock: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  function setCost(id: string, value: number) {
    onChangeCatalogue((current) => current.map((item) => (item.id === id ? { ...item, cost: Math.max(0, value) } : item)));
  }

  function setStock(key: string, value: number) {
    onChangeStock((current) => ({ ...current, [key]: Math.max(0, Math.round(value)) }));
  }

  return (
    <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Cups Direct boxes">
      <h2 className="text-lg font-semibold">Cups Direct Boxes (Sizes 1–5)</h2>
      <p className="mt-1 text-sm leading-6 text-[#5c5146]">
        Unit cost and total stock are the same figures on Morrisons & Supplies and Website Menu Items. Changing either updates box cost, profit, and the 14-day stock warning.
      </p>
      <div className="mt-3 overflow-auto rounded-lg border border-[#eadfce]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#fffaf3] text-xs tracking-wide text-[#5c5146] uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Unit cost (£)</th>
              <th className="px-3 py-2 font-semibold">Total stock</th>
            </tr>
          </thead>
          <tbody>
            {CUPS_DIRECT_BOX_SIZES.map((size) => {
              const id = boxCatalogueId(`cups-${size}`);
              const item = catalogue.find((entry) => entry.id === id);
              const key = item ? supplyStockKey(item) : `Cups Direct box size ${size}|Cups Direct box size ${size}`;
              return (
                <tr key={size} className="border-t border-[#eadfce]">
                  <td className="px-3 py-2 font-medium">{`Size ${size}`}</td>
                  <td className="px-3 py-2">
                    <input
                      className={controlClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item?.cost ?? 0}
                      aria-label={`Cups Direct size ${size} unit cost`}
                      onChange={(event) => setCost(id, Number(event.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={controlClass}
                      type="number"
                      min="0"
                      step="1"
                      value={stock[key] ?? 0}
                      aria-label={`Cups Direct size ${size} stock`}
                      onChange={(event) => setStock(key, Number(event.target.value) || 0)}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-[#eadfce]">
              <td className="px-3 py-2 font-medium">Small pots</td>
              <td className="px-3 py-2 text-[#5c5146]">Set on each menu item</td>
              <td className="px-3 py-2">
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="1"
                  value={stock["Small pot|Small pot"] ?? 0}
                  aria-label="Small pot stock"
                  onChange={(event) => setStock("Small pot|Small pot", Number(event.target.value) || 0)}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
