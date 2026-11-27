import { connection } from "next/server";
import { parseMorrisonsOrderList, readMorrisonsOrderList, saveMorrisonsOrderList } from "@/lib/morrisons-order-list";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}

export async function GET() {
  await connection();
  return Response.json({ items: readMorrisonsOrderList() }, { headers });
}

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a shopping list JSON body." }, { status: 400, headers });
  }
  const items = parseMorrisonsOrderList(body);
  if (!items) return Response.json({ error: "Expected shopping list items with a name, unit, Morrisons link, and packs to buy." }, { status: 400, headers });
  saveMorrisonsOrderList(items);
  return Response.json({ items }, { headers });
}
