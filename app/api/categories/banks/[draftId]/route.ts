import { parseCategoryBankSaveRequest } from "@/lib/category-bank-contract";
import { bankError, bankSuccess, invalidBankRequest } from "@/lib/category-bank-route";
import { saveCategoryBank } from "@/lib/category-bank-server";

export async function PUT(request: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const input = parseCategoryBankSaveRequest(await request.json());
    if (!input) return invalidBankRequest();
    const { draftId } = await context.params;
    return bankSuccess(await saveCategoryBank(draftId, input));
  } catch (error) {
    if (error instanceof SyntaxError) return invalidBankRequest();
    return bankError(error);
  }
}
