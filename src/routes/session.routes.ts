import { Router } from 'express';
import * as sessionController from '../controllers/session.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common';
import {
  availableSessionsQuerySchema,
  bookSessionSchema,
  createSessionSchema,
} from '../validators/session.validator';

const router = Router();

router.post('/', validate(createSessionSchema), sessionController.createSession);
// Must be registered before '/:id' style routes.
router.get('/available', validate(availableSessionsQuerySchema, 'query'), sessionController.getAvailableSessions);
router.post(
  '/:id/book',
  validate(idParamSchema, 'params'),
  validate(bookSessionSchema),
  sessionController.bookSession,
);
router.patch('/:id/complete', validate(idParamSchema, 'params'), sessionController.completeSession);

export default router;
