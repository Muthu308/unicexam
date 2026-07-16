// api/adminuserman.js
// Single action-based endpoint backing admin-user-management.html
// POST body: { action: "list" | "get" | "create" | "update" | "delete", payload: {...} }
//
// Table: user_student
//   user_id        int, PK, default nextval(...)
//   email_id       text
//   name           varchar
//   school_name    varchar
//   created_at     date, default now()
//   updated_at     timestamptz, default now()
//   mobile         varchar
//   class_name     varchar
//   school_venue   text
//   std_id         varchar
//   dob            date, nullable
//   password       text, nullable
//   user_role      varchar, nullable
//   school_id      varchar, nullable
//   active_status  boolean, nullable, default true

import { hasuraRequest } from "./hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// All columns we're willing to return / accept from the client.
const RETURN_FIELDS = `
  user_id
  email_id
  name
  school_name
  created_at
  updated_at
  mobile
  class_name
  school_venue
  std_id
  dob
  user_role
  school_id
  active_status
`;

// Fields the client is allowed to write. Deliberately excludes user_id,
// created_at, updated_at — those are server/DB managed.
const WRITABLE_FIELDS = [
  "email_id",
  "name",
  "school_name",
  "mobile",
  "class_name",
  "school_venue",
  "std_id",
  "dob",
  "password",
  "user_role",
  "school_id",
  "active_status",
];

function pickWritable(obj = {}) {
  const out = {};
  for (const key of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

// Normalizes empty-string values to null for nullable columns so we don't
// store "" where NULL is the correct "not set" value (dob, school_id, etc).
function normalizeNullable(fields) {
  const nullable = ["dob", "user_role", "school_id", "password"];
  const out = { ...fields };
  nullable.forEach((key) => {
    if (out[key] === "") out[key] = null;
  });
  return out;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action, payload = {} } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    // ======================================
    // LIST
    // ======================================
    if (action === "list") {
      const where = {};
      if (payload.role) where.user_role = { _eq: payload.role };
      if (payload.school_id) where.school_id = { _eq: payload.school_id };

      const query = `
        query ListUsers($where: user_student_bool_exp) {
          user_student(where: $where, order_by: { name: asc }) {
            ${RETURN_FIELDS}
          }
        }
      `;
      const data = await hasuraRequest(query, { where });
      return res.status(200).json(data.user_student || []);
    }

    // ======================================
    // GET ONE
    // ======================================
    if (action === "get") {
      const { user_id } = payload;
      if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
      }

      const query = `
        query GetUser($user_id: Int!) {
          user_student_by_pk(user_id: $user_id) {
            ${RETURN_FIELDS}
          }
        }
      `;
      const data = await hasuraRequest(query, { user_id: Number(user_id) });
      if (!data.user_student_by_pk) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json(data.user_student_by_pk);
    }

    // ======================================
    // CREATE
    // ======================================
    if (action === "create") {
      const fields = normalizeNullable(pickWritable(payload));

      if (!fields.name || !fields.email_id) {
        return res.status(400).json({ error: "name and email_id are required" });
      }
      if (!fields.std_id) {
        return res.status(400).json({ error: "std_id is required" });
      }
      if (!fields.mobile) {
        return res.status(400).json({ error: "mobile is required" });
      }
      if (!fields.school_name) {
        return res.status(400).json({ error: "school_name is required" });
      }
      if (!fields.class_name) {
        return res.status(400).json({ error: "class_name is required" });
      }

      // active_status defaults to true unless explicitly provided
      if (fields.active_status === undefined || fields.active_status === "") {
        fields.active_status = true;
      }
      // user_role defaults to "student" if not provided
      if (!fields.user_role) {
        fields.user_role = "student";
      }

      const mutation = `
        mutation InsertUser($object: user_student_insert_input!) {
          insert_user_student_one(object: $object) {
            ${RETURN_FIELDS}
          }
        }
      `;
      const data = await hasuraRequest(mutation, { object: fields });
      return res.status(201).json(data.insert_user_student_one);
    }

    // ======================================
    // UPDATE
    // ======================================
    if (action === "update") {
      const { user_id, set } = payload;
      if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
      }

      // Only whitelist + only include keys the client actually sent.
      // Crucially: if "password" isn't a key on `set` at all (client left
      // the field blank on edit), it's simply never included here — the
      // existing password in the DB is left untouched. Hasura's _set only
      // updates the columns present in the variables object.
      const fields = normalizeNullable(pickWritable(set || {}));

      // Don't let a blank password wipe out an existing one either —
      // treat "" the same as "not provided" for this field specifically.
      if (fields.password === null || fields.password === undefined) {
        delete fields.password;
      }

      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      // Always bump updated_at server-side on any update.
      fields.updated_at = new Date().toISOString();

      const mutation = `
        mutation UpdateUser($user_id: Int!, $set: user_student_set_input!) {
          update_user_student_by_pk(
            pk_columns: { user_id: $user_id }
            _set: $set
          ) {
            ${RETURN_FIELDS}
          }
        }
      `;
      const data = await hasuraRequest(mutation, {
        user_id: Number(user_id),
        set: fields,
      });

      if (!data.update_user_student_by_pk) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json(data.update_user_student_by_pk);
    }

    // ======================================
    // DELETE
    // ======================================
    if (action === "delete") {
      const { user_id } = payload;
      if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
      }

      const mutation = `
        mutation DeleteUser($user_id: Int!) {
          delete_user_student_by_pk(user_id: $user_id) {
            user_id
          }
        }
      `;
      const data = await hasuraRequest(mutation, { user_id: Number(user_id) });
      return res.status(200).json({
        success: true,
        deleted: data.delete_user_student_by_pk,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("Admin User Management API Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
