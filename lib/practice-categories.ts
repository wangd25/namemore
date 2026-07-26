import type { Category } from "@/lib/category-types";
import { chemicalElementsCategory } from "@/lib/chemical-elements";
import { usStatesCategory } from "@/lib/us-states";

export const practiceCategories: readonly Category[] = [
  chemicalElementsCategory,
  usStatesCategory,
];

export function getPracticeCategory(slug: string): Category | null {
  return practiceCategories.find((category) => category.slug === slug) ?? null;
}
