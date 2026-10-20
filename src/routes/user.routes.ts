import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { validate } from '../middlewares/validate';
import { idParamSchema } from '../validators/common';
import { createUserSchema } from '../validators/user.validator';

const router = Router();

router.post('/', validate(createUserSchema), userController.createUser);
router.get('/:id/sessions', validate(idParamSchema, 'params'), userController.getUserSessions);

export default router;
