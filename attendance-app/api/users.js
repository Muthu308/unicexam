// api/users.js
// GET /api/users?role=faculty&school_id=SCH001
// GET /api/users?role=student&school_id=SCH001&class_name=10-A
// Reads from the existing user_student table so Admin can pick real
// faculty/students instead of (or in addition to) free-typing IDs.

import { hasuraRequest } from "../lib/hasura.js";

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
    const { role, school_id, class_name } = req.query;
    if (!role) {
      return res.status(400).json({ error: "role query param required (faculty|student)" });
    }

    const where = { user_role: { _eq: role }, active_status: { _eq: true } };
    if (school_id) where.school_id = { _eq: school_id };
    if (class_name) where.class_name = { _eq: class_name };

    const query = `
      query ListUsers($where: user_student_bool_exp!) {
        user_student(where: $where, order_by: { name: asc }) {
          user_id
          std_id
          name
          email_id
          mobile
          class_name
          school_name
          school_id
          user_role
        }
      }
    `;

    const data = await hasuraRequest(query, { where });
    return res.status(200).json(data.user_student);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
