const combiningMarks = /\p{M}/gu;
const dashes = /[‐‑‒–—―]/g;
const apostrophes = /[’‘`´]/g;
const nonAlphanumeric = /[^a-z0-9\s]/g;
const repeatedWhitespace = /\s+/g;
const suffixes = new Set(["jr", "sr", "ii", "iii", "iv"]);

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .replace(dashes, " ")
    .replace(apostrophes, "'")
    .toLowerCase()
    .replace(nonAlphanumeric, " ")
    .replace(repeatedWhitespace, " ")
    .trim();
}

export function withoutNameSuffix(value: string): string {
  const words = normalizeAnswer(value).split(" ").filter(Boolean);

  if (words.length > 1 && suffixes.has(words.at(-1) ?? "")) {
    words.pop();
  }

  return words.join(" ");
}

export function getSurname(value: string): string {
  const words = withoutNameSuffix(value).split(" ").filter(Boolean);
  return words.at(-1) ?? "";
}

export function toStableAnswerId(value: string): string {
  return normalizeAnswer(value).replaceAll(" ", "-");
}
