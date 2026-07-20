import { normalizeDiscoveryQuery } from "@/lib/category-discovery-contract";
import { categoryError, categorySuccess, invalidCategoryRequest } from "@/lib/category-discovery-route";
import { getCategoryDiscovery } from "@/lib/category-discovery-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = normalizeDiscoveryQuery(new URL(request.url).searchParams.get("q") ?? "");
  if (query === null) return invalidCategoryRequest();
  try {
    return categorySuccess(await getCategoryDiscovery(query));
  } catch (error) {
    return categoryError(error);
  }
}
