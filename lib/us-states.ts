import type { Category, CategoryAnswer } from "@/lib/category-types";
import { toStableAnswerId } from "@/lib/normalize";

export type CensusRegion = "northeast" | "midwest" | "south" | "west";

type StateRecord = readonly [
  name: string,
  postalCode: string,
  region: CensusRegion,
];

export const usStateRecords: readonly StateRecord[] = [
  ["Alabama", "AL", "south"],
  ["Alaska", "AK", "west"],
  ["Arizona", "AZ", "west"],
  ["Arkansas", "AR", "south"],
  ["California", "CA", "west"],
  ["Colorado", "CO", "west"],
  ["Connecticut", "CT", "northeast"],
  ["Delaware", "DE", "south"],
  ["Florida", "FL", "south"],
  ["Georgia", "GA", "south"],
  ["Hawaii", "HI", "west"],
  ["Idaho", "ID", "west"],
  ["Illinois", "IL", "midwest"],
  ["Indiana", "IN", "midwest"],
  ["Iowa", "IA", "midwest"],
  ["Kansas", "KS", "midwest"],
  ["Kentucky", "KY", "south"],
  ["Louisiana", "LA", "south"],
  ["Maine", "ME", "northeast"],
  ["Maryland", "MD", "south"],
  ["Massachusetts", "MA", "northeast"],
  ["Michigan", "MI", "midwest"],
  ["Minnesota", "MN", "midwest"],
  ["Mississippi", "MS", "south"],
  ["Missouri", "MO", "midwest"],
  ["Montana", "MT", "west"],
  ["Nebraska", "NE", "midwest"],
  ["Nevada", "NV", "west"],
  ["New Hampshire", "NH", "northeast"],
  ["New Jersey", "NJ", "northeast"],
  ["New Mexico", "NM", "west"],
  ["New York", "NY", "northeast"],
  ["North Carolina", "NC", "south"],
  ["North Dakota", "ND", "midwest"],
  ["Ohio", "OH", "midwest"],
  ["Oklahoma", "OK", "south"],
  ["Oregon", "OR", "west"],
  ["Pennsylvania", "PA", "northeast"],
  ["Rhode Island", "RI", "northeast"],
  ["South Carolina", "SC", "south"],
  ["South Dakota", "SD", "midwest"],
  ["Tennessee", "TN", "south"],
  ["Texas", "TX", "south"],
  ["Utah", "UT", "west"],
  ["Vermont", "VT", "northeast"],
  ["Virginia", "VA", "south"],
  ["Washington", "WA", "west"],
  ["West Virginia", "WV", "south"],
  ["Wisconsin", "WI", "midwest"],
  ["Wyoming", "WY", "west"],
] as const;

function buildStateAnswers(): readonly CategoryAnswer[] {
  return usStateRecords.map(([canonicalText, postalCode, region]) => ({
    id: `us-state-${toStableAnswerId(canonicalText)}`,
    canonicalText,
    aliases: [],
    visual: {
      kind: "text" as const,
      label: postalCode,
      accessibleLabel: `${postalCode}, ${canonicalText} postal abbreviation`,
      primaryColor: "#2159c7",
      secondaryColor: "#e4ecff",
    },
    groupIds: [region],
  }));
}

export const usStatesCategory: Category = {
  slug: "us-states",
  version: 1,
  snapshotDate: "2026-07-25",
  title: "U.S. states",
  prompt: "How many U.S. states can you name?",
  timeLimitSeconds: 90,
  inputLabel: "Type a U.S. state",
  inputPlaceholder: "Type a state name…",
  sourceLabel: "U.S. Census Bureau regions and divisions · July 25, 2026",
  coverage: {
    title: "Census region coverage",
    itemLabel: "Regions",
    groups: [
      { id: "northeast", label: "Northeast" },
      { id: "midwest", label: "Midwest" },
      { id: "south", label: "South" },
      { id: "west", label: "West" },
    ],
  },
  answers: buildStateAnswers(),
};
