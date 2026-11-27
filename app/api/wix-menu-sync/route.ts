import { connection } from "next/server";
import { readLocalMenuCatalog } from "@/lib/wix-menu-sync";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  return Response.json({ catalog: readLocalMenuCatalog() }, { headers });
}

export async function POST() {
  await connection();
  return Response.json(
    {
      refreshed: false,
      reason: "This deployment uses the saved menu catalog. No request was sent to Wix.",
      catalog: readLocalMenuCatalog(),
    },
    { headers },
  );
}
