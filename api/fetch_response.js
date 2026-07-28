// api/tasks.js
// Single endpoint covering both `tasks` and `task_submissions`.
// Route by ?type= query param — default is "task", pass "submission"
// to operate on task_submissions instead.
//
//   TASKS
//     POST   /api/tasks                          -> create task
//     GET    /api/tasks                          -> list tasks (admin, ?school_id=)
//     GET    /api/tasks?std_id=&class_name=&school_id=  -> list tasks targeted at a student
//     PUT    /api/tasks                          -> update task
//     DELETE /api/tasks                          -> delete task (cascades its submissions)
//
//   TASK_SUBMISSIONS
//     GET    /api/tasks?type=submission&task_id=&std_id=   -> list submissions
//     POST   /api/tasks?type=submission                    -> submit work
//              (student submitting their own, OR admin submitting on a
//               student's behalf — both just pass std_id in the body,
//               there's no separate "admin submit" path needed)
//     PUT    /api/tasks?type=submission                    -> grade work (admin)
//     DELETE /api/tasks?type=submission                    -> remove one submission
//
// Requires a unique constraint on task_submissions(task_id, std_id) —
// update TASK_SUBMISSION_CONSTRAINT below to match what Hasura named it.

import { hasuraRequest } from "./hasura.js";

