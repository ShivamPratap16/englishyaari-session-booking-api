import { Types } from 'mongoose';
import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value), {
    message: 'Must be a valid ObjectId',
  });

export const idParamSchema = z.object({ id: objectIdSchema });

/** Accepts an ISO date string or a numeric timestamp (ms). */
export const dateInputSchema = z.union([z.string().trim().min(1), z.number()]).transform((value, ctx) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Must be a valid date (ISO string or timestamp in ms)' });
    return z.NEVER;
  }
  return date;
});
