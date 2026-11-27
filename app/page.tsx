import { Suspense } from "react";
import { connection } from "next/server";
import OpsDesk from "./ops-desk";
import { CORPORATE_ACCOUNTS, HISTORICAL_CORPORATE_ORDERS } from "@/lib/corporate-portal";
import { loadMorrisonsItems } from "@/lib/load-morrisons-items";
import { loadPublicSiteAssets } from "@/lib/load-public-assets";
import { loadOrderingCatalog } from "@/lib/load-storefront-catalog";
import { loadWixBookedOrders } from "@/lib/load-wix-bookings";
import { publicBrandLogo } from "@/lib/mock-data";
import { readLocalMenuCatalog } from "@/lib/wix-menu-sync";
import { WIX_SCHEDULE_UNTIL } from "@/lib/wix-orders";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#5c5146]">Loading the local schedule…</p>}>
      <LiveDesk />
    </Suspense>
  );
}

async function LiveDesk() {
  // Read the snapshot on each request. With cacheComponents, a sync file read
  // during prerender would freeze the "file missing" result and later pulls
  // would never show up.
  await connection();
  const assets = loadPublicSiteAssets();
  const catalog = loadOrderingCatalog(assets);
  const snapshot = loadWixBookedOrders();
  const importedMorrisons = loadMorrisonsItems();
  return (
    <OpsDesk
      catalog={catalog.items}
      catalogSource={catalog.source}
      brandLogo={publicBrandLogo(assets)}
      bookedOrders={snapshot.orders}
      snapshotStatus={{
        state: snapshot.state,
        pulledAt: snapshot.pulledAt,
        rawOrderCount: snapshot.rawOrderCount,
        openCount: snapshot.openCount,
        canceledCount: snapshot.canceledCount,
      }}
      snapshotCoverage={snapshot.coverage}
      scheduleUntil={WIX_SCHEDULE_UNTIL}
      corporateAccounts={CORPORATE_ACCOUNTS}
      historicalOrders={HISTORICAL_CORPORATE_ORDERS}
      importedMorrisons={importedMorrisons}
      menuCatalog={readLocalMenuCatalog()}
    />
  );
}
