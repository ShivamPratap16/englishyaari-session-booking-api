import { Request, Response } from 'express';
import * as sessionService from '../services/session.service';
import { CreateSessionInput } from '../validators/session.validator';

export async function createSession(_req: Request, res: Response) {
  const session = await sessionService.createSession(res.locals.body as CreateSessionInput);
  res.status(201).json({ success: true, data: session });
}

export async function getAvailableSessions(_req: Request, res: Response) {
  const { dateTimestamp } = res.locals.query as { dateTimestamp: number };
  const data = await sessionService.getAvailableSessions(dateTimestamp);
  res.status(200).json({ success: true, data });
}

export async function bookSession(_req: Request, res: Response) {
  const { id } = res.locals.params as { id: string };
  const { userId } = res.locals.body as { userId: string };
  const session = await sessionService.bookSession(id, userId);
  res.status(200).json({ success: true, message: 'Session booked successfully', data: session });
}

export async function completeSession(_req: Request, res: Response) {
  const { id } = res.locals.params as { id: string };
  const session = await sessionService.completeSession(id);
  res.status(200).json({ success: true, message: 'Session marked as completed', data: session });
}
