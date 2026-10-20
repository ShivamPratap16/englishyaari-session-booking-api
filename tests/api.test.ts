import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

const HOUR = 60 * 60 * 1000;
// 2030-01-15 00:00 IST
const DAY_START_IST = Date.parse('2030-01-15T00:00:00+05:30');
const at = (hours: number) => new Date(DAY_START_IST + hours * HOUR).toISOString();

async function createUser(email = 'user@example.com') {
  const res = await request(app).post('/users').send({ fullName: 'Test User', email, phone: '+919876543210' });
  return res.body.data._id as string;
}

async function createTeacher(email = 'teacher@example.com') {
  const res = await request(app)
    .post('/teachers')
    .send({ fullName: 'Test Teacher', email, specialization: 'Spoken English', experience: 5 });
  return res.body.data._id as string;
}

async function createSession(teacherId: string, startHour: number, endHour: number) {
  const res = await request(app)
    .post('/sessions')
    .send({ teacherId, startTime: at(startHour), endTime: at(endHour) });
  return res.body.data._id as string;
}

describe('POST /users', () => {
  it('creates a user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ fullName: 'Shivam', email: 'Shivam@Example.com', phone: '+919876543210' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ fullName: 'Shivam', email: 'shivam@example.com' });
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('rejects duplicate email with 409 (case-insensitive)', async () => {
    await createUser('dup@example.com');
    const res = await request(app)
      .post('/users')
      .send({ fullName: 'Other', email: 'DUP@example.com', phone: '+919876543211' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with field details on invalid body', async () => {
    const res = await request(app).post('/users').send({ fullName: 'A', email: 'nope' });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'phone']));
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app).post('/users').set('Content-Type', 'application/json').send('{"bad"');
    expect(res.status).toBe(400);
  });
});

describe('POST /sessions', () => {
  it('creates an AVAILABLE session by default', async () => {
    const teacherId = await createTeacher();
    const res = await request(app).post('/sessions').send({ teacherId, startTime: at(10), endTime: at(11) });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ teacherId, status: 'AVAILABLE', userId: null, completedAt: null });
  });

  it('returns 404 when teacher does not exist', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ teacherId: '64b7f0c2a1b2c3d4e5f60718', startTime: at(10), endTime: at(11) });
    expect(res.status).toBe(404);
  });

  it('returns 400 when endTime <= startTime', async () => {
    const teacherId = await createTeacher();
    const res = await request(app).post('/sessions').send({ teacherId, startTime: at(11), endTime: at(10) });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ field: 'endTime' });
  });

  it('returns 400 for invalid teacherId', async () => {
    const res = await request(app).post('/sessions').send({ teacherId: 'abc', startTime: at(10), endTime: at(11) });
    expect(res.status).toBe(400);
  });

  it('returns 409 for overlapping session of the same teacher', async () => {
    const teacherId = await createTeacher();
    await createSession(teacherId, 10, 11);
    const res = await request(app).post('/sessions').send({ teacherId, startTime: at(10.5), endTime: at(11.5) });
    expect(res.status).toBe(409);
  });
});

