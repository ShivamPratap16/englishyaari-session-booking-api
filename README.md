# Session Booking API

A REST API where **teachers publish sessions**, **users book them**, and **completed sessions show up in the user's history**.

Built with **Node.js · TypeScript · Express 5 · MongoDB · Mongoose**, with Zod for request validation and Vitest + Supertest for integration tests.

---

## Quick start

**Prerequisites:** Node.js 20+ and MongoDB 5.2+ (local or Atlas). The user-history pipeline uses `$sortArray`, which needs 5.2+.

```bash
git clone https://github.com/ShivamPratap16/englishyaari-session-booking-api.git
cd englishyaari-session-booking-api
npm install
cp .env.example .env          # edit MONGODB_URI if needed
npm run seed                  # optional: demo teachers, a user and today's sessions
npm run dev                   # http://localhost:4000
```

Production build:

```bash
npm run build && npm start
```

### Environment variables

| Variable       | Required | Default        | Description                                                         |
| -------------- | -------- | -------------- | ------------------------------------------------------------------- |
| `MONGODB_URI`  | yes      | –              | MongoDB connection string                                           |
| `PORT`         | no       | `4000`         | HTTP port                                                           |
| `NODE_ENV`     | no       | `development`  | `development` \| `production` \| `test`                             |
| `APP_TIMEZONE` | no       | `Asia/Kolkata` | IANA timezone used to work out which calendar day a timestamp is on |

Environment variables are checked with Zod at startup. If one is missing or invalid, the app exits with a clear error message.

### Scripts

| Script              | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `npm run dev`       | Starts the server with hot reload (tsx watch)                          |
| `npm run build`     | Compiles TypeScript to `dist/`                                         |
| `npm start`         | Runs the compiled server                                               |
| `npm run seed`      | Resets the collections and inserts demo data (prints IDs to use)       |
| `npm test`          | Runs the integration tests (24 cases) against a throwaway test DB      |
| `npm run typecheck` | Type-checks without emitting files                                     |

Tests use `mongodb://127.0.0.1:27017/englishyaari_test` by default. You can override it with `TEST_MONGODB_URI`. The test database is wiped after every test and dropped at the end.

### Postman

Import `postman/EnglishYaari-Session-Booking.postman_collection.json` and run it with the **Collection Runner**.

- **Happy path** creates a teacher, a user and a session, finds the session by date, books it, checks history, completes it, and checks history again.
- **Error cases** covers every 400 / 404 / 409 rule.
- IDs and timestamps are passed between requests automatically through collection variables. Every request has test assertions.
- Change the `baseUrl` variable if the server is not running on `http://localhost:4000`.

---

## API

All responses share one envelope:

```jsonc
// success
{ "success": true, "data": { ... } }
// error
{ "success": false, "error": { "message": "Validation failed", "details": [{ "field": "email", "message": "..." }] } }
```

| #   | Method  | Endpoint                                    | Success | Errors        |
| --- | ------- | ------------------------------------------- | ------- | ------------- |
| 1   | `POST`  | `/users`                                    | 201     | 400, 409      |
| 2   | `POST`  | `/sessions`                                 | 201     | 400, 404, 409 |
| 3   | `GET`   | `/sessions/available?dateTimestamp={ts}`    | 200     | 400           |
| 4   | `POST`  | `/sessions/:id/book`                        | 200     | 400, 404, 409 |
| 5   | `PATCH` | `/sessions/:id/complete`                    | 200     | 400, 404, 409 |
| 6   | `GET`   | `/users/:id/sessions`                       | 200     | 400, 404      |
| –   | `POST`  | `/teachers` *(helper, so sessions can be created)* | 201 | 400, 409 |
| –   | `GET`   | `/teachers` *(helper)*                      | 200     | –             |
| –   | `GET`   | `/health`                                   | 200     | –             |

### 1. Create user: `POST /users`

```json
{ "fullName": "Shivam Pratap Raj", "email": "shivam@example.com", "phone": "+919876543210" }
```

- The email is trimmed and lowercased, so `A@x.com` and `a@x.com` count as the same address.
- A duplicate email returns `409`. A unique index enforces this too, so two concurrent requests can't both create the same email: the second gets a `409` from the duplicate-key handler.

### 2. Create session: `POST /sessions`

```json
{ "teacherId": "6ad7...", "startTime": "2026-10-21T04:30:00.000Z", "endTime": "2026-10-21T05:30:00.000Z" }
```

- `startTime` / `endTime` accept an ISO 8601 string or epoch milliseconds.
- `endTime` must be greater than `startTime`, otherwise `400`.
- The teacher must exist, otherwise `404`.
- Status defaults to `AVAILABLE` and `userId` defaults to `null`.
- **Extra rule:** a teacher can't have overlapping sessions. An overlap returns `409`.

### 3. Available sessions: `GET /sessions/available?dateTimestamp=1792434600000`

This endpoint uses an **aggregation pipeline**. `dateTimestamp` can be any Unix timestamp that falls inside the day you want, in milliseconds or seconds (values below `1e12` are read as seconds). The server turns it into the `[start, end)` range of that calendar day in `APP_TIMEZONE`. Then:

```
$match   { status: AVAILABLE, startTime: { $gte: dayStart, $lt: dayEnd } }   ← uses index { status, startTime }
$sort    { startTime: 1 }
$lookup  teachers (sub-pipeline projects only public teacher fields)
$unwind  teacher                                                           ← drops sessions whose teacher was deleted
$project { startTime, endTime, status, durationMinutes ($dateDiff), teacher }
```

