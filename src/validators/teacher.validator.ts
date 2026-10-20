import { z } from 'zod';

export const createTeacherSchema = z.object({
  fullName: z.string().trim().min(2, 'fullName must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('email must be a valid email address'),
  specialization: z.string().trim().min(2).max(100),
  experience: z.number().int().min(0, 'experience cannot be negative').max(60),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
