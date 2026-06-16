export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  let checkData = null;
  let insertData = null;

  try {
    if (!process.env.HASURA_URL || !process.env.HASURA_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const {
      email_id,
      password,
      name,
      school_name,
      mobile,
      class_name,
      school_venue,
      std_id,
      dob,
    } = req.body;

    console.log("Incoming Body:", req.body);

    // Required field validation
    if (
      !email_id ||
      !password ||
      !name ||
      !school_name ||
      !mobile ||
      !class_name
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // Convert DOB to YYYY-MM-DD
    let formattedDob = null;

    if (dob) {
      const dobStr = String(dob).trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
        // Already YYYY-MM-DD
        formattedDob = dobStr;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) {
        // DD/MM/YYYY
        const [day, month, year] = dobStr.split("/");
        formattedDob = `${year}-${month}-${day}`;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(dobStr)) {
        // DD-MM-YYYY
        const [day, month, year] = dobStr.split("-");
        formattedDob = `${year}-${month}-${day}`;
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Invalid DOB format. Use YYYY-MM-DD or DD/MM/YYYY",
        });
      }
    }

    // Check existing email
    const checkResponse = await fetch(process.env.HASURA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": process.env.HASURA_SECRET,
      },
      body: JSON.stringify({
        query: `
          query CheckStudent($email_id: String!) {
            user_student(
              where: {
                email_id: {
                  _eq: $email_id
                }
              }
            ) {
              user_id
            }
          }
        `,
        variables: {
          email_id,
        },
      }),
    });

    checkData = await checkResponse.json();

    console.log(
      "Check Data:",
      JSON.stringify(checkData, null, 2)
    );

    if (checkData.errors) {
      return res.status(400).json({
        success: false,
        errors: checkData.errors,
      });
    }

    if (checkData.data?.user_student?.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // Insert student
    const insertResponse = await fetch(process.env.HASURA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": process.env.HASURA_SECRET,
      },
      body: JSON.stringify({
        query: `
          mutation RegisterStudent(
            $email_id: String!,
            $password: String!,
            $name: String!,
            $school_name: String!,
            $mobile: String!,
            $class_name: String!,
            $school_venue: String,
            $std_id: String,
            $dob: date
          ) {
            insert_user_student_one(
              object: {
                email_id: $email_id,
                password: $password,
                name: $name,
                school_name: $school_name,
                mobile: $mobile,
                class_name: $class_name,
                school_venue: $school_venue,
                std_id: $std_id,
                dob: $dob
              }
            ) {
              user_id
            }
          }
        `,
        variables: {
          email_id,
          password,
          name,
          school_name,
          mobile,
          class_name,
          school_venue: school_venue || null,
          std_id: std_id || null,
          dob: formattedDob,
        },
      }),
    });

    insertData = await insertResponse.json();

    console.log(
      "Insert Data:",
      JSON.stringify(insertData, null, 2)
    );

    if (
      insertData.errors ||
      !insertData.data?.insert_user_student_one
    ) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        errors: insertData.errors || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Registration Successful",
      user_id:
        insertData.data.insert_user_student_one.user_id,
    });
  } catch (error) {
    console.error("Register Error:", error);
    console.error("Check Data:", checkData);
    console.error("Insert Data:", insertData);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
}
