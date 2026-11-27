"use client";

import { useMemo, useState } from "react";
import { EXTRA_CATEGORIES, extraCategoryLabel, updateBusinessBooks, useBusinessBooks, type ExtraCategory, type ExtraCost, type FixedOverhead } from "@/lib/business-books";

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#7d3044] px-4 py-2 text-sm font-semibold text-white hover:bg-[#682736] disabled:cursor-not-allowed disabled:bg-[#c9b2b8]";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef]";

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function pence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function categoryLabel(category: ExtraCategory): string {
  return extraCategoryLabel(category);
}

function inclusiveVat(gross: number): { net: number; vat: number } {
  const net = pence(Math.max(0, gross) / 1.2);
  return { net, vat: pence(Math.max(0, gross) - net) };
}

export default function OverheadsPanel() {
  const books = useBusinessBooks();
  const overheads = books.overheads;
  const extras = books.extras;
  function setOverheads(action: FixedOverhead[] | ((current: FixedOverhead[]) => FixedOverhead[])) {
    updateBusinessBooks((current) => ({
      ...current,
      overheads: typeof action === "function" ? action(current.overheads) : action,
    }));
  }
  function setExtras(action: ExtraCost[] | ((current: ExtraCost[]) => ExtraCost[])) {
    updateBusinessBooks((current) => ({
      ...current,
      extras: typeof action === "function" ? action(current.extras) : action,
    }));
  }
  const [newName, setNewName] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftCategory, setDraftCategory] = useState<ExtraCategory>("extra-electricity");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExtraCategory>("all");

  const monthlyTotal = pence(
    overheads.reduce((sum, item) => sum + (item.enabled ? Math.max(0, item.monthlyAmount) : 0), 0),
  );
  const weeklyTotal = pence((monthlyTotal * 12) / 52);
  const dailyTotal = pence((monthlyTotal * 12) / 365);
  const extraTotal = pence(extras.reduce((sum, item) => sum + Math.max(0, item.amount), 0));
  const filteredExtras = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return extras.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!needle) return true;
      const haystack = `${item.date} ${categoryLabel(item.category)} ${item.description} ${item.notes}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [categoryFilter, extras, query]);
  const filteredTotal = pence(filteredExtras.reduce((sum, item) => sum + Math.max(0, item.amount), 0));
  const fixedVat = inclusiveVat(monthlyTotal);
  const extraVat = inclusiveVat(extraTotal);

  function addOverhead() {
    const name = newName.trim();
    if (!name) return;
    const monthlyAmount = Math.max(0, Number(newMonthly) || 0);
    updateBusinessBooks((current) => ({
      ...current,
      nextFixedId: current.nextFixedId + 1,
      overheads: [...current.overheads, { id: `fixed-${current.nextFixedId}`, name, monthlyAmount, enabled: true }],
    }));
    setNewName("");
    setNewMonthly("");
  }

  function addExtra() {
    const description = draftDescription.trim();
    if (!description) return;
    updateBusinessBooks((current) => ({
      ...current,
      nextExtraId: current.nextExtraId + 1,
      extras: [
        {
          id: `extra-${current.nextExtraId}`,
          date: draftDate,
          category: draftCategory,
          description,
          amount: Math.max(0, Number(draftAmount) || 0),
          notes: draftNotes.trim(),
        },
        ...current.extras,
      ],
    }));
    setDraftDescription("");
    setDraftAmount("");
    setDraftNotes("");
  }

  return (
    <section className="mt-6 space-y-6" role="tabpanel" aria-label="Overheads and variable costs">
      <div>
        <h2 className="text-xl font-semibold">Overheads and variable costs</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
          Monthly overheads and extra spending sit outside the order calculator. Ingredient lines, Cups Direct boxes, pots, and oven electricity stay on the menu items and the schedule. Business Overview reads these same rows. VAT on these figures is £0.00.
        </p>
      </div>

      <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Fixed monthly overheads">
        <h3 className="text-lg font-semibold">Fixed monthly overheads</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
          Tick a row to include it. Untick it to leave it out of the monthly total without deleting it. Amounts are pounds per month.
        </p>
        <ul className="mt-3 space-y-2">
          {overheads.map((item) => (
            <li key={item.id} className="grid gap-2 rounded-md border border-[#eadfce] bg-[#fffaf3] p-3 sm:grid-cols-[auto_minmax(0,1fr)_9rem_auto] sm:items-end">
              <label className="flex items-center gap-2 text-sm sm:pb-2">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  aria-label={`Include ${item.name}`}
                  onChange={(event) =>
                    setOverheads((current) =>
                      current.map((entry) => (entry.id === item.id ? { ...entry, enabled: event.target.checked } : entry)),
                    )
                  }
                />
                Include
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <input
                  className={controlClass}
                  value={item.name}
                  aria-label={`Name for ${item.name}`}
                  onChange={(event) =>
                    setOverheads((current) =>
                      current.map((entry) => (entry.id === item.id ? { ...entry, name: event.target.value } : entry)),
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">£ / month</span>
                <input
                  className={controlClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.monthlyAmount}
                  aria-label={`Monthly amount for ${item.name}`}
                  onChange={(event) =>
                    setOverheads((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, monthlyAmount: Math.max(0, Number(event.target.value) || 0) } : entry,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className={`${secondaryClass} sm:mb-0.5`}
                onClick={() => setOverheads((current) => current.filter((entry) => entry.id !== item.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New overhead</span>
            <input
              className={controlClass}
              value={newName}
              placeholder="Name"
              aria-label="New overhead name"
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">£ / month</span>
            <input
              className={controlClass}
              type="number"
              min="0"
              step="0.01"
              value={newMonthly}
              aria-label="New overhead monthly amount"
              onChange={(event) => setNewMonthly(event.target.value)}
            />
          </label>
          <button type="button" className={primaryClass} onClick={addOverhead} disabled={!newName.trim()}>
            Add overhead
          </button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Fixed monthly total</dt>
            <dd className="text-xl font-semibold">{gbp(monthlyTotal)}</dd>
            <p className="text-sm text-[#5c5146]">VAT £0.00</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Per week</dt>
            <dd className="text-xl font-semibold">{gbp(weeklyTotal)}</dd>
            <p className="text-sm text-[#5c5146]">Monthly total × 12 ÷ 52</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Per day</dt>
            <dd className="text-xl font-semibold">{gbp(dailyTotal)}</dd>
            <p className="text-sm text-[#5c5146]">Monthly total × 12 ÷ 365</p>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-[#e4d5c3] bg-white p-4" aria-label="Variable and extra costs">
        <h3 className="text-lg font-semibold">Variable and extra costs</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5c5146]">
          Log spending the order calculator does not already include: extra electricity outside a bake run, cleaning products, machinery and repairs, and other one-off costs.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Date</span>
            <input className={controlClass} type="date" value={draftDate} aria-label="Extra cost date" onChange={(event) => setDraftDate(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Category</span>
            <select
              className={controlClass}
              value={draftCategory}
              aria-label="Extra cost category"
              onChange={(event) => setDraftCategory(event.target.value as ExtraCategory)}
            >
              {EXTRA_CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Amount (£)</span>
            <input
              className={controlClass}
              type="number"
              min="0"
              step="0.01"
              value={draftAmount}
              aria-label="Extra cost amount"
              onChange={(event) => setDraftAmount(event.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Description</span>
            <input
              className={controlClass}
              value={draftDescription}
              aria-label="Extra cost description"
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>
          <label className="block text-sm lg:col-span-3">
            <span className="mb-1 block font-medium">Notes (optional)</span>
            <input
              className={controlClass}
              value={draftNotes}
              aria-label="Extra cost notes"
              onChange={(event) => setDraftNotes(event.target.value)}
            />
          </label>
        </div>
        <button type="button" className={`${primaryClass} mt-3`} onClick={addExtra} disabled={!draftDescription.trim()}>
          Add extra cost
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Search extras</span>
            <input className={controlClass} value={query} placeholder="Date, category, description, or notes" aria-label="Search extra costs" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Category filter</span>
            <select
              className={controlClass}
              value={categoryFilter}
              aria-label="Filter extra costs by category"
              onChange={(event) => setCategoryFilter(event.target.value as "all" | ExtraCategory)}
            >
              <option value="all">All categories</option>
              {EXTRA_CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">All extra costs</dt>
            <dd className="text-xl font-semibold">{gbp(extraTotal)}</dd>
            <p className="text-sm text-[#5c5146]">{`${extras.length} entr${extras.length === 1 ? "y" : "ies"} · VAT £0.00`}</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Matching this search</dt>
            <dd className="text-xl font-semibold">{gbp(filteredTotal)}</dd>
            <p className="text-sm text-[#5c5146]">{`${filteredExtras.length} shown · VAT £0.00`}</p>
          </div>
        </dl>
        {filteredExtras.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c5146]">No extra costs match this search.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {filteredExtras.map((item) => (
              <li key={item.id} className="space-y-2 rounded-md border border-[#eadfce] bg-[#fffaf3] p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Date</span>
                    <input
                      className={controlClass}
                      type="date"
                      value={item.date}
                      aria-label={`Date for ${item.description}`}
                      onChange={(event) =>
                        setExtras((current) => current.map((entry) => (entry.id === item.id ? { ...entry, date: event.target.value } : entry)))
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Category</span>
                    <select
                      className={controlClass}
                      value={item.category}
                      aria-label={`Category for ${item.description}`}
                      onChange={(event) =>
                        setExtras((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, category: event.target.value as ExtraCategory } : entry,
                          ),
                        )
                      }
                    >
                      {EXTRA_CATEGORIES.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Amount (£)</span>
                    <input
                      className={controlClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      aria-label={`Amount for ${item.description}`}
                      onChange={(event) =>
                        setExtras((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, amount: Math.max(0, Number(event.target.value) || 0) } : entry,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => setExtras((current) => current.filter((entry) => entry.id !== item.id))}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="block text-sm lg:col-span-2">
                    <span className="mb-1 block font-medium">Description</span>
                    <input
                      className={controlClass}
                      value={item.description}
                      aria-label={`Description for ${item.description}`}
                      onChange={(event) =>
                        setExtras((current) =>
                          current.map((entry) => (entry.id === item.id ? { ...entry, description: event.target.value } : entry)),
                        )
                      }
                    />
                  </label>
                  <label className="block text-sm lg:col-span-2">
                    <span className="mb-1 block font-medium">Notes</span>
                    <input
                      className={controlClass}
                      value={item.notes}
                      aria-label={`Notes for ${item.description}`}
                      onChange={(event) =>
                        setExtras((current) => current.map((entry) => (entry.id === item.id ? { ...entry, notes: event.target.value } : entry)))
                      }
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="rounded-md border border-[#e4d5c3] bg-[#f3f0ea] p-3 text-[#8a8178]"
        style={{ opacity: 0.72, backgroundColor: "#f3f0ea", color: "#8a8178" }}
      >
        <p className="text-xs font-semibold tracking-wide uppercase">If VAT registered — 20% VAT applied</p>
        <p className="mt-1 text-sm leading-6">Preview only. Sarah is not VAT-registered, so this 20% figure is not live tax. The amounts above stay as entered, with £0.00 VAT.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide uppercase">Fixed monthly, illustrative 20% VAT</dt>
            <dd className="text-lg font-semibold">{gbp(fixedVat.vat)}</dd>
            <p className="text-sm leading-6">{`Worked out of ${gbp(monthlyTotal)}. The amount after that VAT would be ${gbp(fixedVat.net)}.`}</p>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide uppercase">Extra costs, illustrative 20% VAT</dt>
            <dd className="text-lg font-semibold">{gbp(extraVat.vat)}</dd>
            <p className="text-sm leading-6">{`Worked out of ${gbp(extraTotal)}. The amount after that VAT would be ${gbp(extraVat.net)}. Labour and raw ingredients stay at 0% VAT and are not in this preview.`}</p>
          </div>
        </dl>
      </div>
    </section>
  );
}
