export type CustomerSegment = "GENERAL" | "DOCENTE";

export type ProductPricingScale = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingCustomerRule = {
  customerSegment: CustomerSegment;
  unitPrice: number;
};

export type ProductPricingSheetType = {
  id: string;
  name: string;
  basePrice: number;
  minimumPrice: number | null;
  quantityScales: ProductPricingScale[];
  customerSegmentRules: ProductPricingCustomerRule[];
};

export type ProductPricingConfig = {
  enabled: boolean;
  minimumPrice: number;
  sheetTypes: ProductPricingSheetType[];
};

export type ProductPricingScaleInput = {
  minQty: number;
  unitPrice: number;
};

export type ProductPricingCustomerRuleInput = {
  customerSegment: CustomerSegment;
  unitPrice: number;
};

export type ProductPricingSheetTypeInput = {
  id: string;
  name: string;
  basePrice: number;
  minimumPrice?: number | null;
  quantityScales?: ProductPricingScaleInput[];
  customerSegmentRules?: ProductPricingCustomerRuleInput[];
};

export type ProductPricingConfigInput = {
  enabled?: boolean;
  minimumPrice?: number;
  sheetTypes?: ProductPricingSheetTypeInput[];
};

export type ProductPricingQuote = {
  unitPrice: number;
  subtotal: number;
  minimumPrice: number;
  sheetTypeId: string | null;
  sheetTypeName: string | null;
  source: "FIXED_PRICE" | "QUANTITY_SCALE" | "CUSTOMER_RULE" | "MANUAL_OVERRIDE";
  sourceLabel: string;
  priceBeforeMinimum: number;
  minimumApplied: boolean;
};

export type ProductPricingQuoteInput = {
  fallbackPrice: number;
  pricingConfig?: ProductPricingConfig | null;
  qty: number;
  sheetTypeId?: string | null;
  customerSegment?: CustomerSegment;
  manualUnitPrice?: number | null;
  canOverrideMinimum?: boolean;
};

