import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Tests run against a dedicated database that is wiped after every test.
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/englishyaari_test';

// Must be set before src/config/env.ts is imported by the test files.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = TEST_MONGODB_URI;
process.env.APP_TIMEZONE = 'Asia/Kolkata';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.connection.syncIndexes();
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
