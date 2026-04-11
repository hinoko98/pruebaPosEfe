export type ProductPricingScale = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingSpecialRule = {
  id: string;
  label: string;
  unitPrice: number;
};

export type ProductPricingConfig = {
  enabled: boolean;
  basePrice: number;
  minimumPrice: number;
  quantityScales: ProductPricingScale[];
  specialPriceRules: ProductPricingSpecialRule[];
};

export type ProductPricingScaleInput = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingSpecialRuleInput = {
  id?: string;
  label: string;
  unitPrice: number;
};

type LegacyProductPricingSheetTypeInput = {
  id?: string;
  name?: string;
  basePrice: number;
  minimumPrice?: number | null;
  quantityScales?: ProductPricingScaleInput[];
  specialPriceRules?: ProductPricingSpecialRuleInput[];
  customerSegmentRules?: Array<{
    customerSegment: string;
    unitPrice: number;
  }>;
};

type LegacyProductPricingConfigInput = {
  enabled?: boolean;
  minimumPrice?: number;
  sheetTypes?: LegacyProductPricingSheetTypeInput[];
};

export type ProductPricingConfigInput = {
  enabled?: boolean;
  basePrice?: number;
  minimumPrice?: number;
  quantityScales?: ProductPricingScaleInput[];
  specialPriceRules?: ProductPricingSpecialRuleInput[];
};

export type ProductPricingQuote = {
  unitPrice: number;
  subtotal: number;
  minimumPrice: number;
  specialRuleId: string | null;
  specialRuleLabel: string | null;
  source: "FIXED_PRICE" | "QUANTITY_SCALE" | "SPECIAL_RULE" | "MANUAL_OVERRIDE";
  sourceLabel: string;
  priceBeforeMinimum: number;
  minimumApplied: boolean;
};

export type ProductPricingQuoteInput = {
  fallbackPrice: number;
  pricingConfig?: ProductPricingConfig | null;
  qty: number;
  specialRuleId?: string | null;
  manualUnitPrice?: number | null;
  canOverrideMinimum?: boolean;
};

function toMoney(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeScale(scale: ProductPricingScale | ProductPricingScaleInput) {
  return {
    minQty: Math.max(1, Math.round(Number(scale.minQty || 0))),
    unitPrice: toMoney(scale.unitPrice),
  };
}

function normalizeSpecialRule(rule: ProductPricingSpecialRule | ProductPricingSpecialRuleInput) {
  return {
    id: String(rule.id || "").trim() || crypto.randomUUID(),
    label: String(rule.label || "").trim() || "Tarifa especial",
    unitPrice: toMoney(rule.unitPrice),
  } satisfies ProductPricingSpecialRule;
}

function normalizeLegacyCustomerRule(rule: { customerSegment: string; unitPrice: number }) {
  return normalizeSpecialRule({
    id: `legacy-${rule.customerSegment.toLowerCase()}`,
    label: "Tarifa especial",
    unitPrice: rule.unitPrice,
  });
}

function normalizeLegacyConfig(
  pricingConfig: LegacyProductPricingConfigInput
): ProductPricingConfig | null {
  if (!pricingConfig.enabled) return null;

  const legacyOptions = (pricingConfig.sheetTypes ?? [])
    .map((entry) => ({
      basePrice: toMoney(entry.basePrice),
      minimumPrice:
        entry.minimumPrice === null || entry.minimumPrice === undefined
          ? null
          : toMoney(entry.minimumPrice),
      quantityScales: (entry.quantityScales ?? [])
        .map(normalizeScale)
        .filter((scale) => scale.unitPrice > 0)
        .sort((left, right) => left.minQty - right.minQty)
        .filter(
          (scale, index, collection) => collection.findIndex((entryScale) => entryScale.minQty === scale.minQty) === index
        ),
      specialPriceRules: [
        ...(entry.specialPriceRules ?? []),
        ...((entry.customerSegmentRules ?? []).map(normalizeLegacyCustomerRule)),
      ]
        .map(normalizeSpecialRule)
        .filter((rule) => rule.unitPrice > 0)
        .filter(
          (rule, index, collection) =>
            collection.findIndex(
              (entryRule) => entryRule.id === rule.id || entryRule.label.toLowerCase() === rule.label.toLowerCase()
            ) === index
        ),
    }))
    .filter((entry) => entry.basePrice > 0);

  const preferredLegacyOption = legacyOptions[0];
  if (!preferredLegacyOption) return null;

  return {
    enabled: true,
    basePrice: preferredLegacyOption.basePrice,
    minimumPrice: preferredLegacyOption.minimumPrice ?? toMoney(pricingConfig.minimumPrice),
    quantityScales: preferredLegacyOption.quantityScales,
    specialPriceRules: preferredLegacyOption.specialPriceRules,
  };
}

function pickQuantityScalePrice(pricingConfig: ProductPricingConfig, qty: number) {
  const eligibleRules = [...pricingConfig.quantityScales]
    .map(normalizeScale)
    .filter((scale) => scale.minQty <= qty && scale.unitPrice > 0)
    .sort((left, right) => right.minQty - left.minQty);

  return eligibleRules[0] ?? null;
}

function pickSpecialRule(pricingConfig: ProductPricingConfig, specialRuleId?: string | null) {
  if (!specialRuleId) return null;

  return (
    pricingConfig.specialPriceRules
      .map(normalizeSpecialRule)
      .find((rule) => rule.id === specialRuleId && rule.unitPrice > 0) ?? null
  );
}

export function normalizeProductPricingConfig(
  pricingConfig?: ProductPricingConfigInput | ProductPricingConfig | LegacyProductPricingConfigInput | null
): ProductPricingConfig | null {
  if (!pricingConfig?.enabled) return null;

  if ("sheetTypes" in pricingConfig) {
    return normalizeLegacyConfig(pricingConfig);
  }

  const currentPricingConfig: ProductPricingConfigInput | ProductPricingConfig = pricingConfig;

  const normalizedConfig = {
    enabled: true,
    basePrice: toMoney(currentPricingConfig.basePrice),
    minimumPrice: toMoney(currentPricingConfig.minimumPrice),
    quantityScales: (currentPricingConfig.quantityScales ?? [])
      .map(normalizeScale)
      .filter((scale) => scale.unitPrice > 0)
      .sort((left, right) => left.minQty - right.minQty)
      .filter(
        (scale, index, collection) => collection.findIndex((entry) => entry.minQty === scale.minQty) === index
      ),
    specialPriceRules: (currentPricingConfig.specialPriceRules ?? [])
      .map(normalizeSpecialRule)
      .filter((rule) => rule.unitPrice > 0)
      .filter(
        (rule, index, collection) =>
          collection.findIndex(
            (entry) => entry.id === rule.id || entry.label.toLowerCase() === rule.label.toLowerCase()
          ) === index
      ),
  } satisfies ProductPricingConfig;

  if (normalizedConfig.basePrice <= 0) {
    return null;
  }

  return normalizedConfig;
}

export function parseProductPricingConfig(rawValue?: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as ProductPricingConfig | LegacyProductPricingConfigInput;
    return normalizeProductPricingConfig(parsed);
  } catch {
    return null;
  }
}

