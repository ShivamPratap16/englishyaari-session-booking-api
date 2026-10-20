import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'fullName must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('email must be a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'phone must be a valid phone number'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
