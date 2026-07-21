import { bankError, bankSuccess } from "@/lib/category-bank-route";
import { openCategoryBank } from "@/lib/category-bank-server";

export async function POST(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await context.params;
    return bankSuccess(await openCategoryBank(draftId));
  } catch (error) {
    return bankError(error);
  }
}