const TASK_SUBMISSION_CONSTRAINT = "task_submissions_task_id_std_id_key";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const isSubmission = req.query.type === "submission";

  try {
    return isSubmission
      ? await handleSubmission(req, res)
      : await handleTask(req, res);
  } catch (err) {
    console.error("Tasks API Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}

/* ══════════════════════════════════════════════════════════════════
   TASKS
══════════════════════════════════════════════════════════════════ */
async function handleTask(req, res) {
  // =====================================================
  // CREATE TASK
  // =====================================================
  if (req.method === "POST") {
    const {
      title,
      task_type,
      subject,
      total_marks,
      due_date,
      due_time,
      attachment_link,
      description,
      target_mode,
      target_class_name,
      target_school_id,
      who_create_at,
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const mutation = `
      mutation InsertTask(
        $title: String!
        $task_type: String
        $subject: String
        $total_marks: Int
        $due_date: date
        $due_time: time
        $attachment_link: String
        $description: String
        $target_mode: String
        $target_class_name: String
        $target_school_id: jsonb
        $who_create_at: String
      ) {
        insert_tasks_one(
          object: {
            title: $title
            task_type: $task_type
            subject: $subject
            total_marks: $total_marks
            due_date: $due_date
            due_time: $due_time
            attachment_link: $attachment_link
            description: $description
            target_mode: $target_mode
            target_class_name: $target_class_name
            target_school_id: $target_school_id
            who_create_at: $who_create_at
          }
        ) {
          id
          title
          task_type
          subject
          total_marks
          due_date
          due_time
          attachment_link
          description
          target_mode
          target_class_name
          target_school_id
          who_create_at
          created_at
        }
      }
    `;

    const data = await hasuraRequest(mutation, {
      title,
      task_type: task_type || "Assignment",
      subject: subject || null,
      total_marks: total_marks != null ? Number(total_marks) : null,
      due_date: due_date || null,
      due_time: due_time || null,
      attachment_link: attachment_link || null,
      description: description || null,
      target_mode: target_mode || null,
      target_class_name: target_class_name || null,
      target_school_id: target_school_id != null ? target_school_id : null,
      who_create_at: who_create_at || null,
    });

    return res.status(201).json(data.insert_tasks_one);
  }

  // =====================================================
  // LIST TASKS
  //   Admin:   GET /api/tasks?school_id=SCH001
  //   Student: GET /api/tasks?std_id=STD1001&class_name=LYMA.20&school_id=SCH001
  // =====================================================
  if (req.method === "GET") {
    const { school_id, std_id, class_name } = req.query;

    let where = {};

    if (std_id) {
      const orConditions = [
        { target_mode: { _eq: "students" }, target_school_id: { _contains: [std_id] } },
      ];
      if (class_name) {
        orConditions.push({
          target_mode: { _eq: "class" },
          target_class_name: { _eq: class_name },
        });
      }
      if (school_id) {
        orConditions.push({
          target_mode: { _eq: "school" },
          target_school_id: { _contains: [school_id] },
        });
      }
      where = { _or: orConditions };
    } else if (school_id) {
      where = { target_school_id: { _contains: [school_id] } };
    }

    const query = `
      query ListTasks($where: tasks_bool_exp) {
        tasks(where: $where, order_by: [{ created_at: desc }]) {
          id
          title
          task_type
          subject
          total_marks
          due_date
          due_time
          attachment_link
          description
          target_mode
          target_class_name
          target_school_id
          who_create_at
          created_at
        }
      }
    `;

    const data = await hasuraRequest(query, { where });

    return res.status(200).json(data.tasks || []);
  }

  // =====================================================
  // UPDATE TASK
  // =====================================================
  if (req.method === "PUT") {
    const {
      id,
      title,
      task_type,
      subject,
      total_marks,
      due_date,
      due_time,
      attachment_link,
      description,
      target_mode,
      target_class_name,
      target_school_id,
    } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Task id is required" });
    }
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const mutation = `
      mutation UpdateTask(
        $id: Int!
        $title: String!
        $task_type: String
        $subject: String
        $total_marks: Int
        $due_date: date
        $due_time: time
        $attachment_link: String
        $description: String
        $target_mode: String
        $target_class_name: String
        $target_school_id: jsonb
      ) {
        update_tasks_by_pk(
          pk_columns: { id: $id }
          _set: {
            title: $title
            task_type: $task_type
            subject: $subject
            total_marks: $total_marks
            due_date: $due_date
            due_time: $due_time
            attachment_link: $attachment_link
            description: $description
            target_mode: $target_mode
            target_class_name: $target_class_name
            target_school_id: $target_school_id
          }
        ) {
          id
          title
          task_type
          subject
          total_marks
          due_date
          due_time
          attachment_link
          description
          target_mode
          target_class_name
          target_school_id
          who_create_at
          created_at
        }
      }
    `;

    const data = await hasuraRequest(mutation, {
      id: Number(id),
      title,
      task_type: task_type || "Assignment",
      subject: subject || null,
      total_marks: total_marks != null ? Number(total_marks) : null,
      due_date: due_date || null,
      due_time: due_time || null,
      attachment_link: attachment_link || null,
      description: description || null,
      target_mode: target_mode || null,
      target_class_name: target_class_name || null,
      target_school_id: target_school_id != null ? target_school_id : null,
    });

    return res.status(200).json(data.update_tasks_by_pk);
  }

  // =====================================================
  // DELETE TASK  (cascades its submissions first)
  // =====================================================
  if (req.method === "DELETE") {
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Task id is required" });
    }

    const deleteSubmissions = `
      mutation DeleteTaskSubmissions($task_id: Int!) {
        delete_task_submissions(where: { task_id: { _eq: $task_id } }) {
          affected_rows
        }
      }
    `;
    await hasuraRequest(deleteSubmissions, { task_id: Number(id) });

    const deleteTask = `
      mutation DeleteTask($id: Int!) {
        delete_tasks_by_pk(id: $id) {
          id
        }
      }
    `;
    const data = await hasuraRequest(deleteTask, { id: Number(id) });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
      deleted: data.delete_tasks_by_pk,
    });
  }

  res.setHeader("Allow", "GET,POST,PUT,DELETE,OPTIONS");
  return res.status(405).json({ error: "Method not allowed" });
}

