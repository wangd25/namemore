import { parseCategoryReportRequest } from "@/lib/category-moderation-contract";
import { moderationError, moderationSuccess, invalidModerationRequest } from "@/lib/category-moderation-route";
import { createCategoryReport } from "@/lib/category-moderation-server";
import { readCategoryJsonBody } from "@/lib/category-discovery-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseCategoryReportRequest(await readCategoryJsonBody(request));
  if (!input) return invalidModerationRequest();
  try {
    return moderationSuccess(await createCategoryReport(input));
  } catch (error) {
    return moderationError(error);
  }
}
