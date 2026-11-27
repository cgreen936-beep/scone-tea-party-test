"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import {
  customerProfits,
  customersIn,
  initialInvoices,
  invoiceMessage,
  mailtoHref,
  markInvoicePaid,
  ordersForCustomer,
  reissueInvoice,
  REISSUE_DUE,
  SESSION_TODAY,
  summariseAccounts,
  type CorporateInvoice,
  type InvoiceStatus,
} from "@/lib/corporate-accounts";
import type { BakeSettings, CatalogueItem, EditableRecipe } from "@/lib/costing";
import type { HistoricalCorporateOrder } from "@/lib/corporate-portal";
import type { MenuItem, RecipeMatrixItem, UnifiedOrder } from "@/lib/mock-data";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function weekdayIndex(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (
    (adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      offsets[month - 1] +
      day) %
    7
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${WEEKDAYS[weekdayIndex(year, month, day)]} ${day} ${MONTHS[month - 1]} ${year}`;
}

function gbp(value: number): string {
  return `£${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

const controlClass =
  "w-full rounded-md border border-[#e4d5c3] bg-white px-3 py-2 text-sm text-[#2c241c] shadow-sm outline-none focus:border-[#7d3044] focus:ring-2 focus:ring-[#7d3044]/30";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#7d3044] px-4 py-2 text-sm font-semibold text-white hover:bg-[#682736] disabled:cursor-not-allowed disabled:bg-[#c9b2b8]";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-[#c4a574] bg-white px-3 py-2 text-sm font-semibold text-[#2c241c] hover:bg-[#faf6ef] disabled:cursor-not-allowed disabled:opacity-60";

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  ISSUED: "bg-[#fff1d6] text-[#8a4b12]",
  OVERDUE: "bg-[#fff1ef] text-[#8a2b2b]",
  PAID: "bg-[#e5f4ea] text-[#1f6b45]",
  REISSUED: "bg-[#f3e4ea] text-[#7d3044]",
};

interface EmailDraft {
  invoiceId: string;
  to: string;
  subject: string;
  body: string;
}

interface EmailLogEntry {
  id: string;
  invoiceId: string;
  to: string;
  subject: string;
  body: string;
}

export default function CorporateAccountsPanel({
  orders,
  historicalOrders,
  catalog,
  matrix,
  catalogue,
  recipes,
  bakeSettings,
  defaultFrom,
  defaultTo,
}: {
  orders: UnifiedOrder[];
  historicalOrders: HistoricalCorporateOrder[];
  catalog: MenuItem[];
  matrix: RecipeMatrixItem[];
  catalogue: CatalogueItem[];
  recipes: EditableRecipe[];
  bakeSettings: BakeSettings;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [invoices, setInvoices] = useState<CorporateInvoice[]>(() => initialInvoices());
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailLog, setEmailLog] = useState<EmailLogEntry[]>([]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [customerQuery, setCustomerQuery] = useState("");
  const [sortKey, setSortKey] = useState<"customer" | "orders" | "gross" | "supplyCost" | "profit" | "margin">("profit");
  const [sortAsc, setSortAsc] = useState(false);

  const report = useMemo(
    () => summariseAccounts(orders, historicalOrders, catalog, from, to, matrix, catalogue, recipes, bakeSettings),
    [bakeSettings, catalog, catalogue, from, historicalOrders, matrix, orders, recipes, to],
  );
  const customers = useMemo(() => customersIn(report.rows), [report.rows]);
  const profits = useMemo(() => customerProfits(report.rows), [report.rows]);
  const visibleProfits = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    const filtered = needle ? profits.filter((row) => row.customer.toLowerCase().includes(needle)) : profits;
    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const compared = typeof left === "string" ? left.localeCompare(String(right), "en-GB") : Number(left) - Number(right);
      return sortAsc ? compared : -compared;
    });
    return sorted;
  }, [customerQuery, profits, sortAsc, sortKey]);
  const customerOrders = useMemo(() => ordersForCustomer(report.rows, customerQuery), [customerQuery, report.rows]);
  const customerExact = customers.some((name) => name.toLowerCase() === customerQuery.trim().toLowerCase());
  const customerTotal = customerOrders.reduce((sum, order) => sum + order.total, 0);
  const customerSupply = customerOrders.reduce((sum, order) => sum + order.supplyCost, 0);
  const visibleInvoices = invoices.filter((invoice) => statusFilter === "ALL" || invoice.status === statusFilter);
  const rangeInvalid = Boolean(from && to && from > to);

  function markPaid(id: string) {
    setInvoices((current) => current.map((invoice) => (invoice.id === id ? markInvoicePaid(invoice, SESSION_TODAY) : invoice)));
  }

  function reissue(id: string) {
    setInvoices((current) =>
      current.map((invoice) => (invoice.id === id ? reissueInvoice(invoice, SESSION_TODAY, REISSUE_DUE) : invoice)),
    );
  }

  function openEmail(invoice: CorporateInvoice) {
    const message = invoiceMessage(invoice);
    setEmailDraft({ invoiceId: invoice.id, ...message });
    setEmailNotice("");
  }

  function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailDraft) return;
    const entry: EmailLogEntry = {
      id: `email-${emailLog.length + 1}`,
      invoiceId: emailDraft.invoiceId,
      to: emailDraft.to.trim(),
      subject: emailDraft.subject.trim(),
      body: emailDraft.body,
    };
    setEmailLog((current) => [entry, ...current]);
    setEmailNotice(`Saved ${entry.invoiceId} for ${entry.to} in this session. No message left this browser.`);
  }

  return (
    <section className="mt-6 space-y-8" role="tabpanel" aria-label="Corporate accounts">
      <div>
        <h2 className="text-xl font-semibold">Invoices (Issued & Overdue)</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Local invoice book for this browser session. Mark as paid, reissue, or open an email preview. Nothing is sent
          to Wix.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Invoice status">
          {(["ALL", "ISSUED", "OVERDUE", "PAID", "REISSUED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? primaryClass : secondaryClass}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "All" : status}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#e4d5c3] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#fffaf3] text-xs tracking-wide text-[#5c5146] uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Invoice</th>
                <th className="px-3 py-2 font-semibold">Company</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-[#eadfce] align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{invoice.id}</p>
                    <p className="text-xs text-[#5c5146]">Issued {formatDate(invoice.issueDate)}</p>
                    {invoice.reissueCount > 0 ? (
                      <p className="text-xs text-[#5c5146]">Reissue {invoice.reissueCount}</p>
                    ) : null}
                    {invoice.paidDate ? <p className="text-xs text-[#1f6b45]">Paid {formatDate(invoice.paidDate)}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{invoice.companyName}</p>
                    <p className="max-w-xs text-xs leading-5 text-[#5c5146]">{invoice.summary}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(invoice.dueDate)}</td>
                  <td className="px-3 py-3 font-semibold whitespace-nowrap">{gbp(invoice.amount)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${STATUS_CLASS[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={secondaryClass}
                        disabled={invoice.status === "PAID"}
                        onClick={() => markPaid(invoice.id)}
                      >
                        Mark as paid
                      </button>
                      <button type="button" className={secondaryClass} onClick={() => reissue(invoice.id)}>
                        Reissue
                      </button>
                      <button type="button" className={secondaryClass} onClick={() => openEmail(invoice)}>
                        <Mail aria-hidden="true" size={16} />
                        Send via email
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {emailLog.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[#e4d5c3] bg-[#fffaf3] p-4">
            <h3 className="font-semibold">Session email log</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {emailLog.map((entry) => (
                <li key={entry.id}>
                  <span className="font-semibold">{entry.invoiceId}</span> to {entry.to} — {entry.subject}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="text-xl font-semibold">Account overview</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Orders in this range, including Wix bookings and company history, set against the Morrisons packs those
          recipes need. Bookings without a stored price use the shop list price. Canceled orders are left out.
        </p>
        <div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">From</span>
            <input className={controlClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">To</span>
            <input className={controlClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {rangeInvalid ? (
          <p className="mt-3 text-sm text-[#8a2b2b]" role="alert">
            From is after To. Choose a range that starts on the earlier date.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-[#e4d5c3] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Orders</p>
              <p className="mt-1 text-2xl font-semibold">{report.summary.orderCount}</p>
              <p className="text-sm text-[#5c5146]">Gross {gbp(report.summary.gross)}</p>
            </article>
            <article className="rounded-lg border border-[#e4d5c3] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Morrisons spend</p>
              <p className="mt-1 text-2xl font-semibold">{gbp(report.summary.morrisons)}</p>
              <p className="text-sm text-[#5c5146]">{report.summary.packCount} packs</p>
            </article>
            <article className="rounded-lg border border-[#e4d5c3] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Ingredient cost</p>
              <p className="mt-1 text-2xl font-semibold">
                {report.summary.costPercent === null ? "—" : `${report.summary.costPercent}%`}
              </p>
              <p className="text-sm text-[#5c5146]">of order value</p>
            </article>
            <article className="rounded-lg border border-[#e4d5c3] bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Gross margin</p>
              <p className="mt-1 text-2xl font-semibold">{gbp(report.summary.margin)}</p>
              <p className="text-sm text-[#5c5146]">Order value minus Morrisons packs</p>
            </article>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold">Customer profit and margin</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Gross spend is the order value in this date range. Ingredient cost uses each line&apos;s recipe,
          including Morrisons packs and other supplier items. Search, or click a column, to compare customers.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#e4d5c3] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#fffaf3] text-xs tracking-wide text-[#5c5146] uppercase">
              <tr>
                {(
                  [
                    ["customer", "Customer"],
                    ["orders", "Orders"],
                    ["gross", "Gross spend"],
                    ["supplyCost", "Ingredient cost"],
                    ["profit", "Gross profit"],
                    ["margin", "Margin"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2 font-semibold">
                    <button
                      type="button"
                      className="font-semibold"
                      onClick={() => {
                        if (sortKey === key) setSortAsc((current) => !current);
                        else {
                          setSortKey(key);
                          setSortAsc(key === "customer");
                        }
                      }}
                    >
                      {label}
                      {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProfits.map((row) => (
                <tr key={row.customer} className="border-t border-[#eadfce]">
                  <td className="px-3 py-2">
                    <button type="button" className="font-medium text-[#7d3044]" onClick={() => setCustomerQuery(row.customer)}>
                      {row.customer}
                    </button>
                  </td>
                  <td className="px-3 py-2">{row.orders}</td>
                  <td className="px-3 py-2">{gbp(row.gross)}</td>
                  <td className="px-3 py-2">{gbp(row.supplyCost)}</td>
                  <td className="px-3 py-2">{gbp(row.profit)}</td>
                  <td className="px-3 py-2">{row.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mt-8 text-xl font-semibold">Individual customer spend</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Search or pick a company or customer inside the date range above.
        </p>
        <label className="mt-3 block max-w-md text-sm">
          <span className="mb-1 block font-medium">Customer or company</span>
          <input
            className={controlClass}
            list="account-customers"
            value={customerQuery}
            onChange={(event) => setCustomerQuery(event.target.value)}
            placeholder="Biocomposits, Leoni, or a booking name"
          />
        </label>
        <datalist id="account-customers">
          {customers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {customerQuery.trim() && customerOrders.length === 0 ? (
          <p className="mt-3 text-sm text-[#5c5146]">No orders for that customer in this range.</p>
        ) : null}
        {customerQuery.trim() && customerOrders.length > 0 && !customerExact && new Set(customerOrders.map((order) => order.customer)).size > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {[...new Set(customerOrders.map((order) => order.customer))].map((name) => (
              <button key={name} type="button" className={secondaryClass} onClick={() => setCustomerQuery(name)}>
                {name}
              </button>
            ))}
          </div>
        ) : null}
        {customerQuery.trim() && customerOrders.length > 0 && (customerExact || new Set(customerOrders.map((order) => order.customer)).size === 1) ? (
          <div className="mt-4 rounded-lg border border-[#e4d5c3] bg-white p-4">
            <p className="text-lg font-semibold">{customerOrders[0].customer}</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Orders</dt>
                <dd className="text-xl font-semibold">{customerOrders.length}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Gross spend</dt>
                <dd className="text-xl font-semibold">{gbp(customerTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Average order</dt>
                <dd className="text-xl font-semibold">{gbp(customerTotal / customerOrders.length)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Ingredient cost</dt>
                <dd className="text-xl font-semibold">{gbp(customerSupply)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Gross profit</dt>
                <dd className="text-xl font-semibold">{gbp(customerTotal - customerSupply)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-[#5c5146] uppercase">Profit margin</dt>
                <dd className="text-xl font-semibold">
                  {customerTotal > 0 ? `${Math.round(((customerTotal - customerSupply) / customerTotal) * 1000) / 10}%` : "0%"}
                </dd>
              </div>
            </dl>
            <h3 className="mt-4 font-semibold">Recent orders</h3>
            <ul className="mt-2 space-y-3">
              {customerOrders.slice(0, 8).map((order) => (
                <li key={order.id} className="border-t border-[#eadfce] pt-3 text-sm">
                  <p className="font-semibold">
                    {formatDate(order.deliveryDate)} · {order.id} · {gbp(order.total)}
                  </p>
                  <p className="text-[#5c5146]">{order.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {emailDraft ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[#2c241c]/50"
            aria-label="Close email preview"
            onClick={() => setEmailDraft(null)}
          />
          <form
            onSubmit={saveEmail}
            role="dialog"
            aria-labelledby="invoice-email-title"
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl"
          >
            <h3 id="invoice-email-title" className="text-lg font-semibold">
              Email {emailDraft.invoiceId}
            </h3>
            <p className="mt-1 text-sm text-[#5c5146]">
              Preview the note, open it in your email app, or keep a copy in this session.
            </p>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">To</span>
              <input
                className={controlClass}
                type="email"
                value={emailDraft.to}
                onChange={(event) => setEmailDraft({ ...emailDraft, to: event.target.value })}
                required
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Subject</span>
              <input
                className={controlClass}
                value={emailDraft.subject}
                onChange={(event) => setEmailDraft({ ...emailDraft, subject: event.target.value })}
                required
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Message</span>
              <textarea
                className={`${controlClass} min-h-40`}
                value={emailDraft.body}
                onChange={(event) => setEmailDraft({ ...emailDraft, body: event.target.value })}
              />
            </label>
            {emailNotice ? (
              <p className="mt-3 text-sm text-[#1f6b45]" role="status">
                {emailNotice}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a className={primaryClass} href={mailtoHref(emailDraft)}>
                Open in email app
              </a>
              <button type="submit" className={secondaryClass}>
                Save to session log
              </button>
              <button type="button" className={secondaryClass} onClick={() => setEmailDraft(null)}>
                Close
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
