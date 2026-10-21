
import { getDashboardData } from "./firebase.js";

const $ = (selector) => document.querySelector(selector);

let students = [];
let attendance = [];
let toastTimer;

const IST_TIME_ZONE = "Asia/Kolkata";
const ATTENDANCE_DEADLINE_HOUR = 17;

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

function getISTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function todayISO() {
  const p = getISTParts();
  return `${p.year}-${p.month}-${p.day}`;
}

function prettyDate(iso) {
  if (!iso) return "—";

  const date = new Date(`${iso}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
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
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => replacements[character]
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

function setConnectionStatus(connected) {
  const apiStatus = $("#api-status");
  const deviceStatus = $("#device-status");
  const dataSource = $("#data-source");
  const notice = $("#demo-notice");

  if (apiStatus) {
    apiStatus.innerHTML = connected
      ? '<i class="status-dot"></i> Connected'
      : '<i class="status-dot muted"></i> Unavailable';
  }

  if (deviceStatus) {
    deviceStatus.textContent = connected
      ? "Cloud data available"
      : "Cloud unavailable";
  }

  if (dataSource) {
    dataSource.textContent = "Firebase Firestore";
  }

  if (notice) {
    notice.hidden = connected;
  }
}

function getFilteredAttendance() {
  const query = ($("#search-input")?.value || "").trim().toLowerCase();
  const selectedDate = $("#date-filter")?.value || "";

  return [...attendance]
    .filter((row) => {
      const text = [
        row.studentName,
        row.studentId,
        row.uid,
        row.status
      ].join(" ").toLowerCase();

      return (!query || text.includes(query)) &&
        (!selectedDate || row.date === selectedDate);
    })
    .sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
    );
}

function getAttendanceForStudentOnDate(studentId, isoDate) {
  return attendance
    .filter((row) =>
      String(row.studentId) === String(studentId) &&
      row.date === isoDate &&
      String(row.status || "PRESENT").toUpperCase() === "PRESENT"
    )
    .sort((a, b) =>
      String(a.time || "").localeCompare(String(b.time || ""))
    );
}

function isWeekday(isoDate) {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function isFutureDate(isoDate) {
  return isoDate > todayISO();
}

function deadlineHasPassed(isoDate) {
  const today = todayISO();

  if (isoDate < today) return true;
  if (isoDate > today) return false;

  return Number(getISTParts().hour) >= ATTENDANCE_DEADLINE_HOUR;
}

function getDailyStatus(studentId, isoDate) {
  if (!isWeekday(isoDate)) {
    return { status: "WEEKEND", time: "" };
  }

  const checkins = getAttendanceForStudentOnDate(studentId, isoDate);

  if (checkins.length > 0) {
    return {
      status: "PRESENT",
      time: checkins[0].time || ""
    };
  }

  if (isFutureDate(isoDate)) {
    return { status: "UPCOMING", time: "" };
  }

  if (deadlineHasPassed(isoDate)) {
    return { status: "ABSENT", time: "" };
  }

  return { status: "PENDING", time: "" };
}

function statusBadge(status) {
  const normalized = String(status || "").toLowerCase();

  const labels = {
    present: "Present",
    absent: "Absent",
    pending: "Pending",
    weekend: "Weekend",
    upcoming: "Upcoming"
  };

  return `<span class="attendance-status status-${escapeHTML(normalized)}">${labels[normalized] || escapeHTML(status)}</span>`;
}

function renderStats() {
  const today = todayISO();

  const presentIds = new Set(
    attendance
      .filter((row) =>
        row.date === today &&
        String(row.status || "PRESENT").toUpperCase() === "PRESENT"
      )
      .map((row) => String(row.studentId))
  );

  const weekday = isWeekday(today);
  const afterDeadline = deadlineHasPassed(today);

  const absentCount = weekday && afterDeadline
    ? Math.max(0, students.length - presentIds.size)
    : 0;

  $("#total-students").textContent = students.length;
  $("#present-today").textContent = presentIds.size;
  $("#absent-today").textContent =
    weekday && afterDeadline ? absentCount : "—";

  const rate = students.length > 0
    ? Math.round((presentIds.size / students.length) * 100)
    : 0;

  $("#attendance-rate").textContent =
    weekday && afterDeadline ? `${rate}%` : "—";

  $("#student-count-badge").textContent =
    `${students.length} student${students.length === 1 ? "" : "s"}`;
}

function renderAttendance() {
  const rows = getFilteredAttendance();
  const body = $("#attendance-body");

  body.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <div class="student-cell">
          <span class="student-avatar">${escapeHTML(initials(row.studentName))}</span>
          <span>
            <span class="student-name">${escapeHTML(row.studentName || "Unknown student")}</span>
            <span class="student-id">ID ${escapeHTML(row.studentId || "—")}</span>
          </span>
        </div>
      </td>
      <td><span class="uid">${escapeHTML(row.uid || "—")}</span></td>
      <td>
        <span class="date-time">
          ${escapeHTML(prettyDate(row.date))}
          <small>${escapeHTML(row.time || "—")}</small>
        </span>
      </td>
      <td>${statusBadge(String(row.status || "PRESENT").toUpperCase())}</td>
    </tr>
  `).join("");

  $("#attendance-empty").hidden = rows.length > 0;

  $("#record-count").textContent =
    `${rows.length} record${rows.length === 1 ? "" : "s"}`;
}

