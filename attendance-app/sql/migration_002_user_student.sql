-- ============================================================
-- Migration 2: wire classes/attendance to the real user_student
-- table, add class date/time, and add syllabus/notes/assignment
-- tracking.
-- Run AFTER sql/schema.sql, in Hasura Console -> Data -> SQL.
-- ============================================================

-- --- classes: which school, which faculty (optional FK), when ---
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS school_id      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS faculty_user_id INTEGER REFERENCES user_student(user_id),
  ADD COLUMN IF NOT EXISTS class_date     DATE,
  ADD COLUMN IF NOT EXISTS start_time     TIME,
  ADD COLUMN IF NOT EXISTS end_time       TIME,
  ADD COLUMN IF NOT EXISTS syllabus_link  TEXT,
  ADD COLUMN IF NOT EXISTS notes_link     TEXT,
  ADD COLUMN IF NOT EXISTS assignment_link TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_school_id  ON classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_class_date ON classes(class_date);

-- attendance.attendance_data entries now also carry, per student:
--   { "student_id": "<std_id>", "status": "Present|Absent|Reason", "reason": "",
--     "assignment_submitted": false, "assignment_submission_link": "" }
-- No column change needed since attendance_data is JSONB — this is a
-- shape convention enforced in the API layer, not the DB.

-- ============================================================
-- AFTER RUNNING: in the Hasura Console
-- 1. Data -> classes -> re-check columns are picked up.
-- 2. Track the new FK classes.faculty_user_id -> user_student.user_id
--    so Hasura creates:
--      - object relationship "faculty" on classes
--        (classes.faculty_user_id -> user_student.user_id)
-- 3. student_ids on classes stores an array of user_student.std_id
--    values (text), NOT user_id — this lets Admin freely paste
--    known roll numbers as well as pick them from a list, and lets a
--    logged-in student match their own std_id against every class
--    roster without needing a join table.
-- 4. Keep user_student itself untracked for public/anonymous roles.
--    All reads (login, faculty list, student list) go through the
--    Vercel API using the admin secret.
-- ============================================================
