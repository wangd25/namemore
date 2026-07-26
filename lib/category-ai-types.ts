import type { CategoryBankAnswer } from "@/lib/category-bank-types";

export type CategoryAiSourceSuggestion = {
  label: string;
  url: string;
};

export type CategoryAiDraftPayload = {
  status: "needs-verification";
  model: string;
  generatedAt: string;
  answers: CategoryBankAnswer[];
  sourceSuggestions: CategoryAiSourceSuggestion[];
  coverageWarnings: string[];
  validation: {
    canonicalCount: number;
    aliasCount: number;
  };
};
