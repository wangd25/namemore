import { CategoryDraftForm } from "@/components/CategoryDraftForm";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const params = await searchParams;
  const initialPrompt = typeof params.prompt === "string" ? params.prompt.slice(0, 160) : "";
  return (
    <main className="discovery-shell">
      <CategoryDraftForm initialPrompt={initialPrompt} />
    </main>
  );
}