function renderStudents() {
  const grid = $("#students-grid");

  if (!grid) return;

  grid.innerHTML = students.map((student) => `
    <article class="student-card">
      <span class="student-avatar">${escapeHTML(initials(student.name))}</span>
      <div class="student-card-info">
        <strong>${escapeHTML(student.name)}</strong>
        <small>ID ${escapeHTML(student.id)} · ${escapeHTML(student.uid || "No UID")}</small>
      </div>
    </article>
  `).join("");
}

function populateMonthlySelectors() {
  const studentSelect = $("#monthly-student");
  const monthSelect = $("#monthly-month");
  const yearSelect = $("#monthly-year");

  if (!studentSelect || !monthSelect || !yearSelect) return;

  const previousStudent = studentSelect.value;
  const previousMonth = monthSelect.value;
  const previousYear = yearSelect.value;

  studentSelect.innerHTML =
    '<option value="">Select student</option>' +
    students.map((student) => `
      <option value="${escapeHTML(student.id)}">
        ${escapeHTML(student.name)} (ID ${escapeHTML(student.id)})
      </option>
    `).join("");

  if (students.some((student) => String(student.id) === previousStudent)) {
    studentSelect.value = previousStudent;
  }

  if (!monthSelect.options.length) {
    monthSelect.innerHTML = MONTH_NAMES.map((month, index) =>
      `<option value="${index}">${month}</option>`
    ).join("");
  }

  if (!yearSelect.options.length) {
    const currentYear = Number(getISTParts().year);
    const years = [];

    for (let year = currentYear - 5; year <= currentYear + 1; year++) {
      years.push(year);
    }

    yearSelect.innerHTML = years.map((year) =>
      `<option value="${year}">${year}</option>`
    ).join("");
  }

  const now = getISTParts();

  monthSelect.value =
    previousMonth !== "" ? previousMonth : String(Number(now.month) - 1);

  yearSelect.value =
    previousYear !== "" ? previousYear : now.year;

  if (!monthSelect.value) {
    monthSelect.value = String(Number(now.month) - 1);
  }

  if (!yearSelect.value) {
    yearSelect.value = now.year;
  }
}

function renderMonthlyReport() {
  const studentId = $("#monthly-student")?.value || "";
  const monthValue = $("#monthly-month")?.value;
  const yearValue = $("#monthly-year")?.value;

  const month = Number(monthValue);
  const year = Number(yearValue);

  const student = students.find(
    (item) => String(item.id) === studentId
  );

  const body = $("#monthly-body");
  const empty = $("#monthly-empty");
  const note = $("#monthly-note");

  if (!body || !empty || !note) return;

  if (!student || monthValue === "" || yearValue === "") {
    body.innerHTML = "";
    empty.hidden = false;
    empty.textContent = "Select a student to view the report.";
    note.textContent = "Select a student to view the report.";

    $("#monthly-working").textContent = "0";
    $("#monthly-present").textContent = "0";
    $("#monthly-absent").textContent = "0";
    $("#monthly-rate").textContent = "—";

    return;
  }

  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = todayISO();

  let workingDays = 0;
  let presentDays = 0;
  let absentDays = 0;

  const rows = [];

  for (let day = 1; day <= lastDay; day++) {
    const isoDate =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (isoDate > today) continue;

    const dateObject = new Date(`${isoDate}T12:00:00Z`);

    const weekdayName = new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      weekday: "long"
    }).format(dateObject);

    const result = getDailyStatus(student.id, isoDate);

    if (result.status !== "WEEKEND") {
      workingDays++;

      if (result.status === "PRESENT") presentDays++;
      if (result.status === "ABSENT") absentDays++;
    }

    rows.push(`
      <tr>
        <td>${escapeHTML(prettyDate(isoDate))}</td>
        <td>${escapeHTML(weekdayName)}</td>
        <td>${escapeHTML(result.time || "—")}</td>
        <td>${statusBadge(result.status)}</td>
      </tr>
    `);
  }

  body.innerHTML = rows.join("");
  empty.hidden = rows.length > 0;

  const completedDays = presentDays + absentDays;

  const rate = completedDays > 0
    ? Math.round((presentDays / completedDays) * 100)
    : 0;

  $("#monthly-working").textContent = workingDays;
  $("#monthly-present").textContent = presentDays;
  $("#monthly-absent").textContent = absentDays;
  $("#monthly-rate").textContent =
    completedDays > 0 ? `${rate}%` : "—";

  note.textContent =
    "Monday–Friday are treated as working days. Absence is provisionally calculated after 5:00 PM IST. These calculated absences are not saved to Firebase.";
}

