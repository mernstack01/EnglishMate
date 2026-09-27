import { z } from "zod";
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);
export const passwordSchema = z
  .string()
  .min(4, "Use at least 4 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Use no more than 72 bytes for your password.",
  );
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(80, "Use at most 80 characters."),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});
export const settingsSchema = registerSchema
  .pick({ name: true })
  .extend({ preferredLanguage: z.enum(["UZ", "EN"]) });
export const usersQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const activationSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid user ID."),
  isActive: z.boolean(),
});