/* ══════════════════════════════════════════════════════════════════
   TASK_SUBMISSIONS
   Note: POST (submit) has no notion of "who" is calling it — a
   student submitting their own work and an admin submitting on a
   student's behalf hit the exact same route, just passing whichever
   std_id is relevant. Nothing to branch on.
══════════════════════════════════════════════════════════════════ */
async function handleSubmission(req, res) {
  // =====================================================
  // LIST SUBMISSIONS
  //   Admin viewing one task:     GET ?type=submission&task_id=12
  //   Student/admin viewing one student's work:  ?type=submission&std_id=STD1001
  //   Combined:                   ?type=submission&task_id=12&std_id=STD1001
  // =====================================================
  if (req.method === "GET") {
    const { task_id, std_id } = req.query;

    if (!task_id && !std_id) {
      return res.status(400).json({ error: "task_id or std_id is required" });
    }

    const where = {};
    if (task_id) where.task_id = { _eq: Number(task_id) };
    if (std_id) where.std_id = { _eq: std_id };

    const query = `
      query ListSubmissions($where: task_submissions_bool_exp) {
        task_submissions(where: $where, order_by: [{ submitted_at: asc }]) {
          id
          task_id
          std_id
          submission_link
          submission_text
          submitted_at
          marks_obtained
          feedback
          graded_at
        }
      }
    `;

    const data = await hasuraRequest(query, { where });

    return res.status(200).json(data.task_submissions || []);
  }

  // =====================================================
  // SUBMIT WORK — student or admin, same route.
  // Upserts on (task_id, std_id); only ever writes submission
  // fields, so it never clobbers an existing grade.
  // =====================================================
  if (req.method === "POST") {
    const { task_id, std_id, submission_link, submission_text } = req.body || {};

    if (!task_id || !std_id) {
      return res.status(400).json({ error: "task_id and std_id are required" });
    }

    const mutation = `
      mutation SubmitTaskWork($object: task_submissions_insert_input!) {
        insert_task_submissions_one(
          object: $object
          on_conflict: {
            constraint: ${TASK_SUBMISSION_CONSTRAINT}
            update_columns: [submission_link, submission_text, submitted_at]
          }
        ) {
          id
          task_id
          std_id
          submission_link
          submission_text
          submitted_at
          marks_obtained
          feedback
          graded_at
        }
      }
    `;

    const data = await hasuraRequest(mutation, {
      object: {
        task_id: Number(task_id),
        std_id,
        submission_link: submission_link || null,
        submission_text: submission_text || null,
        submitted_at: new Date().toISOString(),
      },
    });

    return res.status(201).json(data.insert_task_submissions_one);
  }

  // =====================================================
  // GRADE WORK — admin.
  // Upserts on (task_id, std_id); works even before a submission
  // exists (manual override). Only writes grading fields.
  // =====================================================
  if (req.method === "PUT") {
    const { task_id, std_id, marks_obtained, feedback } = req.body || {};

    if (!task_id || !std_id) {
      return res.status(400).json({ error: "task_id and std_id are required" });
    }

    const mutation = `
      mutation GradeTaskSubmission($object: task_submissions_insert_input!) {
        insert_task_submissions_one(
          object: $object
          on_conflict: {
            constraint: ${TASK_SUBMISSION_CONSTRAINT}
            update_columns: [marks_obtained, feedback, graded_at]
          }
        ) {
          id
          task_id
          std_id
          submission_link
          submission_text
          submitted_at
          marks_obtained
          feedback
          graded_at
        }
      }
    `;

    const data = await hasuraRequest(mutation, {
      object: {
        task_id: Number(task_id),
        std_id,
        marks_obtained: marks_obtained != null ? Number(marks_obtained) : null,
        feedback: feedback || null,
        graded_at: new Date().toISOString(),
      },
    });

    return res.status(200).json(data.insert_task_submissions_one);
  }

  // =====================================================
  // DELETE ONE SUBMISSION — admin removing a wrong/duplicate entry.
  // =====================================================
  if (req.method === "DELETE") {
    const { task_id, std_id } = req.body || {};

    if (!task_id || !std_id) {
      return res.status(400).json({ error: "task_id and std_id are required" });
    }

    const mutation = `
      mutation DeleteSubmission($task_id: Int!, $std_id: String!) {
        delete_task_submissions(
          where: { task_id: { _eq: $task_id }, std_id: { _eq: $std_id } }
        ) {
          affected_rows
        }
      }
    `;
    const data = await hasuraRequest(mutation, { task_id: Number(task_id), std_id });

    return res.status(200).json({
      success: true,
      affected_rows: data.delete_task_submissions?.affected_rows ?? 0,
    });
  }

  res.setHeader("Allow", "GET,POST,PUT,DELETE,OPTIONS");
  return res.status(405).json({ error: "Method not allowed" });
}
