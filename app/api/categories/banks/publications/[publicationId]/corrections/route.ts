import { parseCategoryPublicationCorrectionRequest } from "@/lib/category-publication-contract";
import { requestCategoryPublicationCorrection } from "@/lib/category-publication-server";
import { bankError, bankSuccess, invalidBankRequest } from "@/lib/category-bank-route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicationId: string }> },
) {
  try {
    const input = parseCategoryPublicationCorrectionRequest(await request.json());
    if (!input) return invalidBankRequest();
    const { publicationId } = await params;
    return bankSuccess(await requestCategoryPublicationCorrection(publicationId, input));
  } catch (error) {
    if (error instanceof SyntaxError) return invalidBankRequest();
    return bankError(error);
  }
}
