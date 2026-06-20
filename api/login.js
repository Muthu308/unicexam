export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method Not Allowed",
    });
  }

  try {
    const { email_id, password } = req.body;

    if (!email_id || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/Student ID and Password are required",
      });
    }

    const response = await fetch(process.env.HASURA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": process.env.HASURA_SECRET,
      },
      body: JSON.stringify({
        query: `
          query GetStudent($value: String!) {
            user_student(
              where: {
                _or: [
                { email_id: { _eq: $value } },
                { std_id: { _eq: $value } }
                ]
              }
            ) {
              user_id
              name
              email_id
              mobile
              dob
              school_name
              class_name
              std_id
              password
            }
          }
        `,
        variables: {
          email_id,
        },
      }),
    });

    const data = await response.json();

    //console.log("HASURA RESPONSE:", JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error("HASURA ERRORS:", data.errors);

      return res.status(500).json({
        success: false,
        message: "Hasura Query Failed",
        errors: data.errors,
      });
    }

    if (!data.data || !data.data.user_student) {
      return res.status(500).json({
        success: false,
        message: "Invalid Hasura Response",
      });
    }

    const student = data.data.user_student[0];

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Invalid Email or Student ID",
      });
    }

    const match = password === student.password;

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid Password",
      });
    }

    const { password: _, ...user } = student;

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server Error",
    });
  }
}
