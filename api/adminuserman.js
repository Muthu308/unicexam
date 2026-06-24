async function hasura(query, variables = {}) {

  const res = await fetch(
    HASURA_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret":
          HASURA_SECRET
      },
      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}`
    );
  }

  const json =
    await res.json();

  if (json.errors) {
    throw new Error(
      json.errors[0].message
    );
  }

  return json.data;
}

const GQL = {

  LIST_USERS: `
    query {

      user_student(
        order_by:{
          user_id:desc
        }
      ) {

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
    query GetUser(
      $user_id:Int!
    ){

      user_student_by_pk(
        user_id:$user_id
      ){

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
    mutation CreateUser(
      $object:user_student_insert_input!
    ){

      insert_user_student_one(
        object:$object
      ){
        user_id
      }

    }
  `,

  UPDATE_USER: `
    mutation UpdateUser(
      $user_id:Int!,
      $set:user_student_set_input!
    ){

      update_user_student_by_pk(
        pk_columns:{
          user_id:$user_id
        }
        _set:$set
      ){
        user_id
      }

    }
  `,

  DELETE_USER: `
    mutation DeleteUser(
      $user_id:Int!
    ){

      delete_user_student_by_pk(
        user_id:$user_id
      ){
        user_id
      }

    }
  `
};

const API = {

  async getUsers() {

    const data =
      await hasura(
        GQL.LIST_USERS
      );

    return data.user_student;
  },

  async getUser(user_id) {

    const data =
      await hasura(
        GQL.GET_USER,
        { user_id }
      );

    return data.user_student_by_pk;
  },

  async createUser(fields) {

    const data =
      await hasura(
        GQL.CREATE_USER,
        {
          object: fields
        }
      );

    return data.insert_user_student_one;
  },

  async updateUser(
    user_id,
    set
  ) {

    const data =
      await hasura(
        GQL.UPDATE_USER,
        {
          user_id,
          set
        }
      );

    return data.update_user_student_by_pk;
  },

  async deleteUser(
    user_id
  ) {

    const data =
      await hasura(
        GQL.DELETE_USER,
        {
          user_id
        }
      );

    return data.delete_user_student_by_pk;
  }

};
