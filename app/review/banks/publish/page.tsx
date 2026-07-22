import { CategoryPublicationWorkspace } from "@/components/CategoryPublicationWorkspace";
import { getCategoryPublicationQueue } from "@/lib/category-publication-server";

export const dynamic = "force-dynamic";

export default async function CategoryPublishingPage() {
  const initialPayload = await getCategoryPublicationQueue().catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryPublicationWorkspace initialPayload={initialPayload} />
    </main>
  );
}
