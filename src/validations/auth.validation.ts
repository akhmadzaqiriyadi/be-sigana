import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Email tidak valid"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    name: z.string().min(3, "Nama minimal 3 karakter"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid"),
    password: z.string().min(1, "Password diperlukan"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Token diperlukan"),
    password: z.string().min(8, "Password minimal 8 karakter"),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Nama minimal 3 karakter").optional(),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email("Email tidak valid"),
    password: z.string().min(6, "Password minimal 6 karakter"),
    name: z.string().min(3, "Nama minimal 3 karakter"),
    role: z.enum(["ADMIN", "RELAWAN", "STAKEHOLDER"]).optional(),
    isVerified: z.boolean().optional(),
  }),
});
