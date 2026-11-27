/**
 * Driving order from Knutton (ST5). Distances use UK postcode centroids for
 * Staffordshire and nearby districts, with a road factor on the straight line.
 * The same function runs in the browser and on the server, so the page does
 * not wait on a network call.
 */

export interface RouteOrder {
  id: string;
  contactName: string;
  companyName?: string;
  deliveryAddress: string;
  deliveryDate: string;
  deliveryWindow: string;
  fulfillment?: "DELIVERY" | "COLLECTION";
  /** Town or district, used when a tight slot clash is explained. */
  district?: string;
  /** Small box, medium platter, or large spread. */
  sizeLabel?: string;
}

export interface TightSlotStop {
  id: string;
  customer: string;
  company?: string;
  postcode: string;
  district: string;
  window: string;
  minutes: number;
  sizeLabel: string;
}

export interface TightSlotClash {
  date: string;
  area: "Stoke-on-Trent";
  withinMinutes: number;
  stops: TightSlotStop[];
}

export interface RouteStopView {
  id: string;
  customer: string;
  company?: string;
  postcode: string;
  window: string;
  rough: boolean;
}

export interface RouteRing {
  id: string;
  customer: string;
  company?: string;
  postcode: string;
  currentWindow: string;
  suggestedWindow: string;
}

export interface DayRoutePlan {
  date: string;
  collections: RouteStopView[];
  bookedSequence: RouteStopView[];
  efficientSequence: RouteStopView[];
  bookedMiles: number;
  efficientMiles: number;
  milesSaved: number;
  minutesSaved: number;
  aligned: boolean;
  roughCount: number;
  rings: RouteRing[];
  /** Stoke-on-Trent drops whose booked starts sit within five minutes. */
  tightSlots: TightSlotStop[];
  summary: string;
}

const DEPOT = { lat: 53.0128, lng: -2.2475 };
const ROAD_FACTOR = 1.35;
const LOCAL_MPH = 22;

/** Outward-code centroids, close enough to order Staffordshire drops. */
const OUTWARD: Record<string, [number, number]> = {
  ST1: [53.025, -2.175],
  ST2: [53.042, -2.14],
  ST3: [52.982, -2.132],
  ST4: [53.002, -2.181],
  ST5: [53.011, -2.228],
  ST6: [53.055, -2.188],
  ST7: [53.087, -2.238],
  ST8: [53.08, -2.15],
  ST9: [53.078, -2.085],
  ST10: [53.0, -1.99],
  ST11: [52.95, -2.05],
  ST12: [52.93, -2.15],
  ST13: [53.108, -1.99],
  ST14: [52.898, -1.865],
  ST15: [52.906, -2.148],
  ST16: [52.807, -2.117],
  ST17: [52.79, -2.1],
  ST18: [52.82, -2.05],
  ST19: [52.73, -2.15],
  ST20: [52.7, -2.22],
  ST21: [52.85, -2.25],
  CW1: [53.097, -2.441],
  CW2: [53.07, -2.45],
  CW3: [53.0, -2.45],
  CW5: [53.068, -2.522],
  CW11: [53.146, -2.366],
  CW12: [53.163, -2.218],
  WS11: [52.69, -2.02],
  TF9: [52.86, -2.45],
};

interface Coord {
  lat: number;
  lng: number;
}

interface PlannedStop extends RouteStopView {
  minutes: number;
  coord: Coord;
}

export function extractPostcode(value: string): string {
  const match = value.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  if (!match) return "";
  return `${match[1]} ${match[2]}`;
}

export function planDeliveryDays(orders: RouteOrder[]): DayRoutePlan[] {
  const byDate = new Map<string, RouteOrder[]>();
  for (const order of orders) {
    const list = byDate.get(order.deliveryDate) ?? [];
    list.push(order);
    byDate.set(order.deliveryDate, list);
  }
  return [...byDate.keys()].sort().map((date) => planDay(date, byDate.get(date) ?? []));
}

