import { parseCategoryPublicationRequest } from "@/lib/category-publication-contract";
import { publishApprovedCategoryBank } from "@/lib/category-publication-server";
import { bankError, bankSuccess, invalidBankRequest } from "@/lib/category-bank-route";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const input = parseCategoryPublicationRequest(await request.json());
    if (!input) return invalidBankRequest();
    const { draftId } = await params;
    return bankSuccess(await publishApprovedCategoryBank(draftId, input));
  } catch (error) {
    if (error instanceof SyntaxError) return invalidBankRequest();
    return bankError(error);
  }
}
