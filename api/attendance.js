// api/attendance.js
// POST -> Faculty submits attendance for a class_id.
//         body: { class_id: 1, attendance_data: [{student_id, status, reason}, ...] }
// GET  -> Fetch attendance record(s) for a given class_id (?class_id=1)

import { hasuraRequest } from "/hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const VALID_STATUSES = ["Present", "Absent", "Reason"];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      const { class_id, attendance_data } = req.body || {};

      if (!class_id || !Array.isArray(attendance_data)) {
        return res.status(400).json({
          error: "class_id and attendance_data array are required",
        });
      }

      // basic shape validation
      // each entry: { student_id, status, reason, assignment_submitted, assignment_submission_link }
      for (const entry of attendance_data) {
        if (!entry.student_id || !VALID_STATUSES.includes(entry.status)) {
          return res.status(400).json({
            error:
              "Each attendance entry needs student_id and a status of Present, Absent or Reason",
          });
        }
      }

      // normalize optional assignment fields so every row has a consistent shape
      const normalized = attendance_data.map((e) => ({
        student_id: e.student_id,
        status: e.status,
        reason: e.status === "Reason" ? e.reason || "" : "",
        assignment_submitted: !!e.assignment_submitted,
        assignment_submission_link: e.assignment_submitted
          ? e.assignment_submission_link || ""
          : "",
      }));

      const mutation = `
        mutation InsertAttendance($class_id: Int!, $attendance_data: jsonb!) {
          insert_attendance_one(
            object: { class_id: $class_id, attendance_data: $attendance_data }
          ) {
            id
            class_id
            attendance_data
            marked_at
          }
        }
      `;

      const data = await hasuraRequest(mutation, {
        class_id: Number(class_id),
        attendance_data: normalized,
      });

      return res.status(200).json(data.insert_attendance_one);
    }

    if (req.method === "GET") {
      const { class_id } = req.query;
      if (!class_id) {
        return res.status(400).json({ error: "class_id query param required" });
      }

      const query = `
        query GetAttendance($class_id: Int!) {
          attendance(
            where: { class_id: { _eq: $class_id } }
            order_by: { marked_at: desc }
          ) {
            id
            class_id
            attendance_data
            marked_at
          }
        }
      `;
      const data = await hasuraRequest(query, { class_id: Number(class_id) });
      return res.status(200).json(data.attendance);
    }

    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
