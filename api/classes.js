// api/classes.js
// POST -> Admin creates a new class (session, subject, topic, faculty_name, student_ids[])
// GET  -> List all classes (used by Admin dashboard and Faculty class picker)

import { hasuraRequest } from "/hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      const {
        session,
        subject,
        topic,
        faculty_name,
        faculty_user_id,
        student_ids,
        school_id,
        class_date,
        start_time,
        end_time,
        syllabus_link,
        notes_link,
        assignment_link,
      } = req.body || {};

      if (
        !session ||
        !subject ||
        !faculty_name ||
        !Array.isArray(student_ids) ||
        student_ids.length === 0
      ) {
        return res.status(400).json({
          error:
            "session, subject, faculty_name and a non-empty student_ids array are required",
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
        topic: topic || "",
        faculty_name,
        faculty_user_id: faculty_user_id ? Number(faculty_user_id) : null,
        student_ids,
        school_id: school_id || null,
        class_date: class_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        syllabus_link: syllabus_link || null,
        notes_link: notes_link || null,
        assignment_link: assignment_link || null,
      });

      return res.status(200).json(data.insert_classes_one);
    }

    if (req.method === "GET") {
      const { school_id } = req.query;
      const query = `
        query ListClasses($where: classes_bool_exp) {
          classes(where: $where, order_by: { class_date: desc, created_at: desc }) {
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
      const where = school_id ? { school_id: { _eq: school_id } } : {};
      const data = await hasuraRequest(query, { where });
      return res.status(200).json(data.classes);
    }

    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
