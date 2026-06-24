const HASURA_URL = process.env.HASURA_URL;
const HASURA_SECRET = process.env.HASURA_SECRET;

async function hasura(query, variables = {}) {
  const response = await fetch(HASURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": HASURA_SECRET
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.errors?.[0]?.message ||
      `HTTP ${response.status}`
    );
  }

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

const GQL = {
  LIST_USERS: `
    query {
      user_student(order_by:{user_id:desc}) {
        user_id
        name
        email_id
        mobile
        school_name
        school_id
        class_name
        std_id
        dob
        active_status
        user_role
        created_at
      }
    }
  `,

  GET_USER: `
    query GetUser($user_id:Int!) {
      user_student_by_pk(user_id:$user_id) {
        user_id
        name
        email_id
        mobile
        school_name
        school_id
        class_name
        std_id
        dob
        active_status
        user_role
      }
    }
  `,

  CREATE_USER: `
    mutation CreateUser($object:user_student_insert_input!) {
      insert_user_student_one(object:$object) {
        user_id
      }
    }
  `,

  UPDATE_USER: `
    mutation UpdateUser(
      $user_id:Int!,
      $set:user_student_set_input!
    ) {
      update_user_student_by_pk(
        pk_columns:{user_id:$user_id}
        _set:$set
      ) {
        user_id
      }
    }
  `,

  DELETE_USER: `
    mutation DeleteUser($user_id:Int!) {
      delete_user_student_by_pk(user_id:$user_id) {
        user_id
      }
    }
  `
};

export default async function handler(req, res) {
  try {
    const { action, payload } = req.body || {};

    let result;

    switch (action) {
      case "list":
        result = await hasura(GQL.LIST_USERS);
        return res.status(200).json(result.user_student);

      case "get":
        result = await hasura(
          GQL.GET_USER,
          { user_id: payload.user_id }
        );
        return res.status(200).json(
          result.user_student_by_pk
        );

      case "create":
        result = await hasura(
          GQL.CREATE_USER,
          { object: payload }
        );
        return res.status(200).json(
          result.insert_user_student_one
        );

      case "update":
        result = await hasura(
          GQL.UPDATE_USER,
          {
            user_id: payload.user_id,
            set: payload.set
          }
        );
        return res.status(200).json(
          result.update_user_student_by_pk
        );

      case "delete":
        result = await hasura(
          GQL.DELETE_USER,
          {
            user_id: payload.user_id
          }
        );
        return res.status(200).json(
          result.delete_user_student_by_pk
        );

      default:
        return res.status(400).json({
          error: "Invalid action"
        });
    }
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
