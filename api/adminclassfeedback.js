import { hasuraRequest } from "./hasura.js";

export default async function handler(req, res) {

    const query = `
    query {
      class_feedback(order_by:{created_at:desc}) {
        id
        class_id
        std_id
        rating
        feedback_text
        created_at

        user_student{
          std_id
          name
        }

        class{
          id
          subject
          class_date
          start_time
          end_time
          faculty_name
          batch_name
        }
      }
    }`;

    try{
        const data = await hasuraRequest(query);
        res.status(200).json(data.class_feedback);
    }catch(err){
        res.status(500).json({error:err.message});
    }
}
