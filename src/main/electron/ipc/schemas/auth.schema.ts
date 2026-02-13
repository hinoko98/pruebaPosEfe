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
    })
    .optional(),
});

export type LoginResult = z.infer<typeof loginResultSchema>;

export const createUserInputSchema = z.object({
  newUsername: z.string().trim().min(3).max(50),
  newPassword: z.string().min(6).max(200),
  adminUsername: z.string().trim().min(1).max(50),
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;
