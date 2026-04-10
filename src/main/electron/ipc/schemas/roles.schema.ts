import { z } from "zod";

import { roleSchema } from "./auth.schema";

export const createRoleProfileInputSchema = z.object({
  name: z.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: z.string().trim().max(240).optional().nullable(),
  baseRole: roleSchema.default("EMPLOYEE"),
  permissionKeys: z.array(z.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: z.boolean().optional().default(true),
});

export type CreateRoleProfileInput = z.infer<typeof createRoleProfileInputSchema>;

export const updateRoleProfileInputSchema = z.object({
  id: z.string().uuid("ID de rol invalido"),
  name: z.string().trim().min(3, "Minimo 3 caracteres").max(80, "Maximo 80 caracteres"),
  description: z.string().trim().max(240).optional().nullable(),
  permissionKeys: z.array(z.string().trim().min(1)).min(1, "Debes seleccionar al menos un permiso"),
  isActive: z.boolean().optional().default(true),
});

export type UpdateRoleProfileInput = z.infer<typeof updateRoleProfileInputSchema>;
