import { z } from 'zod';
import { dateInputSchema, objectIdSchema } from './common';

export const createSessionSchema = z
  .object({
    teacherId: objectIdSchema,
    startTime: dateInputSchema,
    endTime: dateInputSchema,
  })
  .refine((data) => data.endTime.getTime() > data.startTime.getTime(), {
    message: 'endTime must be greater than startTime',
    path: ['endTime'],
  });

export const availableSessionsQuerySchema = z.object({
  dateTimestamp: z.coerce
    .number({ message: 'dateTimestamp must be a number' })
    .int('dateTimestamp must be an integer')
    .positive('dateTimestamp must be a positive Unix timestamp'),
});

export const bookSessionSchema = z.object({
  userId: objectIdSchema,
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
