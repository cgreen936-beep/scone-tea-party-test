import { connection } from "next/server";
import { adviseDeliveryDays } from "@/lib/delivery-advice-server";
import type { RouteOrder } from "@/lib/delivery-route";

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const orders = parseOrders(body);
  if (!orders) return Response.json({ error: "Expected delivery stops for the selected days." }, { status: 400 });
  const advice = await adviseDeliveryDays(orders);
  return Response.json(advice, { headers: { "Cache-Control": "no-store" } });
}

function parseOrders(value: unknown): RouteOrder[] | null {
  const record = value && typeof value === "object" ? (value as { orders?: unknown }).orders : null;
  if (!Array.isArray(record) || record.length > 200) return null;
  const orders: RouteOrder[] = [];
  for (const row of record) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const id = text(item.id);
    const contactName = text(item.contactName);
    const deliveryAddress = text(item.deliveryAddress);
    const deliveryDate = text(item.deliveryDate);
    const deliveryWindow = text(item.deliveryWindow);
    if (!id || !contactName || !deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return null;
    const fulfillment = item.fulfillment === "COLLECTION" || item.fulfillment === "DELIVERY" ? item.fulfillment : undefined;
    orders.push({
      id,
      contactName,
      companyName: text(item.companyName) || undefined,
      deliveryAddress,
      deliveryDate,
      deliveryWindow: deliveryWindow || "Unscheduled",
      fulfillment,
    });
  }
  return orders;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
