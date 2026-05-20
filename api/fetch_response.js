export default async function handler(req, res) {

    // Allow only POST request
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    try {

        // Get variables from frontend
        const { searchValue, examModule } = req.body;

        // GraphQL Query
        const query = `
        query GetUniqdata($searchValue: String!, $examModule: String!) {
            uniqdata(
                where: {
                    exam_module: {_eq: $examModule},
                    name: {_ilike: $searchValue}
                }
            ) {
                email
                exam_module
                name
                s_id
                id
                correct
                marks
                responses
                timedate
            }
        }`;

        // Request to Hasura
        const response = await fetch(process.env.HASURA_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-hasura-admin-secret": process.env.HASURA_SECRET
            },
            body: JSON.stringify({
                query,
                variables: {
                    searchValue: `%${searchValue}%`,
                    examModule
                }
            })
        });

        const result = await response.json();

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {

        console.error("API Error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}
