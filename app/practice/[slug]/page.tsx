import { notFound } from "next/navigation";

import { GameBoard } from "@/components/GameBoard";
import { CategoryReportDialog } from "@/components/CategoryReportDialog";
import {
  getPracticeCategory,
} from "@/lib/chemical-elements";
import { getPublishedPracticeCategory } from "@/lib/published-practice-server";

export const dynamic = "force-dynamic";

export default async function PracticeCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getPracticeCategory(slug) ?? await getPublishedPracticeCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <main className="arena-shell">
      <GameBoard category={category} />
      <CategoryReportDialog categorySlug={category.slug} categoryTitle={category.title} />
    </main>
  );
}
