import { Types } from 'mongoose';
import { SessionModel, SessionStatus } from '../models/session.model';
import { TeacherModel } from '../models/teacher.model';
import { UserModel } from '../models/user.model';
import { AppError } from '../utils/AppError';
import { CreateUserInput } from '../validators/user.validator';

export async function createUser(input: CreateUserInput) {
  // Friendly pre-check; the unique index is still the real guarantee
  // (a concurrent duplicate surfaces as E11000 -> 409 in the error handler).
  const existing = await UserModel.exists({ email: input.email });
  if (existing) {
    throw AppError.conflict('A user with this email already exists');
  }

  const user = await UserModel.create(input);
  return user.toObject();
}

/**
 * API 6: all sessions of a user split into upcoming (BOOKED) and completed (COMPLETED).
 *
 * Single aggregation starting from the users collection, so an unknown user
 * yields no document (-> 404) without a separate existence query.
 */
export async function getUserSessions(userId: string) {
  const [result] = await UserModel.aggregate([
    { $match: { _id: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: SessionModel.collection.name,
        localField: '_id',
        foreignField: 'userId',
        as: 'sessions',
        pipeline: [
          { $match: { status: { $in: [SessionStatus.BOOKED, SessionStatus.COMPLETED] } } },
          {
            $lookup: {
              from: TeacherModel.collection.name,
              localField: 'teacherId',
              foreignField: '_id',
              as: 'teacher',
              pipeline: [{ $project: { fullName: 1, email: 1, specialization: 1, experience: 1 } }],
            },
          },
          { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              status: 1,
              startTime: 1,
              endTime: 1,
              completedAt: 1,
              teacher: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        user: { _id: '$_id', fullName: '$fullName', email: '$email', phone: '$phone' },
        upcomingSessions: {
          $sortArray: {
            input: { $filter: { input: '$sessions', cond: { $eq: ['$$this.status', SessionStatus.BOOKED] } } },
            sortBy: { startTime: 1 },
          },
        },
        completedSessions: {
          $sortArray: {
            input: { $filter: { input: '$sessions', cond: { $eq: ['$$this.status', SessionStatus.COMPLETED] } } },
            sortBy: { completedAt: -1 },
          },
        },
      },
    },
    {
      $addFields: {
        summary: {
          upcoming: { $size: '$upcomingSessions' },
          completed: { $size: '$completedSessions' },
        },
      },
    },
  ]);

  if (!result) {
    throw AppError.notFound('User not found');
  }

  return result;
}
