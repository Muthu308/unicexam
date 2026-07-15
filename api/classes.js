// api/classes.js
// POST    -> Create Class
// GET     -> List Classes
// PUT     -> Update Class
// DELETE  -> Delete Class

import { hasuraRequest } from "./hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // =====================================================
    // CREATE CLASS
    // =====================================================
    if (req.method === "POST") {
      const {
        session,
        subject,
        topic = "",
        faculty_name,
        faculty_user_id = null,
        student_ids = [],
        school_id = null,
        class_date = null,
        start_time = null,
        end_time = null,
        syllabus_link = null,
        notes_link = null,
        assignment_link = null,
      } = req.body || {};

      if (!session || !subject || !faculty_name) {
        return res.status(400).json({
          error: "session, subject and faculty_name are required",
        });
      }

      if (!Array.isArray(student_ids)) {
        return res.status(400).json({
          error: "student_ids must be an array",
        });
      }

      const mutation = `
        mutation InsertClass(
          $session: String!
          $subject: String!
          $topic: String
          $faculty_name: String!
          $faculty_user_id: Int
          $student_ids: jsonb!
          $school_id: String
          $class_date: date
          $start_time: time
          $end_time: time
          $syllabus_link: String
          $notes_link: String
          $assignment_link: String
        ) {
          insert_classes_one(
            object: {
              session: $session
              subject: $subject
              topic: $topic
              faculty_name: $faculty_name
              faculty_user_id: $faculty_user_id
              student_ids: $student_ids
              school_id: $school_id
              class_date: $class_date
              start_time: $start_time
              end_time: $end_time
              syllabus_link: $syllabus_link
              notes_link: $notes_link
              assignment_link: $assignment_link
            }
          ) {
            id
            session
            subject
            topic
            faculty_name
            faculty_user_id
            student_ids
            school_id
            class_date
            start_time
            end_time
            syllabus_link
            notes_link
            assignment_link
            created_at
          }
        }
      `;

      const data = await hasuraRequest(mutation, {
        session,
        subject,
        topic,
        faculty_name,
        faculty_user_id:
          faculty_user_id !== null
            ? Number(faculty_user_id)
            : null,
        student_ids,
        school_id,
        class_date,
        start_time,
        end_time,
        syllabus_link,
        notes_link,
        assignment_link,
      });

      return res.status(201).json(data.insert_classes_one);
    }

    // =====================================================
    // LIST CLASSES
    // =====================================================
    if (req.method === "GET") {
      const { school_id } = req.query;

      const query = `
        query ListClasses($where: classes_bool_exp) {
          classes(
            where: $where
            order_by: [
              { class_date: desc }
              { created_at: desc }
            ]
          ) {
            id
            session
            subject
            topic
            faculty_name
            faculty_user_id
            student_ids
            school_id
            class_date
            start_time
            end_time
            syllabus_link
            notes_link
            assignment_link
            created_at
          }
        }
      `;

      const variables = {
        where: school_id
          ? {
              school_id: {
                _eq: school_id,
              },
            }
          : {},
      };

      const data = await hasuraRequest(query, variables);

      return res.status(200).json(data.classes || []);
    }

    // =====================================================
    // UPDATE CLASS
    // =====================================================
    if (req.method === "PUT") {
      const {
        id,
        session,
        subject,
        topic = "",
        faculty_name,
        faculty_user_id = null,
        student_ids = [],
        school_id = null,
        class_date = null,
        start_time = null,
        end_time = null,
        syllabus_link = null,
        notes_link = null,
        assignment_link = null,
      } = req.body || {};

      if (!id) {
        return res.status(400).json({
          error: "Class id is required",
        });
      }

      const mutation = `
        mutation UpdateClass(
          $id:Int!
          $session:String!
          $subject:String!
          $topic:String
          $faculty_name:String!
          $faculty_user_id:Int
          $student_ids:jsonb!
          $school_id:String
          $class_date:date
          $start_time:time
          $end_time:time
          $syllabus_link:String
          $notes_link:String
          $assignment_link:String
        ) {
          update_classes_by_pk(
            pk_columns:{id:$id}
            _set:{
              session:$session
              subject:$subject
              topic:$topic
              faculty_name:$faculty_name
              faculty_user_id:$faculty_user_id
              student_ids:$student_ids
              school_id:$school_id
              class_date:$class_date
              start_time:$start_time
              end_time:$end_time
              syllabus_link:$syllabus_link
              notes_link:$notes_link
              assignment_link:$assignment_link
            }
          ) {
            id
            session
            subject
            topic
            faculty_name
            faculty_user_id
            student_ids
            school_id
            class_date
            start_time
            end_time
            syllabus_link
            notes_link
            assignment_link
            created_at
          }
        }
      `;

      const data = await hasuraRequest(mutation, {
        id: Number(id),
        session,
        subject,
        topic,
        faculty_name,
        faculty_user_id:
          faculty_user_id !== null
            ? Number(faculty_user_id)
            : null,
        student_ids,
        school_id,
        class_date,
        start_time,
        end_time,
        syllabus_link,
        notes_link,
        assignment_link,
      });

      return res.status(200).json(data.update_classes_by_pk);
    }

    // =====================================================
    // DELETE CLASS
    // =====================================================
    if (req.method === "DELETE") {
      const { id } = req.body || {};

      if (!id) {
        return res.status(400).json({
          error: "Class id is required",
        });
      }

      const mutation = `
        mutation DeleteClass($id:Int!) {
          delete_classes_by_pk(id:$id) {
            id
          }
        }
      `;

      const data = await hasuraRequest(mutation, {
        id: Number(id),
      });

      return res.status(200).json({
        success: true,
        message: "Class deleted successfully.",
        deleted: data.delete_classes_by_pk,
      });
    }

    // =====================================================
    // METHOD NOT ALLOWED
    // =====================================================
    res.setHeader(
      "Allow",
      "GET,POST,PUT,DELETE,OPTIONS"
    );

    return res.status(405).json({
      error: "Method not allowed",
    });

  } catch (err) {
    console.error("Classes API Error:", err);

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
