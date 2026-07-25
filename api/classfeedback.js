import { hasuraRequest } from "./hasura.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // =====================================================
    // GET FEEDBACK
    //   - /api/class-feedback            -> all feedback (with joins, for admin)
    //   - /api/class-feedback?student_id=X -> feedback for one student
    // =====================================================
    if (req.method === "GET") {
      const { student_id } = req.query;

      // No student_id -> return all feedback with class info,
      // then manually join student names (no Hasura relationship exists
      // between class_feedback and user_students, so we do it here).
      if (!student_id) {
        const query = `
          query {
            class_feedback(order_by: { created_at: desc }) {
              id
              class_id
              std_id
              rating
              feedback_text
              created_at
              class {
                id
                subject
                class_date
                start_time
                end_time
                faculty_name
                topic
              }
            }
          }
        `;
        const data = await hasuraRequest(query);
        const feedback = data.class_feedback || [];

        // Collect the distinct student ids referenced in the feedback rows
        const stdIds = [...new Set(feedback.map(f => f.std_id).filter(Boolean))];

        let studentsById = {};
        if (stdIds.length) {
          const studentQuery = `
            query GetStudents($ids: [String!]) {
              user_students(where: { std_id: { _in: $ids } }) {
                std_id
                name
              }
            }
          `;
          const studentData = await hasuraRequest(studentQuery, { ids: stdIds });
          studentsById = Object.fromEntries(
            (studentData.user_students || []).map(s => [s.std_id, s])
          );
        }

        // Merge student info onto each feedback row, keeping the same
        // shape (`user_student`) the frontend already expects.
        const merged = feedback.map(f => ({
          ...f,
          user_student: studentsById[f.std_id] || null,
        }));

        return res.status(200).json(merged);
      }

      // student_id provided -> return that student's feedback only
      const query = `
        query GetFeedback($std_id: String!) {
          class_feedback(
            where: { std_id: { _eq: $std_id } }
            order_by: { created_at: desc }
          ) {
            id
            class_id
            std_id
            rating
            feedback_text
            created_at
          }
        }
      `;
      const data = await hasuraRequest(query, { std_id: student_id });
      return res.status(200).json(data.class_feedback || []);
    }

    // =====================================================
    // SAVE / UPDATE FEEDBACK
    // =====================================================
    if (req.method === "POST") {
      const { student_id, class_id, rating, feedback_text } = req.body || {};

      if (!student_id || !class_id || !rating) {
        return res.status(400).json({
          error: "student_id, class_id and rating are required",
        });
      }

      if (Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({
          error: "rating must be between 1 and 5",
        });
      }

      const mutation = `
        mutation UpsertFeedback($obj: class_feedback_insert_input!) {
          insert_class_feedback_one(
            object: $obj
            on_conflict: {
              constraint: class_feedback_class_id_std_id_key
              update_columns: [rating, feedback_text]
            }
          ) {
            id
            class_id
            std_id
            rating
            feedback_text
            created_at
          }
        }
      `;
      const data = await hasuraRequest(mutation, {
        obj: {
          class_id: Number(class_id),
          std_id: student_id,
          rating: Number(rating),
          feedback_text: feedback_text || null,
        },
      });
      return res.status(201).json(data.insert_class_feedback_one);
    }

    // =====================================================
    // METHOD NOT ALLOWED
    // =====================================================
    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Class Feedback API Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