function planDay(date: string, orders: RouteOrder[]): DayRoutePlan {
  const collections: RouteStopView[] = [];
  const deliveries: PlannedStop[] = [];
  for (const order of orders) {
    const stop = toStop(order);
    if (isCollection(order)) collections.push(viewOf(stop));
    else deliveries.push(stop);
  }

  if (deliveries.length === 0) {
    return {
      date,
      collections,
      bookedSequence: [],
      efficientSequence: [],
      bookedMiles: 0,
      efficientMiles: 0,
      milesSaved: 0,
      minutesSaved: 0,
      aligned: true,
      roughCount: 0,
      rings: [],
      tightSlots: [],
      summary:
        collections.length > 0
          ? "Collections only, at Knutton (ST5). There is no driving loop today."
          : "No drops on this day.",
    };
  }

  const bookedSequence = routeKeepingTimes(deliveries);
  const efficientSequence = shortestLoop(deliveries);
  const bookedMiles = round1(routeMiles(bookedSequence));
  const efficientMiles = round1(routeMiles(efficientSequence));
  const milesSaved = round1(Math.max(0, bookedMiles - efficientMiles));
  const minutesSaved = Math.max(0, Math.round((milesSaved / LOCAL_MPH) * 60));
  const worthACall = deliveries.length > 1 && (milesSaved >= 2 || minutesSaved >= 10);
  const rings = worthACall ? ringsFor(efficientSequence, deliveries) : [];
  const aligned = rings.length === 0;
  const roughCount = deliveries.filter((stop) => stop.rough).length;
  const tightSlots = stokeTightSlots(orders);

  return {
    date,
    collections,
    bookedSequence: bookedSequence.map(viewOf),
    efficientSequence: efficientSequence.map(viewOf),
    bookedMiles,
    efficientMiles,
    milesSaved: aligned ? 0 : milesSaved,
    minutesSaved: aligned ? 0 : minutesSaved,
    aligned,
    roughCount,
    rings,
    tightSlots,
    summary: summaryFor({
      bookedMiles,
      efficientMiles,
      milesSaved: aligned ? 0 : milesSaved,
      minutesSaved: aligned ? 0 : minutesSaved,
      aligned,
      rings,
      roughCount,
      single: deliveries.length === 1,
      tightSlots,
    }),
  };
}

function toStop(order: RouteOrder): PlannedStop {
  const postcode = extractPostcode(order.deliveryAddress);
  const located = locate(postcode);
  return {
    id: order.id,
    customer: order.contactName || order.companyName || order.id,
    company: order.companyName,
    postcode: postcode || "No postcode",
    window: order.deliveryWindow || "Unscheduled",
    rough: located.rough,
    minutes: windowMinutes(order.deliveryWindow),
    coord: located.coord,
  };
}

function isCollection(order: RouteOrder): boolean {
  if (order.fulfillment === "COLLECTION") return true;
  const address = order.deliveryAddress.toLowerCase();
  return /collection/.test(address) && !extractPostcode(order.deliveryAddress);
}

function viewOf(stop: PlannedStop | RouteStopView): RouteStopView {
  return {
    id: stop.id,
    customer: stop.customer,
    company: stop.company,
    postcode: stop.postcode,
    window: stop.window,
    rough: stop.rough,
  };
}

function locate(postcode: string): { coord: Coord; rough: boolean } {
  if (!postcode) return { coord: scatter("unknown"), rough: true };
  const outward = postcode.split(" ")[0] ?? "";
  const known = OUTWARD[outward];
  const inward = postcode.split(" ")[1] ?? "5AA";
  const sector = Number(inward[0]);
  const shift = Number.isFinite(sector) ? sector : 5;
  const letter = inward.charCodeAt(1) || 70;
  if (!known) return { coord: scatter(outward), rough: true };
  return {
    coord: {
      lat: known[0] + (shift - 5) * 0.006,
      lng: known[1] + (letter - 78) * 0.003,
    },
    rough: false,
  };
}

function scatter(token: string): Coord {
  let hash = 0;
  for (const char of token) hash = (hash * 33 + char.charCodeAt(0)) % 997;
  return { lat: 52.75 + (hash % 40) / 100, lng: -2.55 + ((hash / 40) % 30) / 100 };
}

