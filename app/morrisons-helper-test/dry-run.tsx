"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SAMPLE_ROWS = [
  {
    name: "Seeded Loaf",
    trolleyPacks: "2",
    netToBuy: 2,
    unit: "loaves",
    morrisonsUrl: "https://groceries.morrisons.com/products/warburtons-seeded-batch-800g",
  },
  {
    name: "Farmhouse Loaf",
    trolleyPacks: 1,
    netToBuy: 1,
    unit: "loaves",
    morrisonsUrl: "https://groceries.morrisons.com/search?q=Farmhouse%20Loaf",
  },
  {
    name: "Covered Jam",
    trolleyPacks: 0,
    netToBuy: 0,
    unit: "jars",
    morrisonsUrl: "https://groceries.morrisons.com/products/strawberry-jam",
  },
];

const SAMPLE_JSON = JSON.stringify(SAMPLE_ROWS, null, 2);

type MockView = "home" | "product" | "search";

declare global {
  interface Window {
    __SCONE_TROLLEY_DRY_RUN__?: {
      href: string;
      navigate: (url: string) => void;
    };
  }
}

export default function MorrisonsHelperDryRun() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<MockView>("home");
  const [opened, setOpened] = useState("Homepage mock. No item opened yet.");
  const [quantityReadout, setQuantityReadout] = useState("1");
  const [addClicks, setAddClicks] = useState(0);
  const [searchAddClicks, setSearchAddClicks] = useState(0);
  const [checkoutClicks, setCheckoutClicks] = useState(0);
  const [continueClicks, setContinueClicks] = useState(0);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.sessionStorage.removeItem("scone-tea-party-shopping-list");
    const hook = {
      href: "https://groceries.morrisons.com/",
      navigate(url: string) {
        this.href = url;
        window.dispatchEvent(new CustomEvent("scone-dry-run-navigate", { detail: { url } }));
      },
    };
    window.__SCONE_TROLLEY_DRY_RUN__ = hook;

    function onNavigate(event: Event) {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (!detail?.url) return;
      let parsed: URL;
      try {
        parsed = new URL(detail.url);
      } catch {
        return;
      }
      const search = parsed.pathname === "/search" || parsed.pathname.startsWith("/search/");
      setView(search ? "search" : "product");
      setOpened(search ? `Search for ${parsed.searchParams.get("q") || "the item"}` : `Product ${parsed.pathname}`);
      setEvents((current) => [...current, `Stayed local: ${detail.url}`].slice(-8));
    }

    window.addEventListener("scone-dry-run-navigate", onNavigate);
    const script = document.createElement("script");
    script.src = "/api/morrisons-userscript?dry-run=1";
    script.async = false;
    script.onload = () => {
      if (!cancelled) setReady(true);
    };
    script.onerror = () => {
      if (!cancelled) setEvents((current) => [...current, "The helper script did not load."]);
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      window.removeEventListener("scone-dry-run-navigate", onNavigate);
      script.remove();
      document.querySelector("[data-scone-trolley-helper]")?.remove();
      if (window.__SCONE_TROLLEY_DRY_RUN__ === hook) delete window.__SCONE_TROLLEY_DRY_RUN__;
    };
  }, []);

  function record(message: string) {
    setEvents((current) => [...current, message].slice(-8));
  }

  function loadSample() {
    const box = document.querySelector("[data-scone-trolley-helper] [data-role='json']");
    const load = document.querySelector("[data-scone-trolley-helper] [data-role='load']");
    if (!(box instanceof HTMLTextAreaElement) || !(load instanceof HTMLButtonElement)) {
      record("The helper panel is not on the page yet.");
      return;
    }
    box.value = SAMPLE_JSON;
    load.click();
    record("Sample JSON sent to Use pasted list.");
  }

  return (
    <main className="min-h-full bg-[#fffaf3] px-6 py-8 pr-[360px] text-[#2c241c]">
      <p className="text-sm font-semibold tracking-wide text-[#6b3208] uppercase">Local dry run</p>
      <h1 className="mt-1 text-3xl font-semibold">Morrisons helper test</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#5c5146]">
        Mock product and search controls for the trolley helper. Open item stays on this page. Checkout and payment buttons are here so you can see the helper leave them alone.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full bg-[#6b3208] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={loadSample}
          disabled={!ready}
        >
          {ready ? "Load sample JSON" : "Helper is loading"}
        </button>
        <Link className="rounded-full border border-[#e4d5c3] px-4 py-2 text-sm font-semibold" href="/?order=1">
          Back to the ops desk
        </Link>
      </div>

      <section className="mt-6 max-w-xl rounded-xl border border-[#e4d5c3] bg-white p-4">
        <h2 className="text-lg font-semibold">{opened}</h2>
        <p className="mt-1 text-sm text-[#5c5146]">
          {view === "home" ? "This stands in for the Morrisons homepage." : null}
          {view === "product" ? "One quantity box and one Add to trolley button." : null}
          {view === "search" ? "Search fallback. Add packs should stay off." : null}
        </p>

        {view === "product" ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm" htmlFor="mock-quantity">
              Pack quantity
            </label>
            <input
              id="mock-quantity"
              className="w-20 rounded border border-[#e4d5c3] px-2 py-1"
              type="number"
              aria-label="Quantity"
              defaultValue={1}
              min={1}
            />
            <button
              type="button"
              className="rounded-full bg-[#f7c948] px-4 py-2 text-sm font-semibold"
              onClick={() => {
                const input = document.getElementById("mock-quantity");
                const value = input instanceof HTMLInputElement ? input.value : "";
                setQuantityReadout(value);
                setAddClicks((count) => count + 1);
                record(`Add to trolley clicked with quantity ${value}.`);
              }}
            >
              Add to trolley
            </button>
          </div>
        ) : null}

        {view === "search" ? (
          <div className="mt-4">
            <button
              type="button"
              className="rounded-full bg-[#f7c948] px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setSearchAddClicks((count) => count + 1);
                record("Search Add to trolley was clicked.");
              }}
            >
              Add to trolley
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full border border-[#8a2b2b] px-4 py-2 text-sm font-semibold text-[#8a2b2b]"
            onClick={() => {
              setCheckoutClicks((count) => count + 1);
              record("Checkout was clicked.");
            }}
          >
            Checkout
          </button>
          <button
            type="button"
            className="rounded-full border border-[#8a2b2b] px-4 py-2 text-sm font-semibold text-[#8a2b2b]"
            onClick={() => {
              setContinueClicks((count) => count + 1);
              record("Continue to checkout was clicked.");
            }}
          >
            Continue to checkout
          </button>
        </div>
      </section>

      <section className="mt-6 max-w-xl text-sm leading-6">
        <h2 className="font-semibold">What the mock received</h2>
        <ul className="mt-2 space-y-1">
          <li>Quantity in the box: {quantityReadout}</li>
          <li>Product add clicks: {addClicks}</li>
          <li>Search add clicks: {searchAddClicks}</li>
          <li>Checkout clicks: {checkoutClicks}</li>
          <li>Continue to checkout clicks: {continueClicks}</li>
        </ul>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[#5c5146]">
          {events.map((event, index) => (
            <li key={`${index}-${event}`}>{event}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6 max-w-xl">
        <h2 className="text-sm font-semibold">Sample list</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5146]">
          Three rows. Seeded Loaf stores the pack count as text so the helper has to read it. Covered Jam has 0 packs and should drop out, leaving 2 lines.
        </p>
        <pre className="mt-3 overflow-auto rounded-lg border border-[#e4d5c3] bg-white p-3 text-xs leading-5">{SAMPLE_JSON}</pre>
      </section>
    </main>
  );
}
