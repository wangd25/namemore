const displayNameControlCharacters = /[\p{Cc}\p{Cf}]/u;
const displayNameCharacters = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'’-]*$/u;

export function normalizeDisplayName(value: string): string | null {
  if (displayNameControlCharacters.test(value)) return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  const length = Array.from(normalized).length;
  if (length < 2 || length > 24 || !displayNameCharacters.test(normalized)) return null;
  return normalized;
}
