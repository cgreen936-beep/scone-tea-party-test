export type ExtraCategory = "extra-fuel" | "extra-electricity" | "cleaning" | "machinery" | "other";

export interface FixedOverhead {
  id: string;
  name: string;
  monthlyAmount: number;
  enabled: boolean;
}

export interface ExtraCost {
  id: string;
  date: string;
  category: ExtraCategory;
  description: string;
  amount: number;
  notes: string;
}

export const EXTRA_CATEGORIES: Array<{ id: ExtraCategory; label: string }> = [
  { id: "extra-fuel", label: "Extra fuel and delivery runs" },
  { id: "extra-electricity", label: "Extra electricity" },
  { id: "cleaning", label: "Cleaning products and consumables" },
  { id: "machinery", label: "Machinery, equipment, or repairs" },
  { id: "other", label: "Other extras" },
];

export const SEEDED_OVERHEADS: FixedOverhead[] = [
  { id: "car", name: "Car", monthlyAmount: 0, enabled: true },
  { id: "fuel", name: "Fuel", monthlyAmount: 0, enabled: true },
  { id: "rent", name: "Rent", monthlyAmount: 0, enabled: true },
  { id: "insurance", name: "Insurance", monthlyAmount: 0, enabled: true },
  { id: "telephone", name: "Telephone", monthlyAmount: 0, enabled: true },
  { id: "website", name: "Website", monthlyAmount: 0, enabled: true },
  { id: "accountancy", name: "Accountancy", monthlyAmount: 0, enabled: true },
];

export function extraCategoryLabel(category: ExtraCategory): string {
  return EXTRA_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Other extras";
}
