// api/student-attendance.js

import { hasuraRequest } from "./hasura.js";

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
      return res.status(400).json({
        error: "student_id query param required",
      });
    }

    // Fetch attendance records
    const attendanceQuery = `
      query GetStudentAttendance($contains: jsonb!) {
        attendance(
          where: {
            attendance_data: {
              _contains: $contains
            }
          }
          order_by: {
            marked_at: desc
          }
        ) {
          id
          class_id
          attendance_data
          marked_at
        }
      }
    `;

    const attendanceResult = await hasuraRequest(attendanceQuery, {
      contains: [{ student_id }],
    });

    const attendance = attendanceResult.attendance || [];

    // Get unique class ids
    const classIds = [...new Set(
      attendance
        .map(a => a.class_id)
        .filter(id => id !== null)
    )];

    let classMap = {};

    if (classIds.length > 0) {
      const classQuery = `
        query GetClasses($ids: [Int!]!) {
          classes(
            where: {
              id: {
                _in: $ids
              }
            }
          ) {
            id
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
      `;

      const classResult = await hasuraRequest(classQuery, {
        ids: classIds,
      });

      classMap = {};

      (classResult.classes || []).forEach(cls => {
        classMap[cls.id] = cls;
      });
    }

    const records = attendance.map(rec => {
      const entry = (rec.attendance_data || []).find(
        s => s.student_id === student_id
      );

      const cls = classMap[rec.class_id] || {};

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

        status: entry?.status ?? null,
        reason: entry?.reason ?? "",

        assignment_submitted:
          entry?.assignment_submitted ?? false,

        assignment_submission_link:
          entry?.assignment_submission_link ?? "",
      };
    });

    records.sort((a, b) => {
      const da = a.class_date || a.marked_at;
      const db = b.class_date || b.marked_at;
      return new Date(db) - new Date(da);
    });

    return res.status(200).json(records);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
