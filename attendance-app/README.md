# Attendance Register

Admin creates classes (with date/time, faculty, roster, syllabus/notes/
assignment links) → Faculty marks Present / Absent / Reason plus
assignment-submitted status per student → Student logs in and sees their
attendance grouped day by day. Built on your existing `user_student` table
plus two new tables, all via Hasura (Postgres) + Vercel serverless
functions + plain HTML/JS.

## What's new in this version

- Faculty and student pickers on the Admin page now read real people from
  **`user_student`**, filtered by `user_role` and `school_id` — with a
  free-text fallback for faculty and a paste box for students, both of
  which merge into the same roster.
- Classes now carry `class_date`, `start_time`, `end_time`,
  `syllabus_link`, `notes_link`, `assignment_link`.
- Each attendance entry now also carries `assignment_submitted` and
  `assignment_submission_link` per student.
- Students log in (`api/student-login.js`) against `user_student`
  (`email_id` / `mobile` / `std_id` + `password`) instead of typing any
  arbitrary ID, and their attendance is grouped day-wise.

## 1. Data model

**`classes`** — one row per class, `student_ids` is a JSONB array:

| id | session | subject | topic | faculty_name | student_ids | created_at |
|----|---------|---------|-------|---------------|-------------|------------|
| 1  | 2026-Sem1-A | Data Structures | BST | Priya Raman | ["S001","S002","S003"] | ... |

**`attendance`** — one row per submission, `attendance_data` is a JSONB
array of `{student_id, status, reason}`:

| id | class_id | attendance_data | marked_at |
|----|----------|------------------|-----------|
| 1  | 1 | [{"student_id":"S001","status":"Present","reason":""}, {"student_id":"S002","status":"Absent","reason":"Sick"}] | ... |

`status` is one of `Present`, `Absent`, `Reason` (the "Reason" bucket is for
any other marked-but-not-simply-absent case, with the free-text reason
stored alongside it).

Run `sql/schema.sql` then `sql/migration_002_user_student.sql` in the
Hasura Console (Data → SQL) or via `psql`. The migration adds
`school_id`, `faculty_user_id` (FK → `user_student.user_id`),
`class_date`, `start_time`, `end_time`, `syllabus_link`, `notes_link`,
`assignment_link` to `classes`. `attendance.attendance_data` needs no
column change — the per-student `assignment_submitted` /
`assignment_submission_link` fields are just part of the JSONB shape,
enforced in `api/attendance.js`.

**`student_ids` stores `user_student.std_id` values (text), not the
integer `user_id`.** That's what lets Admin paste roll numbers freely as
well as pick them from a list, and lets a logged-in student's own
`std_id` be matched straight against every class roster.

## 2. Hasura setup

1. Use your existing Hasura Cloud project (`user_student` is already there).
2. Run `sql/schema.sql`, then `sql/migration_002_user_student.sql`.
3. In the Hasura Console → Data tab, click **Track** on `classes` and
   `attendance` if not tracked automatically.
4. Track these foreign keys so Hasura builds the relationships the API
   relies on:
   - `attendance.class_id → classes.id` → object relationship **`class`**
     on `attendance` (used by `/api/student-attendance`)
   - `classes.faculty_user_id → user_student.user_id` → object
     relationship **`faculty`** on `classes` (optional, for future use)
5. Do **not** add public/anonymous permissions on `classes`, `attendance`,
   or `user_student` — every read/write, including login, goes through
   the Vercel API using the admin secret, which stays server-side only.
6. Copy your GraphQL endpoint (e.g. `https://xxxx.hasura.app/v1/graphql`)
   and admin secret — you'll need them in step 3 below.

## 3. Environment variables (Vercel project settings)

| Name | Value |
|------|-------|
| `HASURA_ENDPOINT` | `https://<your-project>.hasura.app/v1/graphql` |
| `HASURA_ADMIN_SECRET` | your Hasura admin secret |

Set these under **Vercel → Project → Settings → Environment Variables**
for Production, Preview, and Development.

## 4. Deploy

```bash
npm i -g vercel   # if you don't already have it
cd attendance-app
vercel            # first deploy, follow the prompts
vercel --prod     # promote to production
```

Because this is a zero-config static + serverless project (no framework),
Vercel automatically serves `index.html`, `admin.html`, `faculty.html`,
`student.html`, `styles.css`, `config.js` as static files, and turns each
file in `api/` into its own serverless function:

- `POST/GET /api/classes` — create / list classes (`GET ?school_id=` filters)
- `POST/GET /api/attendance` — mark / read attendance for a class
- `GET /api/student-attendance?student_id=<std_id>` — a student's full history
- `GET /api/users?role=faculty|student&school_id=&class_name=` — reads
  `user_student` for the Admin pickers
- `POST /api/student-login` — `{ identifier, password }` → student profile

If you ever split the frontend and backend into separate Vercel projects,
edit `config.js` and set `window.API_BASE` to the backend's URL.

## 5. Using it

- Open `/admin.html` → enter a School ID (or leave blank for everyone) →
  **Load faculty & students** → pick a faculty from the dropdown (or type
  a name if they're not listed) → pick students from the roster and/or
  paste their `std_id`s (both are merged) → set Session, Subject, Topic,
  class date/time, and optionally syllabus/notes/assignment links →
  **Save class**.
- Open `/faculty.html` → optionally filter by School ID → pick the class
  → for each student, click Present / Absent / Reason (a text box appears
  for Reason) and tick "Submitted" for their assignment (a link field
  appears) → **Submit attendance**. Every submission is stored as its own
  row, so you get a full history per class.
- Open `/student.html` → log in with email/mobile/`std_id` + password →
  see a Present/Absent/Reason summary and assignment count, then the full
  history grouped **day by day**, with time, subject, faculty, status,
  assignment status, and quick links to syllabus/notes/assignment for
  each class.

## 6. How the student lookup works

Postgres's JSONB containment operator (`@>`) can check whether an array
contains an object matching a given shape, which is exactly what Hasura's
`_contains` filter compiles to:

```graphql
attendance(where: { attendance_data: { _contains: [{ student_id: "S001" }] } })
```

This returns every attendance row where `attendance_data` has at least one
entry with `student_id: "S001"` — the API then picks out just that
student's `status`/`reason` from the matched row and joins in the class's
subject/topic/faculty via the `class` relationship.

## 7. Notes / next steps for production

- **`api/student-login.js` compares the `password` column directly.** If
  `user_student.password` is stored in plaintext today, that's a real
  risk — switch to a hashing scheme (bcrypt/argon2) and compare hashes
  server-side before this goes live with real students.
- CORS is currently open (`*`) and there's no session/token after login —
  the student page just holds the profile in memory for the tab. Before
  opening this to real users, add a real session (JWT/cookie) and lock
  down `/api/classes`, `/api/attendance`, and `/api/users` so Faculty/
  Admin actions require their own login too, not just the student flow.
- `student_ids` and `attendance_data` are JSONB, not normalized join
  tables, so there's no DB-level foreign key enforcing that a pasted
  `std_id` actually exists in `user_student`. Consider validating pasted
  IDs against `user_student` in `api/classes.js` before saving.
- Each `POST /api/attendance` call inserts a *new* row rather than
  updating a previous one, so re-marking a class creates a fresh history
  entry instead of overwriting the last one — useful for corrections/audit
  trail, but you may want to add an "edit last submission" flow.
- `faculty_user_id` is optional — if Admin free-types a faculty name that
  isn't in `user_student` yet, the class still saves fine, just without
  the FK link.
