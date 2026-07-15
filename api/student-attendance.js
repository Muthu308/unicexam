// api/student-attendance.js
// GET ?student_id=S001
// Returns every attendance record that mentions this student, flattened
// to just that student's status/reason, newest first, with class details.

import { hasuraRequest } from "/hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ error: "student_id query param required" });
    }

    // jsonb "_contains" maps to Postgres `@>`, which for an array of
    // objects returns rows where at least one array element is a
    // superset of { student_id: ... }. This requires the "class" object
    // relationship to be tracked in Hasura (attendance.class_id -> classes.id).
    const query = `
      query GetStudentAttendance($contains: jsonb!) {
        attendance(where: { attendance_data: { _contains: $contains } }, order_by: { marked_at: desc }) {
          id
          class_id
          attendance_data
          marked_at
          class {
            session
            subject
            topic
            faculty_name
            class_date
            start_time
            end_time
            syllabus_link
            notes_link
            assignment_link
          }
        }
      }
    `;

    // student_id here is the student's std_id (see migration_002 notes)
    const data = await hasuraRequest(query, {
      contains: [{ student_id }],
    });

    const records = (data.attendance || []).map((rec) => {
      const entry = (rec.attendance_data || []).find(
        (a) => a.student_id === student_id
      );
      const cls = rec.class || {};
      return {
        attendance_id: rec.id,
        class_id: rec.class_id,
        session: cls.session ?? null,
        subject: cls.subject ?? null,
        topic: cls.topic ?? null,
        faculty_name: cls.faculty_name ?? null,
        class_date: cls.class_date ?? null,
        start_time: cls.start_time ?? null,
        end_time: cls.end_time ?? null,
        syllabus_link: cls.syllabus_link ?? null,
        notes_link: cls.notes_link ?? null,
        assignment_link: cls.assignment_link ?? null,
        marked_at: rec.marked_at,
        status: entry ? entry.status : null,
        reason: entry ? entry.reason || "" : "",
        assignment_submitted: entry ? !!entry.assignment_submitted : false,
        assignment_submission_link: entry
          ? entry.assignment_submission_link || ""
          : "",
      };
    });

    // day-wise grouping, newest date first
    records.sort((a, b) => {
      const da = a.class_date || a.marked_at;
      const db = b.class_date || b.marked_at;
      return new Date(db) - new Date(da);
    });

    return res.status(200).json(records);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
