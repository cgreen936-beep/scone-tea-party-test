"use client";

import { useMemo, useState } from "react";
import type { CatalogueItem } from "@/lib/costing";

export function supplyStockKey(item: { name: string; packLabel: string }): string {
  return `${item.name}|${item.packLabel}`;
}

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef]";

export default function StockAmend({
  catalogue,
  required,
  stock,
  onChange,
}: {
  catalogue: CatalogueItem[];
  required: Record<string, number>;
  stock: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [batch, setBatch] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...catalogue]
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB"))
      .filter((item) => {
        if (!needle) return true;
        return `${item.name} ${item.supplier} ${item.packLabel}`.toLowerCase().includes(needle);
      });
  }, [catalogue, query]);

  function setOne(key: string, value: number) {
    onChange({ ...stock, [key]: Math.max(0, value) });
  }

  function applyBatch() {
    const amount = Math.max(0, Number(batch) || 0);
    const next = { ...stock };
    for (const item of rows) {
      const key = supplyStockKey(item);
      if (ticked[key]) next[key] = amount;
    }
    onChange(next);
  }

  return (
    <div className="mt-4 rounded-lg border border-[#e4d5c3] bg-white p-4">
      <h3 className="text-lg font-semibold">Amend stock</h3>
      <p className="mt-1 text-sm leading-6 text-[#5c5146]">
        Every Morrisons ingredient, other supplier line, and Cups Direct box size 1–5 is listed here. Search narrows the list as you type. Tick rows to set them together.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm">
          <span className="mb-1 block font-medium">Search stock</span>
          <input
            className={controlClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ingredients, boxes, suppliers"
            aria-label="Search stock"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Set ticked rows to</span>
          <input
            className={controlClass}
            type="number"
            min="0"
            step="1"
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
            aria-label="Batch stock amount"
          />
        </label>
        <button type="button" className={secondaryClass} onClick={applyBatch}>
          Apply to ticked rows
        </button>
      </div>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-[#eadfce]">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#fffaf3] text-xs tracking-wide text-[#5c5146] uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Use</th>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Supplier</th>
              <th className="px-3 py-2 font-semibold">Needed in range</th>
              <th className="px-3 py-2 font-semibold">In stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const key = supplyStockKey(item);
              const needed = required[key] ?? 0;
              return (
                <tr key={item.id} className="border-t border-[#eadfce]">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(ticked[key])}
                      aria-label={`Tick ${item.name}`}
                      onChange={(event) => setTicked((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.supplier}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {needed} {item.unit}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-24 rounded-md border border-[#e4d5c3] bg-white px-2 py-1 text-sm tabular-nums"
                      type="number"
                      min="0"
                      step="1"
                      value={stock[key] ?? 0}
                      aria-label={`${item.name} stock`}
                      onChange={(event) => setOne(key, Number(event.target.value) || 0)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-3 py-3 text-sm text-[#5c5146]">Nothing matches that search.</p> : null}
      </div>
    </div>
  );
}
