import { z } from "zod";

// ─── Crear producto ───────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z
    .string({ message: "El nombre es obligatorio" })
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(120, "Máximo 120 caracteres"),

  barcode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .nullable(),

  sku: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .nullable(),

  price: z
    .number({ message: "El precio es obligatorio" })
    .positive("El precio debe ser mayor a 0"),

  cost: z
    .number()
    .min(0, "El costo no puede ser negativo")
    .optional()
    .default(0),

  marginPercent: z
    .number()
    .min(0, "La ganancia no puede ser negativa")
    .optional()
    .default(0),

  hasTax: z.boolean().optional().default(false),

  taxRate: z
    .number()
    .min(0)
    .max(1, "taxRate debe ser entre 0 y 1 (ej: 0.19)")
    .optional()
    .default(0),

  stock: z
    .number()
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo")
    .optional()
    .default(0),

  categoryId: z.string().uuid().optional().nullable(),

  subcategoryId: z.string().uuid().optional().nullable(),

  isActive: z.boolean().optional().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ─── Editar producto ──────────────────────────────────────────────────────────

export const updateProductSchema = z.object({
  id: z.string().uuid("ID de producto inválido"),

  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(120)
    .optional(),

  barcode: z.string().trim().min(1).max(50).optional().nullable(),

  sku: z.string().trim().min(1).max(50).optional().nullable(),

  price: z.number().positive("El precio debe ser mayor a 0").optional(),

  cost: z.number().min(0).optional(),

  marginPercent: z.number().min(0).optional(),

  hasTax: z.boolean().optional(),

  taxRate: z.number().min(0).max(1).optional(),

  stock: z.number().int().min(0).optional(),

  categoryId: z.string().uuid().optional().nullable(),

  subcategoryId: z.string().uuid().optional().nullable(),

  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── Ajuste de stock ──────────────────────────────────────────────────────────

export const adjustStockSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  delta: z
    .number()
    .int("El ajuste debe ser un número entero")
    .refine((n) => n !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().max(200).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// ─── Buscar por barcode ───────────────────────────────────────────────────────

export const findByBarcodeSchema = z.object({
  barcode: z.string().trim().min(1, "Barcode no puede estar vacío"),
});

export type FindByBarcodeInput = z.infer<typeof findByBarcodeSchema>;
