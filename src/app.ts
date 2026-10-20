import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import sessionRoutes from './routes/session.routes';
import teacherRoutes from './routes/teacher.routes';
import userRoutes from './routes/user.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' },
    });
  });

  app.use('/users', userRoutes);
  app.use('/teachers', teacherRoutes);
  app.use('/sessions', sessionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
