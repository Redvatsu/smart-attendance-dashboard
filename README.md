# AttendX — Smart RFID Attendance Dashboard

A responsive dashboard frontend for an ESP32 + RC522 smart attendance project.

## Features in the frontend
- Responsive dashboard for laptop and phone
- Attendance summary cards
- Search by student name, ID, or RFID UID
- Date filter
- CSV export
- Registered-student cards
- Clearly labelled sample preview until the backend is connected

## Run locally
You can open `public/index.html` directly for a visual preview, or use a local static server for best results.

## Deploy to Vercel
1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. For this static-only preview, no build command is required.
4. Set the output directory to `public` if prompted.
5. Deploy.

## Connecting the API
The frontend requests `GET /api/attendance` and expects JSON in this format:

```json
{
  "students": [
    { "id": "101", "name": "Student 1", "uid": "B1:54:AD:0A" }
  ],
  "attendance": [
    {
      "eventId": "device-01-000001",
      "studentId": "101",
      "studentName": "Student 1",
      "uid": "B1:54:AD:0A",
      "date": "2026-10-21",
      "time": "20:45:04",
      "status": "PRESENT"
    }
  ]
}
```

Until that endpoint exists and returns the expected format, the dashboard deliberately shows sample preview data. The sample data is not real attendance.

## Security notes
- Never put Supabase service-role keys, database passwords, or device secrets in `public/app.js`.
- The frontend is display-only. The ESP32 should send records to a server-side API, which validates the device and writes to the database.
- Add authentication and server-side authorization before using real student records.
