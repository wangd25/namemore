import { bankError, bankSuccess } from "@/lib/category-bank-route";
import { freezeCategoryBank } from "@/lib/category-bank-server";

export async function POST(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await context.params;
    return bankSuccess(await freezeCategoryBank(draftId));
  } catch (error) {
    return bankError(error);
  }
}
