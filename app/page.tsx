import { CategoryDiscovery } from "@/components/CategoryDiscovery";
import { getCategoryDiscovery } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialPayload = await getCategoryDiscovery("").catch(() => null);
  return (
    <main className="discovery-shell">
      <CategoryDiscovery initialPayload={initialPayload} />
    </main>
  );
}
