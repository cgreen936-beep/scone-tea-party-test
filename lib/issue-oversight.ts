import type { IssueBrief } from "@/lib/desk-warnings";
import { longDate } from "@/lib/desk-warnings";

export interface IssueAdvice {
  paragraphs: string[];
  points: string[];
}

export function overseeIssues(brief: IssueBrief): IssueAdvice {
  const box = brief.boxSize4;
  const paragraphs = [
    box.deficit > 0
      ? `Cups Direct box size 4 is short by ${longDate(brief.throughDate)}. ${box.requiredByDate} boxes are booked and ${box.stock} are in stock, so ${box.deficit} are missing. The 14-day lead time runs through ${longDate(brief.leadDate)} and books ${box.fortnightRequired}, which is ${box.fortnightDeficit} short.`
      : `Cups Direct box size 4 covers the orders booked through ${longDate(brief.throughDate)}. ${box.requiredByDate} are booked and ${box.stock} are in stock.`,
    brief.clashes.length > 0
      ? brief.clashes
          .map((clash) => {
            const places = clash.districts.length > 0 ? clash.districts.join(", ") : clash.area;
            return `${clash.drops} ${clash.area} drops on ${longDate(clash.date)} are booked within ${clash.withinMinutes} minutes (${places}).`;
          })
          .join(" ")
      : "No tight delivery slots are on the book.",
    brief.marginRisks.length > 0
      ? `Booked items in this window include margins under 10% after ingredients, boxes, pots, and labour. The weakest is ${brief.marginRisks[0]?.item ?? "a menu item"} at ${brief.marginRisks[0]?.marginPercent.toFixed(1) ?? "0.0"}% (£${brief.marginRisks[0]?.profit.toFixed(2) ?? "0.00"}).`
      : "Booked items in this window are holding a margin of at least 10% before oven electricity.",
  ];
  const points = [
    box.deficit > 0
      ? `Reorder box size 4 now. Cups Direct takes about two weeks, so an order placed today will not arrive before ${longDate(brief.throughDate)}. Ask for at least ${box.fortnightDeficit} boxes to cover the fortnight, and keep ${box.deficit} aside as the gap that still has to be bridged for ${longDate(brief.throughDate)}.`
      : "Box size 4 stock covers the dated crunch. Keep the fortnight figure in view before the next Cups Direct order.",
    brief.clashes.length > 0
      ? "Move at least two of the tight Stoke-on-Trent slots so each start is about 20 minutes apart. Keep the large spread in the middle of that run and put the small box on either side."
      : "Delivery slots in this window are far enough apart to drive.",
    brief.otherShortages.length > 0
      ? `Other recorded shortages: ${brief.otherShortages
          .slice(0, 4)
          .map((row) => `${row.label} is ${row.deficit} short`)
          .join("; ")}.`
      : "The other Cups Direct sizes still cover the bookings in this window.",
    brief.marginRisks.some((row) => row.profit < 0)
      ? "Raise the sale price or shorten the prep time on items that sell below their direct cost before those orders are baked."
      : "No booked item in this window sells below its direct cost.",
  ];
  return { paragraphs, points };
}