describe('GET /sessions/available', () => {
  it('returns only AVAILABLE sessions on the given day, sorted, with teacher details', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    await createSession(teacherId, 15, 16);
    await createSession(teacherId, 9, 10);
    const bookedId = await createSession(teacherId, 12, 13);
    await createSession(teacherId, 24 + 9, 24 + 10); // next day
    await createSession(teacherId, -2, -1); // previous day
    await request(app).post(`/sessions/${bookedId}/book`).send({ userId });

    // Any instant within the day works, in ms or seconds.
    const ts = DAY_START_IST + 13 * HOUR;
    const res = await request(app).get(`/sessions/available?dateTimestamp=${ts}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.sessions.map((s: { startTime: string }) => s.startTime)).toEqual([at(9), at(15)]);
    expect(res.body.data.sessions[0].teacher).toMatchObject({ fullName: 'Test Teacher' });
    expect(res.body.data.sessions[0].durationMinutes).toBe(60);

    const resSeconds = await request(app).get(`/sessions/available?dateTimestamp=${Math.floor(ts / 1000)}`);
    expect(resSeconds.body.data.count).toBe(2);
  });

  it('returns 400 when dateTimestamp is missing or invalid', async () => {
    expect((await request(app).get('/sessions/available')).status).toBe(400);
    expect((await request(app).get('/sessions/available?dateTimestamp=abc')).status).toBe(400);
  });
});

describe('POST /sessions/:id/book', () => {
  it('books an AVAILABLE session', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);

    const res = await request(app).post(`/sessions/${sessionId}/book`).send({ userId });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'BOOKED', userId });
  });

  it('returns 409 when session is already booked', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);
    await request(app).post(`/sessions/${sessionId}/book`).send({ userId });

    const res = await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    expect(res.status).toBe(409);
  });

  it('allows exactly one booking under concurrent requests', async () => {
    const teacherId = await createTeacher();
    const sessionId = await createSession(teacherId, 10, 11);
    const userIds = await Promise.all([1, 2, 3, 4, 5].map((n) => createUser(`u${n}@example.com`)));

    const results = await Promise.all(
      userIds.map((userId) => request(app).post(`/sessions/${sessionId}/book`).send({ userId })),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('returns 409 when session is COMPLETED', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);
    await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    await request(app).patch(`/sessions/${sessionId}/complete`);

    const res = await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown user or session', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);
    const missing = '64b7f0c2a1b2c3d4e5f60718';

    expect((await request(app).post(`/sessions/${sessionId}/book`).send({ userId: missing })).status).toBe(404);
    expect((await request(app).post(`/sessions/${missing}/book`).send({ userId })).status).toBe(404);
  });

  it('returns 400 for missing userId or invalid session id', async () => {
    const userId = await createUser();
    expect((await request(app).post('/sessions/64b7f0c2a1b2c3d4e5f60718/book').send({})).status).toBe(400);
    expect((await request(app).post('/sessions/not-an-id/book').send({ userId })).status).toBe(400);
  });
});

describe('PATCH /sessions/:id/complete', () => {
  it('completes a BOOKED session and sets completedAt', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);
    await request(app).post(`/sessions/${sessionId}/book`).send({ userId });

    const res = await request(app).patch(`/sessions/${sessionId}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(new Date(res.body.data.completedAt).getTime()).not.toBeNaN();
  });

  it('returns 409 for AVAILABLE or already COMPLETED sessions', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const sessionId = await createSession(teacherId, 10, 11);

    expect((await request(app).patch(`/sessions/${sessionId}/complete`)).status).toBe(409);

    await request(app).post(`/sessions/${sessionId}/book`).send({ userId });
    await request(app).patch(`/sessions/${sessionId}/complete`);
    expect((await request(app).patch(`/sessions/${sessionId}/complete`)).status).toBe(409);
  });

  it('returns 404 for unknown session', async () => {
    const res = await request(app).patch('/sessions/64b7f0c2a1b2c3d4e5f60718/complete');
    expect(res.status).toBe(404);
  });
});

describe('GET /users/:id/sessions', () => {
  it('splits sessions into upcoming and completed', async () => {
    const teacherId = await createTeacher();
    const userId = await createUser();
    const otherUserId = await createUser('other@example.com');

    const s1 = await createSession(teacherId, 14, 15);
    const s2 = await createSession(teacherId, 10, 11);
    const s3 = await createSession(teacherId, 8, 9);
    const otherUsers = await createSession(teacherId, 16, 17);
    await createSession(teacherId, 18, 19); // never booked

    for (const id of [s1, s2, s3]) {
      await request(app).post(`/sessions/${id}/book`).send({ userId });
    }
    await request(app).post(`/sessions/${otherUsers}/book`).send({ userId: otherUserId });
    await request(app).patch(`/sessions/${s3}/complete`);

    const res = await request(app).get(`/users/${userId}/sessions`);

    expect(res.status).toBe(200);
    const { user, upcomingSessions, completedSessions, summary } = res.body.data;
    expect(user._id).toBe(userId);
    expect(upcomingSessions.map((s: { _id: string }) => s._id)).toEqual([s2, s1]); // sorted by startTime
    expect(completedSessions.map((s: { _id: string }) => s._id)).toEqual([s3]);
    expect(completedSessions[0].teacher.fullName).toBe('Test Teacher');
    expect(summary).toEqual({ upcoming: 2, completed: 1 });
  });

  it('returns empty lists for a user with no sessions', async () => {
    const userId = await createUser();
    const res = await request(app).get(`/users/${userId}/sessions`);

    expect(res.status).toBe(200);
    expect(res.body.data.upcomingSessions).toEqual([]);
    expect(res.body.data.completedSessions).toEqual([]);
  });

  it('returns 404 for unknown user and 400 for invalid id', async () => {
    expect((await request(app).get('/users/64b7f0c2a1b2c3d4e5f60718/sessions')).status).toBe(404);
    expect((await request(app).get('/users/xyz/sessions')).status).toBe(400);
  });
});

describe('Unknown routes', () => {
  it('returns 404 JSON', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