```jsonc
{
  "success": true,
  "data": {
    "date": { "from": "2026-10-19T18:30:00.000Z", "to": "2026-10-20T18:30:00.000Z", "timezone": "Asia/Kolkata" },
    "count": 1,
    "sessions": [
      {
        "_id": "...", "status": "AVAILABLE", "startTime": "...", "endTime": "...", "durationMinutes": 60,
        "teacher": { "_id": "...", "fullName": "Anita Sharma", "email": "...", "specialization": "Spoken English", "experience": 6 }
      }
    ]
  }
}
```

### 4. Book session: `POST /sessions/:id/book`

```json
{ "userId": "6ad7..." }
```

| Case                                          | Response |
| --------------------------------------------- | -------- |
| Invalid ObjectId / missing `userId`           | 400      |
| User not found                                | 404      |
| Session not found                             | 404      |
| Session already `BOOKED`                      | 409      |
| Session `COMPLETED`                           | 409      |
| Success: status becomes `BOOKED` and `userId` is set | 200 |

### 5. Complete session: `PATCH /sessions/:id/complete`

Only `BOOKED` sessions can be completed. On success the status becomes `COMPLETED` and `completedAt` is set to now. An `AVAILABLE` or already `COMPLETED` session returns `409`. An unknown session returns `404`.

### 6. User sessions: `GET /users/:id/sessions`

This endpoint is a **single aggregation pipeline that starts from the `users` collection**, so an unknown user simply returns no document (`404`) without a separate lookup query.

```
$match   { _id: userId }
$lookup  sessions (localField _id → userId) with a sub-pipeline:
           $match status ∈ [BOOKED, COMPLETED]
           $lookup teachers → $unwind → $project
$project user, and splits the sessions with $filter + $sortArray:
           upcomingSessions  = BOOKED,    sorted by startTime asc
           completedSessions = COMPLETED, sorted by completedAt desc
$addFields summary { upcoming, completed } via $size
```

```jsonc
{
  "success": true,
  "data": {
    "user": { "_id": "...", "fullName": "...", "email": "...", "phone": "..." },
    "upcomingSessions": [ { "_id": "...", "status": "BOOKED", "startTime": "...", "endTime": "...", "completedAt": null, "teacher": { ... } } ],
    "completedSessions": [ { "_id": "...", "status": "COMPLETED", "completedAt": "...", "teacher": { ... } } ],
    "summary": { "upcoming": 1, "completed": 1 }
  }
}
```

---

## Design decisions

- **Race-safe booking and completion.** Each state change is one atomic `findOneAndUpdate` that includes the expected current status in its filter (`{ _id, status: AVAILABLE }` → `BOOKED`). If two users try to book the same slot at the same moment, exactly one succeeds and the other gets `409`. There is a test that fires 5 concurrent bookings at one session. Only when the update matches nothing does the service read the session again, to choose between `404` and `409`. This needs no transactions, so it also works on a standalone MongoDB.
- **Centralized error handling.** Express 5 forwards rejected promises from async handlers on its own, so there are no `try/catch` blocks or `asyncHandler` wrappers in controllers. One error handler maps each error type to a status code:
  - `AppError`: its own status code.
  - `ZodError`: `400`, with field-level details.
  - Mongo duplicate key (E11000): `409`.
  - Mongoose `CastError` / `ValidationError`: `400`.
  - Malformed JSON: `400`.
  - Unknown routes: `404`.
  - Anything else: `500`. The stack trace is included only in development.
- **Validation at the edge.** A generic `validate(schema, source)` middleware parses `body`, `params` or `query` with Zod and hands the cleaned values to controllers through `res.locals`. Invalid ObjectIds are rejected with `400` before any database call.
- **Layering.** The request path is `routes → validate middleware → controllers (HTTP only) → services (business rules and queries) → models`.
- **Indexes:**
  - `users.email` and `teachers.email` are unique.
  - `sessions { status, startTime }` serves API 3.
  - `sessions { userId, status, startTime }` serves API 6.
  - `sessions { teacherId, startTime, endTime }` serves the overlap check.
- **Timezone-aware days.** "Sessions on this date" depends on the timezone. The day boundaries are worked out in `APP_TIMEZONE` (default IST) with `Intl`, so no date library is needed, and the calculation handles DST. The resolved range is returned in the response so clients can see exactly which window was used.

### Assumptions

- **Upcoming** means `BOOKED`, i.e. booked and not completed yet, whatever its start time. A booked session whose start time has passed stays "upcoming" until a teacher or admin marks it complete.
- Completing a session isn't restricted to after its `endTime`. The spec doesn't ask for that, and a real deployment would put this endpoint behind teacher auth.
- Authentication is out of scope for the assignment. `userId` is sent in the booking body.

## Project structure

```
src/
  app.ts                 Express app (middleware, routes, error handling)
  server.ts              Bootstrap: DB connect, listen, graceful shutdown
  config/                env (Zod-validated), db connection
  models/                User, Teacher, Session (+ indexes)
  validators/            Zod schemas for body / params / query
  middlewares/           validate(), notFoundHandler, errorHandler
  controllers/           HTTP layer only
  services/              Business rules + aggregation pipelines
  utils/                 AppError, timezone-aware date helpers
  scripts/seed.ts        Demo data
tests/                   Vitest + Supertest integration tests
postman/                 Postman collection
```
