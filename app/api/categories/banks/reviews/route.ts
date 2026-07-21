import { bankError, bankSuccess } from "@/lib/category-bank-route";
import { getCategoryBankReviewQueue } from "@/lib/category-bank-review-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return bankSuccess(await getCategoryBankReviewQueue());
  } catch (error) {
    return bankError(error);
  }
}
