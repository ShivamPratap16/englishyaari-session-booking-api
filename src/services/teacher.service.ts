import { TeacherModel } from '../models/teacher.model';
import { AppError } from '../utils/AppError';
import { CreateTeacherInput } from '../validators/teacher.validator';

export async function createTeacher(input: CreateTeacherInput) {
  const existing = await TeacherModel.exists({ email: input.email });
  if (existing) {
    throw AppError.conflict('A teacher with this email already exists');
  }

  const teacher = await TeacherModel.create(input);
  return teacher.toObject();
}

export async function listTeachers() {
  return TeacherModel.find().sort({ createdAt: -1 }).lean();
}
