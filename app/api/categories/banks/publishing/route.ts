import { bankError, bankSuccess } from "@/lib/category-bank-route";
import { getCategoryPublicationQueue } from "@/lib/category-publication-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return bankSuccess(await getCategoryPublicationQueue());
  } catch (error) {
    return bankError(error);
  }
}
