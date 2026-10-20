import { Request, Response } from 'express';
import * as teacherService from '../services/teacher.service';
import { CreateTeacherInput } from '../validators/teacher.validator';

export async function createTeacher(_req: Request, res: Response) {
  const teacher = await teacherService.createTeacher(res.locals.body as CreateTeacherInput);
  res.status(201).json({ success: true, data: teacher });
}

export async function listTeachers(_req: Request, res: Response) {
  const teachers = await teacherService.listTeachers();
  res.status(200).json({ success: true, data: teachers });
}
