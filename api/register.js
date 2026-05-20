export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const {
            email_id,
            password,
            name,
            school_name,
            mobile,
            class_name,
            school_venue,
            std_id,
            dob
        } = req.body;

        // CHECK EMAIL EXISTS
        const checkResponse = await fetch(
            process.env.HASURA_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-hasura-admin-secret":
                        process.env.HASURA_SECRET
                },
                body: JSON.stringify({
                    query: `
                    query CheckStudent($email_id:String!) {
                        user_student(
                            where:{
                                email_id:{_eq:$email_id}
                            }
                        ) {
                            id
                        }
                    }`,
                    variables: {
                        email_id
                    }
                })
            }
        );

        const checkData =
            await checkResponse.json();

        // ALREADY EXISTS
        if (
            checkData.data.students.length > 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Email already registered"
            });
        }

        // INSERT STUDENT
        const insertResponse = await fetch(
            process.env.HASURA_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-hasura-admin-secret":
                        process.env.HASURA_SECRET
                },
                body: JSON.stringify({
                    query: `
                    mutation InsertStudent(
                        $email_id:String!,
                        $password:String!,
                        $name:String!,
                        $school_name:String!,
                        $mobile:String!,
                        $class_name:String!,
                        $school_venue:String!,
                        $std_id:String!,
                        $dob:Date!
                    ) {

                        insert_user_student_one(
                            object:{
                                email_id:$email_id,
                                password:$password,
                                name:$name,
                                school_name:$school_name,
                                mobile:$mobile,
                                class:$class_name,
                                school_venue:$school_venue,
                                std_id:$std_id,
                                dob:$dob
                            }
                        ) {
                            id
                        }
                    }`,
                    variables: {
                        email_id,
                        password,
                        name,
                        school_name,
                        mobile,
                        class_name,
                        school_venue,
                        std_id,
                        dob
                    }
                })
            }
        );

        const insertData =
            await insertResponse.json();

        return res.status(200).json({
            success: true,
            message:
                "Registration successful"
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            error: "Server Error"
        });
    }
}
