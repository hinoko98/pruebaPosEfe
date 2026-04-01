const CODE_REGEX = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCodeInput(value: string) {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePrefixedCode(value: string, prefix: string) {
  const normalizedPrefix = normalizeCodeInput(prefix);
  const normalizedValue = normalizeCodeInput(value);

  if (!normalizedValue) return `${normalizedPrefix}-`;
  if (normalizedValue === normalizedPrefix) return `${normalizedPrefix}-`;
  if (normalizedValue.startsWith(`${normalizedPrefix}-`)) return normalizedValue;

  const trimmedValue = normalizedValue.startsWith(normalizedPrefix)
    ? normalizedValue.slice(normalizedPrefix.length).replace(/^-+/, "")
    : normalizedValue;

  return `${normalizedPrefix}-${trimmedValue}`;
}

export function isValidCode(value: string, minLength = 4, maxLength = 40) {
  return value.length >= minLength && value.length <= maxLength && CODE_REGEX.test(value);
}

export function suggestNextCode(existingCodes: Array<string | null | undefined>, prefix: string, digits = 4) {
  const normalizedPrefix = normalizeCodeInput(prefix);
  const matcher = new RegExp(`^${normalizedPrefix}-(\\d+)$`);

  let currentMax = 0;
  for (const code of existingCodes) {
    const normalizedCode = normalizeCodeInput(code || "");
    const match = normalizedCode.match(matcher);
    if (!match) continue;

    currentMax = Math.max(currentMax, Number(match[1] || 0));
  }

  return `${normalizedPrefix}-${String(currentMax + 1).padStart(digits, "0")}`;
}

export function resolveManagedCode(params: {
  desiredCode?: string | null;
  existingCodes: Array<string | null | undefined>;
  prefix: string;
  digits?: number;
  minLength?: number;
  maxLength?: number;
}) {
  const candidate = params.desiredCode?.trim()
    ? normalizePrefixedCode(params.desiredCode, params.prefix)
    : suggestNextCode(params.existingCodes, params.prefix, params.digits);

  if (!isValidCode(candidate, params.minLength, params.maxLength)) {
    throw new Error(`El codigo debe usar solo letras, numeros y guiones.`);
  }

  const normalizedExisting = new Set(
    params.existingCodes
      .map((code) => normalizeCodeInput(code || ""))
      .filter(Boolean)
  );

  if (normalizedExisting.has(candidate)) {
    throw new Error(`El codigo ${candidate} ya existe.`);
  }

  return candidate;
}

export function resolveLooseCode(params: {
  desiredCode?: string | null;
  existingCodes: Array<string | null | undefined>;
  generatedPrefix: string;
  digits?: number;
  minLength?: number;
  maxLength?: number;
}) {
  const candidate = params.desiredCode?.trim()
    ? normalizeCodeInput(params.desiredCode)
    : suggestNextCode(params.existingCodes, params.generatedPrefix, params.digits);

  if (!isValidCode(candidate, params.minLength, params.maxLength)) {
    throw new Error(`El codigo debe usar solo letras, numeros y guiones.`);
  }

  const normalizedExisting = new Set(
    params.existingCodes
      .map((code) => normalizeCodeInput(code || ""))
      .filter(Boolean)
  );

  if (normalizedExisting.has(candidate)) {
    throw new Error(`El codigo ${candidate} ya existe.`);
  }

  return candidate;
}
