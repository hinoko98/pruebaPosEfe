import { z } from "zod";

export const productUnitMeasureSchema = z.enum([
  "UNIDAD",
  "PAR",
  "METRO",
  "CENTIMETRO",
  "CAJA",
  "PAQUETE",
  "DOCENA",
  "ROLLO",
  "BOLSA",
  "BOTELLA",
  "FRASCO",
  "LIBRA",
  "KILO",
  "LITRO",
]);

const allowedTaxRates = [0, 0.05, 0.19] as const;

const productPricingScaleSchema = z.object({
  minQty: z.number().int().min(1, "La cantidad minima debe ser mayor a 0"),
  unitPrice: z.number().min(0, "El precio unitario no puede ser negativo"),
});

const productPricingSpecialRuleSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  unitPrice: z.number().min(0, "El precio unitario no puede ser negativo"),
});

export const productPricingConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    basePrice: z.number().positive("El precio base debe ser mayor a 0").optional().default(0),
    minimumPrice: z.number().min(0, "El precio minimo no puede ser negativo").optional().default(0),
    quantityScales: z.array(productPricingScaleSchema).optional().default([]),
    specialPriceRules: z.array(productPricingSpecialRuleSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (!data.enabled) return;

    if (data.basePrice <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes configurar un precio base valido",
        path: ["basePrice"],
      });
    }

    const seenScaleQuantities = new Set<number>();
    for (const [scaleIndex, scale] of data.quantityScales.entries()) {
      if (scale.unitPrice < data.minimumPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La escala no puede quedar por debajo del precio minimo permitido",
          path: ["quantityScales", scaleIndex, "unitPrice"],
        });
      }

      if (seenScaleQuantities.has(scale.minQty)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No repitas la misma cantidad minima en las escalas",
          path: ["quantityScales", scaleIndex, "minQty"],
        });
      }

      seenScaleQuantities.add(scale.minQty);
    }

    const seenRuleIds = new Set<string>();
    for (const [ruleIndex, rule] of data.specialPriceRules.entries()) {
      if (rule.unitPrice < data.minimumPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La tarifa especial no puede quedar por debajo del precio minimo permitido",
          path: ["specialPriceRules", ruleIndex, "unitPrice"],
        });
      }

      if (seenRuleIds.has(rule.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cada tarifa especial debe tener un identificador unico",
          path: ["specialPriceRules", ruleIndex, "id"],
        });
      }

      seenRuleIds.add(rule.id);
    }
  });

function validateAllowedTaxRate(taxRate: number | undefined, ctx: z.RefinementCtx) {
  if (taxRate === undefined) return;

  if (!allowedTaxRates.includes(taxRate as (typeof allowedTaxRates)[number])) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El IVA permitido es: no aplica, 0%, 5% o 19%",
      path: ["taxRate"],
    });
  }
}

export const createProductSchema = z
  .object({
    name: z
      .string({ message: "El nombre es obligatorio" })
      .trim()
      .min(2, "Minimo 2 caracteres")
      .max(120, "Maximo 120 caracteres"),

    barcode: z.string().trim().min(1).max(50).optional().nullable(),

    sku: z.string().trim().min(1).max(50).optional().nullable(),

    unitMeasure: productUnitMeasureSchema.optional().default("UNIDAD"),

    price: z
      .number({ message: "El precio es obligatorio" })
      .positive("El precio debe ser mayor a 0"),

    cost: z.number().min(0, "El costo no puede ser negativo").optional().default(0),

    marginPercent: z.number().min(0, "La ganancia no puede ser negativa").optional().default(0),

    hasTax: z.boolean().optional().default(false),

    taxRate: z.number().min(0).max(1).optional().default(0),

    stock: z
      .number()
      .int("El stock debe ser un numero entero")
      .min(0, "El stock no puede ser negativo")
      .optional()
      .default(0),

    categoryId: z.string().uuid().optional().nullable(),

    subcategoryId: z.string().uuid().optional().nullable(),

    isActive: z.boolean().optional().default(true),

    pricingConfig: productPricingConfigSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    validateAllowedTaxRate(data.taxRate, ctx);
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    id: z.string().uuid("ID de producto invalido"),

    name: z.string().trim().min(2, "Minimo 2 caracteres").max(120).optional(),

    barcode: z.string().trim().min(1).max(50).optional().nullable(),

    sku: z.string().trim().min(1).max(50).optional().nullable(),

    unitMeasure: productUnitMeasureSchema.optional(),

    price: z.number().positive("El precio debe ser mayor a 0").optional(),

    cost: z.number().min(0).optional(),

    marginPercent: z.number().min(0).optional(),

    hasTax: z.boolean().optional(),

    taxRate: z.number().min(0).max(1).optional(),

    stock: z.number().int().min(0).optional(),

    categoryId: z.string().uuid().optional().nullable(),

    subcategoryId: z.string().uuid().optional().nullable(),

    isActive: z.boolean().optional(),

    pricingConfig: productPricingConfigSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    validateAllowedTaxRate(data.taxRate, ctx);
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().uuid("ID de producto invalido"),
  delta: z
    .number()
    .int("El ajuste debe ser un numero entero")
    .refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().max(200).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const findByBarcodeSchema = z.object({
  barcode: z.string().trim().min(1, "Barcode no puede estar vacio"),
});

export type FindByBarcodeInput = z.infer<typeof findByBarcodeSchema>;
