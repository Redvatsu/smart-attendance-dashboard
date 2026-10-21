import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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