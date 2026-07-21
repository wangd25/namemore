import { CategoryModerationWorkspace } from "@/components/CategoryModerationWorkspace";
import { getCategoryModerationQueue } from "@/lib/category-moderation-server";

export const dynamic = "force-dynamic";

export default async function CategoryModerationPage() {
  const initialPayload = await getCategoryModerationQueue().catch(() => null);
  return <CategoryModerationWorkspace initialPayload={initialPayload} />;
}
