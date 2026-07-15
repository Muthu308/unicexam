// api/student-login.js
// POST { identifier: "<email_id or std_id or mobile>", password: "..." }
// Verifies against user_student (user_role = "student", active_status = true)
// and returns the student's own profile (never the password).
//
// NOTE: this does a direct password comparison against the `password`
// column as it exists in user_student today. If those passwords are
// stored in plaintext, that's a real risk — before going to production,
// switch to hashed passwords (e.g. bcrypt) and compare hashes here
// instead of raw strings.

import { hasuraRequest } from "/hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier and password are required" });
    }

    const query = `
      query FindStudent($identifier: String!) {
        user_student(
          where: {
            user_role: { _eq: "student" }
            active_status: { _eq: true }
            _or: [
              { email_id: { _eq: $identifier } }
              { std_id: { _eq: $identifier } }
              { mobile: { _eq: $identifier } }
            ]
          }
        ) {
          user_id
          std_id
          name
          email_id
          mobile
          class_name
          school_name
          school_id
          password
        }
      }
    `;

    const data = await hasuraRequest(query, { identifier });
    const match = (data.user_student || [])[0];

    if (!match || match.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { password: _omit, ...profile } = match;
    return res.status(200).json(profile);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
