-- ============================================================
-- Attendance System Schema (Postgres, used via Hasura)
-- Run this in the Hasura Console -> Data -> SQL, or via psql.
-- ============================================================

-- 1. CLASSES table
-- One row per class session created by Admin.
-- student_ids is a JSONB array e.g. ["S001","S002","S003"]
CREATE TABLE IF NOT EXISTS classes (
  id            SERIAL PRIMARY KEY,
  session       VARCHAR(50)  NOT NULL,      -- e.g. "2026-Batch-A" or "Morning Session"
  subject       VARCHAR(150) NOT NULL,
  topic         VARCHAR(300),
  faculty_name  VARCHAR(150) NOT NULL,
  student_ids   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. ATTENDANCE table
-- One row per attendance-marking event for a class.
-- attendance_data is a JSONB array of objects:
-- [{ "student_id": "S001", "status": "Present", "reason": "" },
--  { "student_id": "S002", "status": "Absent",  "reason": "Sick" }]
CREATE TABLE IF NOT EXISTS attendance (
  id                SERIAL PRIMARY KEY,
  class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  attendance_data   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  marked_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_data_gin ON attendance USING GIN (attendance_data);
CREATE INDEX IF NOT EXISTS idx_classes_student_ids_gin ON classes USING GIN (student_ids);

-- ============================================================
-- AFTER RUNNING THIS SQL, IN THE HASURA CONSOLE:
-- 1. Go to Data tab -> "classes" and "attendance" -> click "Track" if not
--    already tracked.
-- 2. Track the foreign key attendance.class_id -> classes.id so Hasura
--    creates the relationships automatically:
--      - object relationship "class" on attendance  (attendance.class_id -> classes.id)
--      - array relationship  "attendances" on classes (classes.id -> attendance.class_id)
-- 3. Under Data -> classes / attendance -> Permissions, you do NOT need to
--    add roles for the client, because all requests go through the
--    Vercel serverless API using the admin secret (server-side only).
--    Keep classes/attendance NOT exposed to an "anonymous"/"public" role.
-- ============================================================
