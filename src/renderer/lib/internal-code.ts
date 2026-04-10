import { normalizeCodeInput, normalizePrefixedCode, suggestNextCode } from "../../shared/internalCodes";

export { normalizeCodeInput, normalizePrefixedCode, suggestNextCode };

export function buildSuggestedManagedCode(existingCodes: Array<string | null | undefined>, prefix: string, digits = 4) {
  return suggestNextCode(existingCodes, prefix, digits);
}
