import { Types } from 'mongoose';
import { env } from '../config/env';
import { SessionModel, SessionStatus } from '../models/session.model';
import { TeacherModel } from '../models/teacher.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { getDayRange, timestampToDate } from '../utils/date';
import { CreateSessionInput } from '../validators/session.validator';

/** API 2 */
export async function createSession({ teacherId, startTime, endTime }: CreateSessionInput) {
  const teacherExists = await TeacherModel.exists({ _id: teacherId });
  if (!teacherExists) {
    throw AppError.notFound('Teacher not found');
  }

  // A teacher cannot run two sessions at the same time.
  const overlapping = await SessionModel.exists({
    teacherId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  if (overlapping) {
    throw AppError.conflict('Teacher already has a session overlapping this time slot');
  }

  const session = await SessionModel.create({ teacherId, startTime, endTime });
  return session.toObject();
}

/** API 3: AVAILABLE sessions whose startTime falls on the given calendar day (APP_TIMEZONE). */
export async function getAvailableSessions(dateTimestamp: number) {
  const { start, end } = getDayRange(timestampToDate(dateTimestamp), env.APP_TIMEZONE);

  const sessions = await SessionModel.aggregate([
    {
      $match: {
        status: SessionStatus.AVAILABLE,
        startTime: { $gte: start, $lt: end },
      },
    },
    { $sort: { startTime: 1 } },
    {
      $lookup: {
        from: TeacherModel.collection.name,
        localField: 'teacherId',
        foreignField: '_id',
        as: 'teacher',
        pipeline: [{ $project: { fullName: 1, email: 1, specialization: 1, experience: 1 } }],
      },
    },
    // Drops sessions whose teacher no longer exists.
    { $unwind: '$teacher' },
    {
      $project: {
        _id: 1,
        status: 1,
        startTime: 1,
        endTime: 1,
        durationMinutes: { $dateDiff: { startDate: '$startTime', endDate: '$endTime', unit: 'minute' } },
        teacher: 1,
      },
    },
  ]);

  return {
    date: { from: start, to: end, timezone: env.APP_TIMEZONE },
    count: sessions.length,
    sessions,
  };
}

/** API 4 */
export async function bookSession(sessionId: string, userId: string) {
  const userExists = await UserModel.exists({ _id: userId });
  if (!userExists) {
    throw AppError.notFound('User not found');
  }

  // Atomic check-and-set: only one concurrent request can flip AVAILABLE -> BOOKED.
  const booked = await SessionModel.findOneAndUpdate(
    { _id: sessionId, status: SessionStatus.AVAILABLE },
    { $set: { status: SessionStatus.BOOKED, userId: new Types.ObjectId(userId) } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (booked) {
    return booked;
  }

  const session = await SessionModel.findById(sessionId).select('status').lean();
  if (!session) {
    throw AppError.notFound('Session not found');
  }
  if (session.status === SessionStatus.BOOKED) {
    throw AppError.conflict('Session is already booked');
  }
  throw AppError.conflict(`Only AVAILABLE sessions can be booked (current status: ${session.status})`);
}

/** API 5 */
export async function completeSession(sessionId: string) {
  const completed = await SessionModel.findOneAndUpdate(
    { _id: sessionId, status: SessionStatus.BOOKED },
    { $set: { status: SessionStatus.COMPLETED, completedAt: new Date() } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (completed) {
    return completed;
  }

  const session = await SessionModel.findById(sessionId).select('status').lean();
  if (!session) {
    throw AppError.notFound('Session not found');
  }
  throw AppError.conflict(`Only BOOKED sessions can be marked as completed (current status: ${session.status})`);
}
