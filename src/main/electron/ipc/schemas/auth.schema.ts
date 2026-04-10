import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "EMPLOYEE"]);

export const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const loginResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string(),
      role: roleSchema,
      name: z.string().optional(),
      roleProfileId: z.string().nullable().optional(),
      roleProfileName: z.string().nullable().optional(),
      permissions: z.array(z.string()).optional(),
    })
    .optional(),
});

export type LoginResult = z.infer<typeof loginResultSchema>;

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/)
  .optional()
  .nullable();

const baseUserProfileSchema = z.object({
  internalCode: z.string().trim().max(30).optional().nullable(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  documentNumber: z.string().trim().regex(/^\d{6,20}$/),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: phoneSchema,
  address: z.string().trim().max(180).optional().nullable(),
  birthDate: birthDateSchema,
  role: roleSchema.optional().default("EMPLOYEE"),
  roleProfileId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const createUserInputSchema = baseUserProfileSchema.extend({
  newPassword: z.string().min(6).max(200),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = baseUserProfileSchema.extend({
  id: z.string().uuid(),
  newPassword: z.string().min(6).max(200).optional().or(z.literal("")),
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const ownProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: phoneSchema,
  birthDate: birthDateSchema,
  role: roleSchema,
});

export type OwnProfile = z.infer<typeof ownProfileSchema>;

export const getOwnProfileResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  profile: ownProfileSchema.optional(),
});

export type GetOwnProfileResult = z.infer<typeof getOwnProfileResultSchema>;

export const updateOwnProfileInputSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).optional().nullable(),
  phone: phoneSchema,
  birthDate: birthDateSchema,
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileInputSchema>;

export const changeOwnPasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
  confirmPassword: z.string().min(6).max(200),
});

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordInputSchema>;
