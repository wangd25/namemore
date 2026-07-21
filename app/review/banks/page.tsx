import { CategoryBankWorkspace } from "@/components/CategoryBankWorkspace";
import { getCategoryBankQueue } from "@/lib/category-bank-server";

export const dynamic = "force-dynamic";

export default async function CategoryBankPage() {
  const initialPayload = await getCategoryBankQueue().catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryBankWorkspace initialPayload={initialPayload} />
    </main>
  );
}
