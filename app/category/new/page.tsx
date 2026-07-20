import { CategoryDraftForm } from "@/components/CategoryDraftForm";
import { listCategoryDrafts } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const params = await searchParams;
  const initialPrompt = typeof params.prompt === "string" ? params.prompt.slice(0, 160) : "";
  const initialPayload = await listCategoryDrafts().catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryDraftForm initialPrompt={initialPrompt} initialPayload={initialPayload} />
    </main>
  );
}
