import { parseCategoryBankDecisionRequest } from "@/lib/category-bank-review-contract";
import { decideCategoryBank } from "@/lib/category-bank-review-server";
import { bankError, bankSuccess, invalidBankRequest } from "@/lib/category-bank-route";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const input = parseCategoryBankDecisionRequest(await request.json());
    if (!input) return invalidBankRequest();
    const { draftId } = await params;
    return bankSuccess(await decideCategoryBank(draftId, input));
  } catch (error) {
    if (error instanceof SyntaxError) return invalidBankRequest();
    return bankError(error);
  }
}
