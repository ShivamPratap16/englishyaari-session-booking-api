/**
 * Seeds demo teachers, a user and a few sessions for today/tomorrow.
 * Usage: npm run seed   (clears the users, teachers and sessions collections first)
 */
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { SessionModel } from '../models/session.model';
import { TeacherModel } from '../models/teacher.model';
import { UserModel } from '../models/user.model';
import { getDayRange } from '../utils/date';

const HOUR = 60 * 60 * 1000;

async function seed() {
  await connectDB(env.MONGODB_URI);

  await Promise.all([UserModel.deleteMany({}), TeacherModel.deleteMany({}), SessionModel.deleteMany({})]);

  const [anita, rahul] = await TeacherModel.create([
    { fullName: 'Anita Sharma', email: 'anita@example.com', specialization: 'Spoken English', experience: 6 },
    { fullName: 'Rahul Verma', email: 'rahul@example.com', specialization: 'Business Communication', experience: 4 },
  ]);

  const user = await UserModel.create({ fullName: 'Demo User', email: 'demo@example.com', phone: '+919876543210' });

  const today = getDayRange(new Date(), env.APP_TIMEZONE).start.getTime();
  const tomorrow = today + 24 * HOUR;

  await SessionModel.create([
    { teacherId: anita._id, startTime: new Date(today + 10 * HOUR), endTime: new Date(today + 11 * HOUR) },
    { teacherId: anita._id, startTime: new Date(today + 18 * HOUR), endTime: new Date(today + 19 * HOUR) },
    { teacherId: rahul._id, startTime: new Date(today + 20 * HOUR), endTime: new Date(today + 21 * HOUR) },
    { teacherId: rahul._id, startTime: new Date(tomorrow + 9 * HOUR), endTime: new Date(tomorrow + 10 * HOUR) },
  ]);

  console.log('Seed complete:');
  console.log(`  userId:    ${user._id}`);
  console.log(`  teacherId: ${anita._id} (Anita), ${rahul._id} (Rahul)`);
  console.log(`  today's dateTimestamp: ${today}`);

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
