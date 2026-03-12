import { z } from "zod";

export const registerPasswordSchema = z
  .string()
  .min(8, "A senha deve ter no minimo 8 caracteres.")
  .max(128, "A senha deve ter no maximo 128 caracteres.")
  .refine((value) => /[A-Za-z]/.test(value), "A senha deve conter pelo menos uma letra.")
  .refine((value) => /\d/.test(value), "A senha deve conter pelo menos um numero.");

export const registerBodySchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(120).optional(),
  email: z.string().trim().toLowerCase().email("Informe um email valido."),
  password: registerPasswordSchema,
});

export const registerFormSchema = registerBodySchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "As senhas nao conferem.",
});

export type RegisterBodyInput = z.infer<typeof registerBodySchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