function renderAll() {
  renderStats();
  renderAttendance();
  renderStudents();
  populateMonthlySelectors();
  renderMonthlyReport();

  const lastRefresh = $("#last-refresh");

  if (lastRefresh) {
    lastRefresh.textContent = new Date().toLocaleTimeString("en-IN", {
      timeZone: IST_TIME_ZONE,
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

    students = Array.isArray(data.students) ? data.students : [];
    attendance = Array.isArray(data.attendance) ? data.attendance : [];

    console.info("AttendX dashboard loaded", {
      students: students.length,
      attendanceRecords: attendance.length
    });

    setConnectionStatus(true);
    renderAll();

    if (!quiet) {
      setToast("Dashboard refreshed from Firebase.");
    }
  } catch (error) {
    console.error("Firebase loading error:", error);
    setConnectionStatus(false);

    if (!quiet) {
      setToast("Could not load Firebase data. Check the Console.");
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function downloadCSV(filename, rows) {
  if (!rows.length) {
    setToast("There are no records to export.");
    return;
  }

  const columns = Object.keys(rows[0]);

  const quote = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    columns.map(quote).join(","),
    ...rows.map((row) =>
      columns.map((column) => quote(row[column])).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  setToast(`Exported ${rows.length} rows.`);
}

function exportCSV() {
  const rows = getFilteredAttendance().map((row) => ({
    studentId: row.studentId,
    studentName: row.studentName,
    uid: row.uid,
    date: row.date,
    time: row.time,
    status: row.status
  }));

  downloadCSV(`attendance-${todayISO()}.csv`, rows);
}

function exportMonthlyCSV() {
  const studentId = $("#monthly-student").value;
  const monthValue = $("#monthly-month").value;
  const yearValue = $("#monthly-year").value;

  const month = Number(monthValue);
  const year = Number(yearValue);

  const student = students.find(
    (item) => String(item.id) === studentId
  );

  if (!student || monthValue === "" || yearValue === "") {
    setToast("Select a student first.");
    return;
  }

  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = todayISO();
  const rows = [];

  for (let day = 1; day <= lastDay; day++) {
    const isoDate =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (isoDate > today) continue;

    const result = getDailyStatus(student.id, isoDate);

    rows.push({
      studentId: student.id,
      studentName: student.name,
      date: isoDate,
      day: new Intl.DateTimeFormat("en-IN", {
        timeZone: "UTC",
        weekday: "long"
      }).format(new Date(`${isoDate}T12:00:00Z`)),
      checkInTime: result.time,
      status: result.status
    });
  }

  downloadCSV(
    `attendx-${student.id}-${year}-${String(month + 1).padStart(2, "0")}.csv`,
    rows
  );
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((nav) => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      if (window.innerWidth <= 720) {
        $("#sidebar")?.classList.remove("open");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const today = todayISO();

  const todayLabel = $("#today-label");
  const yearLabel = $("#year");
  const dateFilter = $("#date-filter");

  if (todayLabel) todayLabel.textContent = prettyDate(today);
  if (yearLabel) yearLabel.textContent = getISTParts().year;
  if (dateFilter) dateFilter.value = today;

  populateMonthlySelectors();

  $("#search-input")?.addEventListener("input", renderAttendance);
  $("#date-filter")?.addEventListener("change", renderAttendance);

  $("#refresh-button")?.addEventListener("click", () => {
    loadDashboard();
  });

  $("#export-button")?.addEventListener("click", exportCSV);
  $("#monthly-export-button")?.addEventListener("click", exportMonthlyCSV);

  $("#monthly-student")?.addEventListener("change", renderMonthlyReport);
  $("#monthly-month")?.addEventListener("change", renderMonthlyReport);
  $("#monthly-year")?.addEventListener("change", renderMonthlyReport);

  $("#dismiss-notice")?.addEventListener("click", () => {
    $("#demo-notice").hidden = true;
  });

  $("#menu-button")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
  });

  setupNavigation();

  renderAll();
  loadDashboard({ quiet: true });

  setInterval(() => {
    const currentDate = todayISO();

    if ($("#date-filter") && $("#date-filter").value !== currentDate) {
      $("#date-filter").value = currentDate;

      if ($("#today-label")) {
        $("#today-label").textContent = prettyDate(currentDate);
      }
    }

    renderAll();
  }, 60 * 1000);
});