function windowMinutes(value: string): number {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function routeKeepingTimes(stops: PlannedStop[]): PlannedStop[] {
  const slots = new Map<number, PlannedStop[]>();
  for (const stop of stops) {
    const list = slots.get(stop.minutes) ?? [];
    list.push(stop);
    slots.set(stop.minutes, list);
  }
  const ordered: PlannedStop[] = [];
  let current = DEPOT;
  for (const minutes of [...slots.keys()].sort((a, b) => a - b)) {
    const sequenced = nearestNeighbor(slots.get(minutes) ?? [], current);
    ordered.push(...sequenced);
    const last = sequenced[sequenced.length - 1];
    if (last) current = last.coord;
  }
  return ordered;
}

function shortestLoop(stops: PlannedStop[]): PlannedStop[] {
  if (stops.length <= 7) return exactLoop(stops);
  return twoOpt(nearestNeighbor(stops, DEPOT));
}

function exactLoop(stops: PlannedStop[]): PlannedStop[] {
  let best = stops;
  let bestMiles = routeMiles(stops);
  const current = stops.slice();
  const walk = (index: number) => {
    if (index === current.length) {
      const miles = routeMiles(current);
      if (miles < bestMiles - 0.05) {
        bestMiles = miles;
        best = current.slice();
      }
      return;
    }
    for (let swap = index; swap < current.length; swap += 1) {
      const held = current[index];
      current[index] = current[swap];
      current[swap] = held;
      walk(index + 1);
      current[swap] = current[index];
      current[index] = held;
    }
  };
  walk(0);
  return best;
}

function twoOpt(route: PlannedStop[]): PlannedStop[] {
  let current = route.slice();
  let improved = true;
  while (improved) {
    improved = false;
    for (let start = 0; start < current.length - 1; start += 1) {
      for (let end = start + 1; end < current.length; end += 1) {
        const next = current.slice(0, start).concat(current.slice(start, end + 1).reverse(), current.slice(end + 1));
        if (routeMiles(next) < routeMiles(current) - 0.1) {
          current = next;
          improved = true;
        }
      }
    }
  }
  return current;
}

function nearestNeighbor(stops: PlannedStop[], start: Coord): PlannedStop[] {
  const remaining = [...stops];
  const ordered: PlannedStop[] = [];
  let current = start;
  while (remaining.length > 0) {
    let best = 0;
    let bestMiles = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const miles = roadMiles(current, remaining[index].coord);
      const nearer = miles < bestMiles - 0.05;
      const tie = Math.abs(miles - bestMiles) <= 0.05 && remaining[index].minutes < remaining[best].minutes;
      if (nearer || tie) {
        best = index;
        bestMiles = miles;
      }
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    current = next.coord;
  }
  return ordered;
}

function routeMiles(stops: PlannedStop[]): number {
  let miles = 0;
  let current = DEPOT;
  for (const stop of stops) {
    miles += roadMiles(current, stop.coord);
    current = stop.coord;
  }
  if (stops.length > 0) miles += roadMiles(current, DEPOT);
  return miles;
}

function roadMiles(from: Coord, to: Coord): number {
  const earth = 3958.8;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h))) * ROAD_FACTOR;
}

function ringsFor(efficient: PlannedStop[], deliveries: PlannedStop[]): RouteRing[] {
  const timed = [...deliveries].sort((a, b) => a.minutes - b.minutes || a.customer.localeCompare(b.customer, "en-GB"));
  return efficient.flatMap((stop, index) => {
    const suggested = timed[index];
    if (!suggested || suggested.minutes === stop.minutes) return [];
    return [
      {
        id: stop.id,
        customer: stop.customer,
        company: stop.company,
        postcode: stop.postcode,
        currentWindow: stop.window,
        suggestedWindow: suggested.window,
      },
    ];
  });
}

const STOKE_OUTWARD = new Set(["ST1", "ST2", "ST3", "ST4", "ST6"]);
const TIGHT_SLOT_MINUTES = 5;

function outwardCode(postcode: string): string {
  return postcode.split(" ")[0] ?? "";
}

function stokeTightSlots(orders: RouteOrder[]): TightSlotStop[] {
  const stoke = orders
    .filter((order) => !isCollection(order))
    .map((order) => {
      const postcode = extractPostcode(order.deliveryAddress);
      return {
        id: order.id,
        customer: order.contactName || order.companyName || order.id,
        company: order.companyName,
        postcode: postcode || "No postcode",
        district: order.district?.trim() || locality(order.deliveryAddress),
        window: order.deliveryWindow || "Unscheduled",
        minutes: windowMinutes(order.deliveryWindow),
        sizeLabel: order.sizeLabel?.trim() || "mixed order",
        outward: outwardCode(postcode),
      };
    })
    .filter((stop) => STOKE_OUTWARD.has(stop.outward) && stop.minutes < 24 * 60)
    .sort((a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id));

  let best: TightSlotStop[] = [];
  for (let start = 0; start < stoke.length; start += 1) {
    const group: TightSlotStop[] = [];
    for (let next = start; next < stoke.length; next += 1) {
      if (stoke[next].minutes - stoke[start].minutes > TIGHT_SLOT_MINUTES) break;
      group.push(stoke[next]);
    }
    if (group.length > best.length) best = group;
  }
  return best.length >= 3 ? best : [];
}

