```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Replace these placeholders with your Firebase web app configuration.
const firebaseConfig = {
  apiKey: "AIzaSyBazEGNdZt9dRq9norwjdNUwPQ5JOquFY0",
  authDomain: "smart-attendance-system-96252.firebaseapp.com",
  projectId: "smart-attendance-system-96252",
  storageBucket: "smart-attendance-system-96252.firebasestorage.appUR_STORAGE_BUCKET",
  messagingSenderId: "463352249748",
  appId: "1:463352249748:web:33e56b01499f558d0b6381"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

/**
 * Retrieve students and attendance from Cloud Firestore.
 */
export async function getDashboardData() {
  const [studentsSnapshot, attendanceSnapshot] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "attendance"))
  ]);

  const students = studentsSnapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: String(data.studentId ?? doc.id),
      name: data.name ?? "Unknown student",
      uid: data.rfidUid ?? ""
    };
  });

  const studentsById = new Map(
    students.map((student) => [student.id, student])
  );

  const attendance = attendanceSnapshot.docs.map((doc) => {
    const data = doc.data();

    const studentId = String(data.studentId ?? "");
    const student = studentsById.get(studentId);

    return {
      eventId: doc.id,
      studentId,
      studentName:
        data.studentName ?? student?.name ?? "Unknown student",
      uid: data.rfidUid ?? data.uid ?? student?.uid ?? "",
      date: data.attendanceDate ?? data.date ?? "",
      time: data.attendanceTime ?? data.time ?? "",
      status: String(data.status ?? "PRESENT").toUpperCase()
    };
  });

  return { students, attendance };
}
```
