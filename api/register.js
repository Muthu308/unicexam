//import bcrypt from "bcryptjs";

export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            success:false,
            message:"Method not allowed"
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

        // CHECK EMAIL

        const checkResponse =
            await fetch(
                process.env.HASURA_URL,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json",

                        "x-hasura-admin-secret":
                            process.env.HASURA_SECRET
                    },

                    body:JSON.stringify({

                        query:`

                        query($email_id:String!){

                            user_student(

                                where:{

                                    email_id:{
                                        _eq:$email_id
                                    }

                                }

                            ){

                                user_id

                            }

                        }

                        `,

                        variables:{
                            email_id
                        }

                    })
                }
            );

        const checkData =
            await checkResponse.json();
       

        if(
            checkData.data.user_student.length
            > 0
        ){

            return res.status(400).json({

                success:false,

                message:
                    "Email already exists"

            });
        }

        // HASH PASSWORD
const hashedPassword = password;
     //   const hashedPassword =
        //    await bcrypt.hash(
      //          password,
      //          10
      //      );

        // INSERT

        const insertResponse =
            await fetch(
                process.env.HASURA_URL,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json",

                        "x-hasura-admin-secret":
                            process.env.HASURA_SECRET
                    },

                    body:JSON.stringify({

                        query:`

                        mutation(

                            $email_id:String!

                            $password:String!

                            $name:String!

                            $school_name:String!

                            $mobile:Int!

                            $class_name:String!

                            $school_venue:String

                            $std_id:String

                            $dob:date

                        ){

                            insert_user_student_one(

                                object:{

                                    email_id:
                                        $email_id

                                    password:
                                        $password

                                    name:
                                        $name

                                    school_name:
                                        $school_name

                                    mobile:
                                        $mobile

                                    class:
                                        $class_name

                                    school_venue:
                                        $school_venue

                                    std_id:
                                        $std_id

                                    dob:
                                        $dob

                                }

                            ){

                                user_id

                            }

                        }

                        `,

                        variables:{

                            email_id,

                            password:
                                hashedPassword,

                            name,

                            school_name,

                            mobile:
                                parseInt(mobile),

                            class_name,

                            school_venue,

                            std_id,

                            dob:
                                dob || null
                        }

                    })

                }
            );

        const insertData =
            await insertResponse.json();

       
        if(insertData.errors){

            return res.status(400).json({
                success:false,
                errors:insertData.errors
            });
        }

        return res.status(200).json({

            success:true,

            message:
                "Registration Successful"

        });

    }
    catch(error){

        console.log(error);

        return res.status(500).json({

            success:false,

            message:"Server Error"

        });
    }
}
