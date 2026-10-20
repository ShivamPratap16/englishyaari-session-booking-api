import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const SessionStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  COMPLETED: 'COMPLETED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

const sessionSchema = new Schema(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.AVAILABLE,
      required: true,
    },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Available-sessions-by-date lookup (API 3).
sessionSchema.index({ status: 1, startTime: 1 });
// User session history (API 6).
sessionSchema.index({ userId: 1, status: 1, startTime: 1 });
// Teacher overlap check on create.
sessionSchema.index({ teacherId: 1, startTime: 1, endTime: 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<Session>;

export const SessionModel = model('Session', sessionSchema);