function locality(address: string): string {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stoke = parts.findIndex((part) => part.toLowerCase() === "stoke-on-trent");
  if (stoke > 0) return parts[stoke - 1] ?? "";
  return "";
}

export function orderSizeLabel(lines: Array<{ quantity: number; unitPrice: number }>): string {
  const units = lines.reduce((sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0), 0);
  const sale = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  if (sale >= 100 || units >= 10) return "large spread";
  if (sale >= 28 || units >= 3) return "medium platter";
  return "small box";
}

/** Stoke-on-Trent delivery days where three or more drops are booked within five minutes. */
export function tightSlotClashes(orders: RouteOrder[]): TightSlotClash[] {
  const byDate = new Map<string, RouteOrder[]>();
  for (const order of orders) {
    const list = byDate.get(order.deliveryDate) ?? [];
    list.push(order);
    byDate.set(order.deliveryDate, list);
  }
  return [...byDate.keys()].sort().flatMap((date) => {
    const stops = stokeTightSlots(byDate.get(date) ?? []);
    if (stops.length < 3) return [];
    return [{ date, area: "Stoke-on-Trent" as const, withinMinutes: TIGHT_SLOT_MINUTES, stops }];
  });
}

export function tightSlotMessage(clash: TightSlotClash): string {
  const drops = clash.stops
    .map((stop) => {
      const where = stop.district ? `${stop.district} (${stop.postcode})` : stop.postcode;
      return `${where} at ${stop.window}, ${stop.sizeLabel}`;
    })
    .join("; ");
  return `${clash.stops.length} Stoke-on-Trent drops are booked within ${clash.withinMinutes} minutes: ${drops}. The van cannot cover those districts in that gap.`;
}

function summaryFor(input: {
  bookedMiles: number;
  efficientMiles: number;
  milesSaved: number;
  minutesSaved: number;
  aligned: boolean;
  rings: RouteRing[];
  roughCount: number;
  single: boolean;
  tightSlots: TightSlotStop[];
}): string {
  const clash =
    input.tightSlots.length >= 3
      ? `Delivery conflict. ${tightSlotMessage({ date: "", area: "Stoke-on-Trent", withinMinutes: TIGHT_SLOT_MINUTES, stops: input.tightSlots })} `
      : "";
  const rough =
    input.roughCount > 0
      ? ` ${input.roughCount} stop${input.roughCount === 1 ? " has" : "s have"} no recognised Staffordshire postcode, so that position is approximate.`
      : "";
  if (input.single) {
    return `${clash}One delivery. Leave Knutton (ST5), make the drop, and come back, about ${input.bookedMiles.toFixed(1)} miles. No time change to ask for.${rough}`;
  }
  if (input.aligned || input.rings.length === 0) {
    return `${clash}Booked times already follow a sensible loop from Knutton (ST5), about ${input.bookedMiles.toFixed(1)} miles there and back. No one needs a different slot.${rough}`;
  }
  const calls = input.rings
    .map((ring) => {
      const who = ring.company ? `${ring.customer} (${ring.company})` : ring.customer;
      return `Ring ${who} about ${ring.postcode}: booked ${ring.currentWindow}, ask for ${ring.suggestedWindow}.`;
    })
    .join(" ");
  return `${clash}Keeping the booked times is about ${input.bookedMiles.toFixed(1)} miles from Knutton (ST5) and back. A geographically shorter loop is about ${input.efficientMiles.toFixed(1)} miles, saving about ${input.milesSaved.toFixed(1)} miles and ${input.minutesSaved} minutes. ${calls}${rough}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Fuel only, about £0.20 a mile for the van. The booked-time loop already includes the return to Knutton. */
export const FUEL_POUNDS_PER_MILE = 0.2;

export function fuelCostForMiles(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  return Math.round(miles * FUEL_POUNDS_PER_MILE * 100) / 100;
}
