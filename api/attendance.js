// api/attendance.js
// POST -> Save attendance
// GET  -> Get attendance by class_id

import { hasuraRequest } from "./hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader(
  "Access-Control-Allow-Methods",
  "GET,POST,PUT,DELETE,OPTIONS"
);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const VALID_STATUSES = [
  "Present",
  "Absent",
  "Late",
  "Reason",
];

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ======================================
    // SAVE ATTENDANCE
    // ======================================
    if (req.method === "POST") {
      const { class_id, attendance_data } = req.body || {};

      if (!class_id) {
        return res.status(400).json({
          error: "class_id is required",
        });
      }

      if (
        !Array.isArray(attendance_data) ||
        attendance_data.length === 0
      ) {
        return res.status(400).json({
          error: "attendance_data must be a non-empty array",
        });
      }

      for (const row of attendance_data) {
        if (!row.student_id) {
          return res.status(400).json({
            error: "student_id is required",
          });
        }

        if (!VALID_STATUSES.includes(row.status)) {
          return res.status(400).json({
            error:
              "Status must be Present, Absent, Late or Reason",
          });
        }
      }

      const normalized = attendance_data.map((row) => ({
        student_id: row.student_id,
        status: row.status,

        reason:
          row.status === "Reason" ||
          row.status === "Late"
            ? row.reason || ""
            : "",

        in_time:
          row.status === "Late"
            ? row.in_time || ""
            : "",

        out_time:
          row.status === "Late"
            ? row.out_time || ""
            : "",

        assignment_submitted:
          !!row.assignment_submitted,

        assignment_submission_link:
          row.assignment_submitted
            ? row.assignment_submission_link || ""
            : "",
      }));

      const mutation = `
        mutation InsertAttendance(
          $class_id:Int!,
          $attendance_data:jsonb!
        ) {
          insert_attendance_one(
            object:{
              class_id:$class_id
              attendance_data:$attendance_data
            }
          ){
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

      return res.status(201).json(data.insert_attendance_one);
    }

    // ======================================
    // GET ATTENDANCE
    // ======================================
    if (req.method === "GET") {
      const { class_id } = req.query;

      if (!class_id) {
        return res.status(400).json({
          error: "class_id query parameter is required",
        });
      }

      const query = `
        query GetAttendance($class_id:Int!) {
          attendance(
            where:{
              class_id:{_eq:$class_id}
            }
            order_by:{
              marked_at:desc
            }
          ){
            id
            class_id
            attendance_data
            marked_at
          }
        }
      `;

      const data = await hasuraRequest(query, {
        class_id: Number(class_id),
      });

      return res.status(200).json(
        data.attendance || []
      );
    }

    if (req.method === "PUT") {
  const { id, attendance_data } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: "Attendance id is required",
    });
  }

  const normalized = attendance_data.map((row) => ({
    student_id: row.student_id,
    status: row.status,
    reason:
      row.status === "Reason" || row.status === "Late"
        ? row.reason || ""
        : "",
    in_time:
      row.status === "Late"
        ? row.in_time || ""
        : "",
    out_time:
      row.status === "Late"
        ? row.out_time || ""
        : "",
    assignment_submitted: !!row.assignment_submitted,
    assignment_submission_link:
      row.assignment_submitted
        ? row.assignment_submission_link || ""
        : "",
  }));

  const mutation = `
    mutation UpdateAttendance(
      $id:Int!,
      $attendance_data:jsonb!
    ){
      update_attendance_by_pk(
        pk_columns:{id:$id}
        _set:{
          attendance_data:$attendance_data
        }
      ){
        id
        class_id
        attendance_data
        marked_at
      }
    }
  `;

  const data = await hasuraRequest(mutation, {
    id: Number(id),
    attendance_data: normalized,
  });

  return res
    .status(200)
    .json(data.update_attendance_by_pk);
}
    if (req.method === "DELETE") {
  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: "Attendance id is required",
    });
  }

  const mutation = `
    mutation DeleteAttendance($id:Int!){
      delete_attendance_by_pk(id:$id){
        id
      }
    }
  `;

  const data = await hasuraRequest(mutation, {
    id: Number(id),
  });

  return res.status(200).json({
    success: true,
    deleted: data.delete_attendance_by_pk,
  });
}

res.setHeader(
  "Allow",
  "GET,POST,PUT,DELETE,OPTIONS"
);

    return res.status(405).json({
      error: "Method not allowed",
    });

  } catch (err) {
    console.error("Attendance API Error:", err);

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
