import { CategoryReviewWorkspace } from "@/components/CategoryReviewWorkspace";
import { getCategoryReviewQueue } from "@/lib/category-review-server";

export const dynamic = "force-dynamic";

export default async function CategoryReviewPage() {
  const initialPayload = await getCategoryReviewQueue().catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryReviewWorkspace initialPayload={initialPayload} />
    </main>
  );
}
