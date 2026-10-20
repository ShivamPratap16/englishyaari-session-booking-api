import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { CreateUserInput } from '../validators/user.validator';

export async function createUser(_req: Request, res: Response) {
  const user = await userService.createUser(res.locals.body as CreateUserInput);
  res.status(201).json({ success: true, data: user });
}

export async function getUserSessions(_req: Request, res: Response) {
  const { id } = res.locals.params as { id: string };
  const data = await userService.getUserSessions(id);
  res.status(200).json({ success: true, data });
}
