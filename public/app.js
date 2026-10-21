/*
 * AttendX dashboard frontend.
 *
 * Preview mode uses clearly labelled sample data.
 * To connect a backend, expose GET /api/attendance returning:
 * {
 *   "students": [{"id":"101","name":"Student 1","uid":"B1:54:AD:0A"}],
 *   "attendance": [{
 *      "eventId":"device-01-000001",
 *      "studentId":"101",
 *      "studentName":"Student 1",
 *      "uid":"B1:54:AD:0A",
 *      "date":"2026-10-21",
 *      "time":"20:45:04",
 *      "status":"PRESENT"
 *   }]
 * }
 *
 * This frontend does not write to Supabase directly and contains no secrets.
 */
const $ = (selector) => document.querySelector(selector);

const sampleStudents = [
  { id: "101", name: "Student 1", uid: "B1:54:AD:0A" },
  { id: "102", name: "Student 2", uid: "30:5E:8E:53" }
];

const sampleAttendance = [
  { eventId: "demo-002", studentId: "102", studentName: "Student 2", uid: "30:5E:8E:53", date: "2026-10-21", time: "20:45:07", status: "PRESENT" },
  { eventId: "demo-001", studentId: "101", studentName: "Student 1", uid: "B1:54:AD:0A", date: "2026-10-21", time: "20:45:04", status: "PRESENT" }
];

let students = sampleStudents;
let attendance = sampleAttendance;
let usingDemoData = true;
let toastTimer;

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function prettyDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function setToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function setSource(isDemo) {
  usingDemoData = isDemo;
  $("#demo-notice").hidden = !isDemo;
  $("#data-source").textContent = isDemo ? "Sample preview" : "Cloud API";
  $("#device-status").textContent = isDemo ? "Preview mode" : "API connected";
  $("#api-status").innerHTML = isDemo
    ? '<i class="status-dot muted"></i> Not connected'
    : '<i class="status-dot"></i> Connected';
}
function getFilteredAttendance() {
  const query = $("#search-input").value.trim().toLowerCase();
  const date = $("#date-filter").value;
  return [...attendance].filter(row => {
    const haystack = [row.studentName, row.studentId, row.uid, row.status].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!date || row.date === date);
  }).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}
function renderStats() {
  const today = todayISO();
  const presentIds = new Set(attendance.filter(a => a.date === today && String(a.status || "PRESENT").toUpperCase() === "PRESENT").map(a => String(a.studentId)));
  $("#total-students").textContent = students.length;
  $("#present-today").textContent = presentIds.size;
  $("#absent-today").textContent = Math.max(0, students.length - presentIds.size);
  const rate = students.length ? Math.round((presentIds.size / students.length) * 100) : 0;
  $("#attendance-rate").innerHTML = `${rate}<span class="value-unit">%</span>`;
  $("#student-count-badge").textContent = `${students.length} student${students.length === 1 ? "" : "s"}`;
}
function renderAttendance() {
  const rows = getFilteredAttendance();
  $("#attendance-body").innerHTML = rows.map(row => `
    <tr>
      <td><div class="student-cell"><span class="student-avatar">${escapeHTML(initials(row.studentName))}</span>
        <span><span class="student-name">${escapeHTML(row.studentName || "Unknown student")}</span><span class="student-id">ID ${escapeHTML(row.studentId || "—")}</span></span></div></td>
      <td><span class="uid">${escapeHTML(row.uid || "—")}</span></td>
      <td><span class="date-time">${escapeHTML(prettyDate(row.date))}<small>${escapeHTML(row.time || "—")}</small></span></td>
      <td><span class="badge">${escapeHTML(String(row.status || "PRESENT").toUpperCase())}</span></td>
    </tr>`).join("");
  $("#attendance-empty").hidden = rows.length > 0;
  $("#record-count").textContent = `${rows.length} record${rows.length === 1 ? "" : "s"}`;
}
function renderStudents() {
  $("#students-grid").innerHTML = students.map(student => `
    <article class="student-card">
      <span class="student-avatar">${escapeHTML(initials(student.name))}</span>
      <div class="student-card-info"><strong>${escapeHTML(student.name)}</strong><small>ID ${escapeHTML(student.id)} · ${escapeHTML(student.uid || "No UID")}</small></div>
    </article>`).join("");
}
function renderAll() {
  renderStats();
  renderAttendance();
  renderStudents();
  $("#last-refresh").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
async function loadDashboard({ quiet = false } = {}) {
  const button = $("#refresh-button");
  button.disabled = true;
  try {
    const response = await fetch("/api/attendance", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.students) || !Array.isArray(data.attendance)) {
      throw new Error("API response must include students and attendance arrays");
    }
    students = data.students;
    attendance = data.attendance;
    setSource(false);
    renderAll();
    if (!quiet) setToast("Dashboard refreshed from the cloud API.");
  } catch (error) {
    students = sampleStudents;
    attendance = sampleAttendance;
    setSource(true);
    renderAll();
    if (!quiet) setToast("API isn't connected yet. Showing sample preview data.");
    console.info("AttendX is in preview mode:", error.message);
  } finally {
    button.disabled = false;
  }
}
function exportCSV() {
  const rows = getFilteredAttendance();
  if (!rows.length) {
    setToast("There are no records to export for these filters.");
    return;
  }
  const columns = ["studentId", "studentName", "uid", "date", "time", "status"];
  const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [columns.join(","), ...rows.map(row => columns.map(col => quote(row[col] ?? "")).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setToast(`Exported ${rows.length} record${rows.length === 1 ? "" : "s"} to CSV.`);
}
document.addEventListener("DOMContentLoaded", () => {
  $("#today-label").textContent = new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  $("#year").textContent = new Date().getFullYear();
  $("#date-filter").value = todayISO();
  $("#search-input").addEventListener("input", renderAttendance);
  $("#date-filter").addEventListener("change", renderAttendance);
  $("#refresh-button").addEventListener("click", () => loadDashboard());
  $("#export-button").addEventListener("click", exportCSV);
  $("#dismiss-notice").addEventListener("click", () => { $("#demo-notice").hidden = true; });
  $("#menu-button").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
    item.classList.add("active");
    if (window.innerWidth <= 720) $("#sidebar").classList.remove("open");
  }));
  renderAll();
  loadDashboard({ quiet: true });
});