export function stringifyProductPricingConfig(pricingConfig?: ProductPricingConfig | null) {
  const normalized = normalizeProductPricingConfig(pricingConfig);
  return normalized ? JSON.stringify(normalized) : null;
}

export function getReferenceUnitPrice(fallbackPrice: number, pricingConfig?: ProductPricingConfig | null) {
  const normalized = normalizeProductPricingConfig(pricingConfig);
  if (!normalized) return toMoney(fallbackPrice);

  const pricePool = [
    normalized.basePrice,
    ...normalized.quantityScales.map((scale) => scale.unitPrice),
  ];
  const validPrices = pricePool.filter((price) => price > 0);

  return validPrices.length > 0 ? Math.min(...validPrices) : toMoney(fallbackPrice);
}

export function resolveProductPricingQuote({
  fallbackPrice,
  pricingConfig,
  qty,
  specialRuleId,
  manualUnitPrice,
  canOverrideMinimum = false,
}: ProductPricingQuoteInput):
  | { ok: true; quote: ProductPricingQuote }
  | { ok: false; message: string } {
  const normalizedQty = Math.max(1, Math.round(Number(qty || 1)));
  const normalizedFallbackPrice = toMoney(fallbackPrice);
  const normalizedConfig = normalizeProductPricingConfig(pricingConfig);

  if (!normalizedConfig) {
    return {
      ok: true,
      quote: {
        unitPrice: normalizedFallbackPrice,
        subtotal: normalizedFallbackPrice * normalizedQty,
        minimumPrice: 0,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "FIXED_PRICE",
        sourceLabel: "Precio fijo del producto",
        priceBeforeMinimum: normalizedFallbackPrice,
        minimumApplied: false,
      },
    };
  }

  const minimumPrice = normalizedConfig.minimumPrice;

  if (manualUnitPrice !== null && manualUnitPrice !== undefined) {
    const requestedUnitPrice = toMoney(manualUnitPrice);
    if (requestedUnitPrice < minimumPrice && !canOverrideMinimum) {
      return {
        ok: false,
        message: `El precio manual no puede quedar por debajo del minimo permitido de ${minimumPrice}.`,
      };
    }

    return {
      ok: true,
      quote: {
        unitPrice: requestedUnitPrice,
        subtotal: requestedUnitPrice * normalizedQty,
        minimumPrice,
        specialRuleId: null,
        specialRuleLabel: null,
        source: "MANUAL_OVERRIDE",
        sourceLabel: "Ajuste manual autorizado",
        priceBeforeMinimum: requestedUnitPrice,
        minimumApplied: false,
      },
    };
  }

  const specialRule = pickSpecialRule(normalizedConfig, specialRuleId);
  if (specialRuleId && !specialRule) {
    return {
      ok: false,
      message: "La tarifa especial seleccionada ya no esta disponible para este producto.",
    };
  }

  const quantityScale = pickQuantityScalePrice(normalizedConfig, normalizedQty);
  const baseResolvedPrice = quantityScale?.unitPrice ?? normalizedConfig.basePrice;
  const computedUnitPrice = specialRule?.unitPrice ?? baseResolvedPrice;
  const enforcedUnitPrice =
    computedUnitPrice < minimumPrice && !canOverrideMinimum ? minimumPrice : computedUnitPrice;

  return {
    ok: true,
    quote: {
      unitPrice: enforcedUnitPrice,
      subtotal: enforcedUnitPrice * normalizedQty,
      minimumPrice,
      specialRuleId: specialRule?.id ?? null,
      specialRuleLabel: specialRule?.label ?? null,
      source: specialRule ? "SPECIAL_RULE" : quantityScale ? "QUANTITY_SCALE" : "FIXED_PRICE",
      sourceLabel: specialRule
        ? specialRule.label
        : quantityScale
          ? `Escala desde ${quantityScale.minQty} unidades`
          : "Precio base",
      priceBeforeMinimum: computedUnitPrice,
      minimumApplied: enforcedUnitPrice !== computedUnitPrice,
    },
  };
}
