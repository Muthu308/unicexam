import bcrypt from "bcryptjs";

export default async function handler(req, res){

    if(req.method !== 'POST'){

        return res.status(405).json({

            success:false,

            message:
                'Method Not Allowed'

        });
    }

    try{

        const {

            email_id,
            password

        } = req.body;

        const response =
            await fetch(
                process.env.HASURA_URL,
                {
                    method:'POST',

                    headers:{

                        'Content-Type':
                            'application/json',

                        'x-hasura-admin-secret':
                            process.env.HASURA_SECRET
                    },

                    body:JSON.stringify({

                        query:`

                        query(

                            $email_id:String!

                        ){

                            user_student(

                                where:{

                                    email_id:{
                                        _eq:$email_id
                                    }

                                }

                            ){

                                user_id

                                name

                                email_id

                                mobile

                                school_name

                                class

                                std_id

                                password

                            }

                        }

                        `,

                        variables:{

                            email_id
                        }

                    })
                }
            );

        const data =
            await response.json();

        const student =
            data.data.user_student[0];

        if(!student){

            return res.status(401).json({

                success:false,

                message:
                    'Invalid Email'

            });
        }

        const match =
            await bcrypt.compare(

                password,

                student.password

            );

        if(!match){

            return res.status(401).json({

                success:false,

                message:
                    'Invalid Password'

            });
        }

        delete student.password;

        return res.status(200).json({

            success:true,

            user:student

        });

    }
    catch(error){

        console.log(error);

        return res.status(500).json({

            success:false,

            message:
                'Server Error'

        });
    }
}
