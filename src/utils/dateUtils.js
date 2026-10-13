// ─────────────────────────────────────────────────────────────────────────────
// Date format handling
//
// Backend storage:
//   • ALL records -> "YYYY-MM-DD" (dash, year-month-day)  e.g. 2026-06-10 = 10 June 2026
//
// Frontend display:
//   • ALWAYS "DD/MM/YYYY" (slash, day-month-year) for every record — the same as the
//     browser's own date boxes show, so typed and displayed dates read alike.
//
// The backend reads/writes "YYYY-MM-DD" only; the slash form is for display, never stored.
// ─────────────────────────────────────────────────────────────────────────────

function pad2(v) {
  return String(v).padStart(2, "0");
}

/**
 * Convert a stored backend date string into the UI format "DD/MM/YYYY".
 * Backend always stores "YYYY-MM-DD" (optionally with a time part
 * "YYYY-MM-DDTHH:mm:ss"). Date objects / generic parseable strings are
 * handled as a fallback.
 * Returns "" for empty/invalid input so the UI never shows "Invalid Date".
 */
export function formatDateForDisplay(value) {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str) return "";

  // Backend format: YYYY-MM-DD (ignore any trailing time after "T" or space)
  if (str.includes("-")) {
    const datePart = str.split("T")[0].split(" ")[0];
    const [y, m, d] = datePart.split("-");
    if (y && m && d && y.length === 4) return `${pad2(d)}/${pad2(m)}/${y}`;
  }

  // Fallback: let the engine try to parse it (Date object, ISO string, etc.)
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  }

  return str;
}

/**
 * Format a date for storing a backend record as "YYYY-MM-DD" (dash separator).
 * Accepts a Date, an ISO string, a "YYYY-MM-DD" string (e.g. from <input type="date">),
 * or nothing (defaults to today). Uses LOCAL date parts to avoid timezone day-shift.
 */
export function formatDateForBackendStore(value) {
  let dt;
  if (value instanceof Date) {
    dt = value;
  } else if (value === null || value === undefined || value === "") {
    dt = new Date();
  } else {
    const str = String(value).trim();
    // Plain YYYY-MM-DD -> build from local parts (avoid UTC shift)
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      dt = new Date(str);
    }
  }
  if (isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const day = pad2(dt.getDate());
  const month = pad2(dt.getMonth() + 1);
  return `${year}-${month}-${day}`; // YYYY-MM-DD
}

// ─── Backwards-compatible aliases (existing imports keep working) ──────────────

export function formatDateToDDMMYYYY(date) {
  return formatDateForDisplay(date);
}

/**
 * Parse any date this app produces into a real Date (local parts, no UTC shift).
 * Accepts: Date objects, backend "YYYY-MM-DD" (optionally with a time part),
 * UI "DD/MM/YYYY" (or the older "DD-MM-YYYY"), or any other string the engine can parse.
 * Returns null for empty/invalid input.
 */
export function parseAnyDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  if (!str) return null;

  // Strip any time part ("YYYY-MM-DDTHH:mm:ss" or "DD-MM-YYYY 00:00:00")
  const datePart = str.split("T")[0].split(" ")[0];
  // Dash or slash — never handed to new Date() as "03/10/2026", which reads it as 10 March.
  const parts = datePart.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD (backend)
      const [y, m, d] = parts.map(Number);
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (parts[2].length === 4) {
      // DD/MM/YYYY (UI display) or DD-MM-YYYY
      const [d, m, y] = parts.map(Number);
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }

  // Fallback: let the engine try (ISO strings, etc.)
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt;
}

// CHANGE START: value for native <input type="date"> -> YYYY-MM-DD (only format the input accepts)
export function toDateInputValue(date) {
  const d = parseAnyDate(date);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// value to SAVE to the backend/database: YYYY-MM-DD (ISO)
// (name kept as-is to avoid touching all call sites; only the output format changed)
export function toBackendDateYYYYDDMM(date) {
  const d = parseAnyDate(date);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
// CHANGE END

export function formatDateToDDMMYYYYDash(date) {
  return formatDateForDisplay(date);
}

export function DateDisplayDDMMYYYY(date) {
  return formatDateForDisplay(date);
}

export function formatDateToYYYYMMDD(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
