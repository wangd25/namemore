import { CategoryBankReviewWorkspace } from "@/components/CategoryBankReviewWorkspace";
import { getCategoryBankReviewQueue } from "@/lib/category-bank-review-server";

export const dynamic = "force-dynamic";

export default async function CategoryBankDecisionsPage() {
  const initialPayload = await getCategoryBankReviewQueue().catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryBankReviewWorkspace initialPayload={initialPayload} />
    </main>
  );
}