function toMoney(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeSheetName(name: string | null | undefined) {
  const normalized = String(name || "").trim();
  return normalized || "Hoja";
}

function normalizeScale(scale: ProductPricingScale) {
  return {
    minQty: Math.max(1, Math.round(Number(scale.minQty || 0))),
    unitPrice: toMoney(scale.unitPrice),
  };
}

function normalizeCustomerRule(rule: ProductPricingCustomerRule) {
  return {
    customerSegment: rule.customerSegment === "DOCENTE" ? "DOCENTE" : "GENERAL",
    unitPrice: toMoney(rule.unitPrice),
  } as ProductPricingCustomerRule;
}

function pickQuantityScalePrice(sheetType: ProductPricingSheetType, qty: number) {
  const eligibleRules = [...sheetType.quantityScales]
    .map(normalizeScale)
    .filter((scale) => scale.minQty <= qty && scale.unitPrice > 0)
    .sort((left, right) => right.minQty - left.minQty);

  return eligibleRules[0] ?? null;
}

function pickCustomerRule(sheetType: ProductPricingSheetType, customerSegment: CustomerSegment) {
  if (customerSegment === "GENERAL") return null;
  return (
    sheetType.customerSegmentRules
      .map(normalizeCustomerRule)
      .find((rule) => rule.customerSegment === customerSegment && rule.unitPrice > 0) ?? null
  );
}

export function normalizeProductPricingConfig(
  pricingConfig?: ProductPricingConfigInput | ProductPricingConfig | null
): ProductPricingConfig | null {
  if (!pricingConfig?.enabled) return null;

  const normalizedSheetTypes = (pricingConfig.sheetTypes ?? [])
    .map((sheetType) => ({
      id: String(sheetType.id || "").trim() || crypto.randomUUID(),
      name: normalizeSheetName(sheetType.name),
      basePrice: toMoney(sheetType.basePrice),
      minimumPrice:
        sheetType.minimumPrice === null || sheetType.minimumPrice === undefined
          ? null
          : toMoney(sheetType.minimumPrice),
      quantityScales: (sheetType.quantityScales ?? [])
        .map(normalizeScale)
        .filter((scale) => scale.unitPrice > 0)
        .sort((left, right) => left.minQty - right.minQty)
        .filter((scale, index, collection) => collection.findIndex((entry) => entry.minQty === scale.minQty) === index),
      customerSegmentRules: (sheetType.customerSegmentRules ?? [])
        .map(normalizeCustomerRule)
        .filter((rule) => rule.unitPrice > 0)
        .filter(
          (rule, index, collection) =>
            collection.findIndex((entry) => entry.customerSegment === rule.customerSegment) === index
        ),
    }))
    .filter((sheetType) => sheetType.basePrice > 0);

  if (normalizedSheetTypes.length === 0) return null;

  return {
    enabled: true,
    minimumPrice: toMoney(pricingConfig.minimumPrice),
    sheetTypes: normalizedSheetTypes,
  };
}

export function parseProductPricingConfig(rawValue?: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as ProductPricingConfig;
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

  const pricePool = normalized.sheetTypes.flatMap((sheetType) => [
    sheetType.basePrice,
    ...sheetType.quantityScales.map((scale) => scale.unitPrice),
  ]);
  const validPrices = pricePool.filter((price) => price > 0);

  return validPrices.length > 0 ? Math.min(...validPrices) : toMoney(fallbackPrice);
}

export function resolveProductPricingQuote({
  fallbackPrice,
  pricingConfig,
  qty,
  sheetTypeId,
  customerSegment = "GENERAL",
  manualUnitPrice,
  canOverrideMinimum = false,
}: ProductPricingQuoteInput):
  | { ok: true; quote: ProductPricingQuote }
  | { ok: false; message: string; requiresSheetSelection?: boolean } {
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
        sheetTypeId: null,
        sheetTypeName: null,
        source: "FIXED_PRICE",
        sourceLabel: "Precio fijo del producto",
        priceBeforeMinimum: normalizedFallbackPrice,
        minimumApplied: false,
      },
    };
  }

  const selectedSheetType =
    normalizedConfig.sheetTypes.find((sheetType) => sheetType.id === sheetTypeId) ??
    (normalizedConfig.sheetTypes.length === 1 ? normalizedConfig.sheetTypes[0] : null);

  if (!selectedSheetType) {
    return {
      ok: false,
      message: "Debes seleccionar el tipo de hoja para este producto.",
      requiresSheetSelection: true,
    };
  }

  const minimumPrice = selectedSheetType.minimumPrice ?? normalizedConfig.minimumPrice;

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
        sheetTypeId: selectedSheetType.id,
        sheetTypeName: selectedSheetType.name,
        source: "MANUAL_OVERRIDE",
        sourceLabel: "Ajuste manual autorizado",
        priceBeforeMinimum: requestedUnitPrice,
        minimumApplied: false,
      },
    };
  }

  const customerRule = pickCustomerRule(selectedSheetType, customerSegment);
  const quantityScale = pickQuantityScalePrice(selectedSheetType, normalizedQty);

  const computedUnitPrice = customerRule?.unitPrice ?? quantityScale?.unitPrice ?? selectedSheetType.basePrice;
  const enforcedUnitPrice =
    computedUnitPrice < minimumPrice && !canOverrideMinimum ? minimumPrice : computedUnitPrice;

  return {
    ok: true,
    quote: {
      unitPrice: enforcedUnitPrice,
      subtotal: enforcedUnitPrice * normalizedQty,
      minimumPrice,
      sheetTypeId: selectedSheetType.id,
      sheetTypeName: selectedSheetType.name,
      source: customerRule ? "CUSTOMER_RULE" : quantityScale ? "QUANTITY_SCALE" : "FIXED_PRICE",
      sourceLabel: customerRule
        ? `Tarifa especial ${customerRule.customerSegment.toLowerCase()}`
        : quantityScale
          ? `Escala desde ${quantityScale.minQty} unidades`
          : "Precio base por hoja",
      priceBeforeMinimum: computedUnitPrice,
      minimumApplied: enforcedUnitPrice !== computedUnitPrice,
    },
  };
}
