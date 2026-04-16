export default async function handler(req, res) {

    const { variables } = req.body;

    const response = await fetch(process.env.HASURA_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": process.env.HASURA_SECRET
        },
        body: JSON.stringify({
            query: `
            mutation InsertUniqdata(
                $correct: String,
                $marks: String,
                $responses: String,
                $email: String,
                $s_id: String,
                $name: String,
                $exam_module: String
            ) {
                insert_uniqdata(objects: {
                    correct: $correct,
                    marks: $marks,
                    responses: $responses,
                    email: $email,
                    s_id: $s_id,
                    exam_module: $exam_module,
                    name: $name
                }) {
                    affected_rows
                }
            }`,
            variables
        })
    });

    const data = await response.json();
    res.status(200).json(data);
}
