
 * AttendX dashboard frontend.
 * Data source: Firebase Cloud Firestore.
 *
 * Expected Firestore collections:
 *
 * students:
 * {
 *   studentId: 101,
 *   name: "Student 1",
 *   rfidUid: "B1:54:AD:0A"
 * }
 *
 * attendance:
 * {
 *   studentId: 101,
 *   attendanceDate: "2026-10-21",
 *   attendanceTime: "20:45:04",
 *   deviceId: "ESP32-01",
 *   status: "PRESENT"
 * }
 */

import { getDashboardData } from "./firebase.js";

const $ = (selector) => document.querySelector(selector);

let students = [];
let attendance = [];
let usingDemoData = false;
let toastTimer;

function todayISO() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function prettyDate(iso) {
  if (!iso) return "—";

  const date = new Date(iso + "T12:00:00");

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
  );
}

function setToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function setSource(isDemo) {
  usingDemoData = isDemo;

  const notice = $("#demo-notice");
  const dataSource = $("#data-source");
  const deviceStatus = $("#device-status");
  const apiStatus = $("#api-status");

  if (notice) notice.hidden = !isDemo;

  if (dataSource) {
    dataSource.textContent = isDemo
      ? "Sample preview"
      : "Firebase Firestore";
  }

  if (deviceStatus) {
    deviceStatus.textContent = isDemo
      ? "Preview mode"
      : "Cloud database";
  }

  if (apiStatus) {
    apiStatus.innerHTML = isDemo
      ? '<i class="status-dot muted"></i> Not connected'
      : '<i class="status-dot"></i> Connected';
  }
}

function getFilteredAttendance() {
  const query = $("#search-input").value.trim().toLowerCase();
  const selectedDate = $("#date-filter").value;

  return [...attendance]
    .filter((row) => {
      const searchableText = [
        row.studentName,
        row.studentId,
        row.uid,
        row.status
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        (!selectedDate || row.date === selectedDate)
      );
    })
    .sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
    );
}

function renderStats() {
  const today = todayISO();

  const presentIds = new Set(
    attendance
      .filter(
        (record) =>
          record.date === today &&
          String(record.status || "PRESENT").toUpperCase() ===
            "PRESENT"
      )
      .map((record) => String(record.studentId))
  );

  $("#total-students").textContent = students.length;
  $("#present-today").textContent = presentIds.size;

  $("#absent-today").textContent = Math.max(
    0,
    students.length - presentIds.size
  );

  const rate = students.length
    ? Math.round((presentIds.size / students.length) * 100)
    : 0;

  $("#attendance-rate").innerHTML =
    `${rate}<span class="value-unit">%</span>`;

  $("#student-count-badge").textContent =
    `${students.length} student${students.length === 1 ? "" : "s"}`;
}

function renderAttendance() {
  const rows = getFilteredAttendance();

  $("#attendance-body").innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>
            <div class="student-cell">
              <span class="student-avatar">
                ${escapeHTML(initials(row.studentName))}
              </span>

              <span>
                <span class="student-name">
                  ${escapeHTML(row.studentName || "Unknown student")}
                </span>

                <span class="student-id">
                  ID ${escapeHTML(row.studentId || "—")}
                </span>
              </span>
            </div>
          </td>

          <td>
            <span class="uid">
              ${escapeHTML(row.uid || "—")}
            </span>
          </td>

          <td>
            <span class="date-time">
              ${escapeHTML(prettyDate(row.date))}
              <small>${escapeHTML(row.time || "—")}</small>
            </span>
          </td>

          <td>
            <span class="badge">
              ${escapeHTML(String(row.status || "PRESENT").toUpperCase())}
            </span>
          </td>
        </tr>
      `
    )
    .join("");

  $("#attendance-empty").hidden = rows.length > 0;

  $("#record-count").textContent =
    `${rows.length} record${rows.length === 1 ? "" : "s"}`;
}

function renderStudents() {
  $("#students-grid").innerHTML = students
    .map(
      (student) => `
        <article class="student-card">
          <span class="student-avatar">
            ${escapeHTML(initials(student.name))}
          </span>

          <div class="student-card-info">
            <strong>${escapeHTML(student.name)}</strong>

            <small>
              ID ${escapeHTML(student.id)}
              · ${escapeHTML(student.uid || "No UID")}
            </small>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAll() {
  renderStats();
  renderAttendance();
  renderStudents();

  const refreshLabel = $("#last-refresh");

  if (refreshLabel) {
    refreshLabel.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

async function loadDashboard({ quiet = false } = {}) {
  const button = $("#refresh-button");

  if (button) button.disabled = true;

  try {
    const data = await getDashboardData();

    students = data.students;
    attendance = data.attendance;

    setSource(false);
    renderAll();

    if (!quiet) {
      setToast("Dashboard refreshed from Firebase.");
    }
  } catch (error) {
    console.error("Firebase loading error:", error);

    // Do not replace real data with demo records when Firebase fails.
    setSource(false);

    if (!quiet) {
      setToast("Could not load Firebase data. Check the console.");
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function exportCSV() {
  const rows = getFilteredAttendance();

  if (!rows.length) {
    setToast("There are no records to export for these filters.");
    return;
  }

  const columns = [
    "studentId",
    "studentName",
    "uid",
    "date",
    "time",
    "status"
  ];

  const quote = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => quote(row[column] ?? "")).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `attendance-${todayISO()}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  setToast(
    `Exported ${rows.length} record${rows.length === 1 ? "" : "s"} to CSV.`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  $("#today-label").textContent = new Date().toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

  $("#year").textContent = new Date().getFullYear();
  $("#date-filter").value = todayISO();

  $("#search-input").addEventListener("input", renderAttendance);
  $("#date-filter").addEventListener("change", renderAttendance);

  $("#refresh-button").addEventListener("click", () => {
    loadDashboard();
  });

  $("#export-button").addEventListener("click", exportCSV);

  $("#dismiss-notice").addEventListener("click", () => {
    $("#demo-notice").hidden = true;
  });

  $("#menu-button").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      if (window.innerWidth <= 720) {
        $("#sidebar").classList.remove("open");
      }
    });
  });

  renderAll();
  loadDashboard({ quiet: true });
});

