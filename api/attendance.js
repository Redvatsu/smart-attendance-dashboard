import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables are not configured."
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        student_id,
        attendance_date,
        attendance_time,
        device_id,
        students (
          name,
          rfid_uid
        )
      `)
      .order("attendance_date", { ascending: false })
      .order("attendance_time", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ attendance: data });
  }

  return res.status(405).json({
    error: "Method not allowed."
  });
}