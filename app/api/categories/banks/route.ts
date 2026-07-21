import { bankError, bankSuccess } from "@/lib/category-bank-route";
import { getCategoryBankQueue } from "@/lib/category-bank-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return bankSuccess(await getCategoryBankQueue());
  } catch (error) {
    return bankError(error);
  }
}
