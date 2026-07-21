import {
  parseCategoryModerationDecisionRequest,
  parseCategoryReportId,
} from "@/lib/category-moderation-contract";
import { invalidModerationRequest, moderationError, moderationSuccess } from "@/lib/category-moderation-route";
import { decideCategoryReport } from "@/lib/category-moderation-server";
import { readCategoryJsonBody } from "@/lib/category-discovery-route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const reportId = parseCategoryReportId((await params).reportId);
  const input = parseCategoryModerationDecisionRequest(await readCategoryJsonBody(request));
  if (!reportId || !input) return invalidModerationRequest();
  try {
    return moderationSuccess(await decideCategoryReport(reportId, input));
  } catch (error) {
    return moderationError(error);
  }
}
