import { notFound } from "next/navigation";

import { GameBoard } from "@/components/GameBoard";
import {
  getPracticeCategory,
  practiceCategories,
} from "@/lib/chemical-elements";

export const dynamicParams = false;

export function generateStaticParams() {
  return practiceCategories.map((category) => ({ slug: category.slug }));
}

export default async function PracticeCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getPracticeCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <main className="arena-shell">
      <GameBoard category={category} />
    </main>
  );
}
