/**
 * READING A FILLED-IN TEMPLATE — no React, so the very same code runs in the browser (Bulk
 * Upload) and in a test against a real file.
 *
 * Finds the register's own sheet, matches its headings to the template's columns (ignoring
 * case, spaces and punctuation), types every cell (text, number, DD/MM/YYYY date) and checks
 * each row: required cells, the register's own rules (config.check) and a name used twice.
 *
 * @param XLSX   the xlsx-js-style module
 * @param data   the file's bytes (ArrayBuffer)
 * @param config one of BULK_TYPES
 * @param ctx    what config.check needs (device types, models, the user's scope, who saves)
 * @returns      { missing: [header...] } when required columns are absent, otherwise
 *               { rows: [{ rowNo, values, payload, errors, result: null }] }
 */
export function parseSheet(XLSX, data, config, ctx) {
  const book = XLSX.read(data, { cellDates: true });
  // The register's own sheet if it is there (never the hidden lists), otherwise the first.
  const sheetName = book.SheetNames.find((n) => norm(n) === norm(config.title)) ?? book.SheetNames[0];
  const grid = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: "", raw: true });
  const headerRow = (grid[0] ?? []).map(norm);

  const missing = config.columns.filter((c) => c.required && !headerRow.includes(norm(c.header)));
  if (missing.length) return { missing: missing.map((c) => c.header) };

  // Only the columns the user fills in decide whether a line is empty: the template's own
  // calculated cells (Reference No, Total Warranty) are on every line, filled in or not.
  const inputAt = config.columns
    .filter((c) => !c.auto && c.key !== "total_warranty_years")
    .map((c) => headerRow.indexOf(norm(c.header)))
    .filter((i) => i >= 0);

  const seen = new Map();
  const rows = [];
  grid.slice(1).forEach((cells, i) => {
    if (!inputAt.some((at) => String(cells[at] ?? "").trim() !== "")) return; // empty line
    const rowNo = i + 2;
    const values = {};
    const errors = [];
    config.columns.forEach((col) => {
      const at = headerRow.indexOf(norm(col.header));
      const { value, error } = readCell(XLSX, col, at >= 0 ? cells[at] : "");
      if (error) errors.push(error);
      else if (col.required && value === null) errors.push(`${col.header} is required`);
      values[col.key] = value ?? null;
    });
    const checked = config.check(values, ctx);
    errors.push(...checked.errors);

    /*
     * The same name twice in one file: only the first is kept (unless the register allows it).
     * Said ALONE — the later row is never uploaded, so its other gaps do not matter.
     */
    const nameKey = norm(values.name ?? values.server_name ?? values.product_name);
    if (nameKey && !config.allowDuplicates) {
      if (seen.has(nameKey)) {
        errors.length = 0;
        errors.push(`Already in this sheet at Excel row ${seen.get(nameKey)} — keep only one of them`);
      } else seen.set(nameKey, rowNo);
    }
    /*
     * skip: ALREADY ADDED (e.g. a device name already registered) — said FIRST, whatever else is
     * wrong with the row: it is never uploaded again, so a missing Department or the like does not
     * matter and would only hide the real reason.
     */
    const skip = checked.skip || null;
    rows.push({ rowNo, values, payload: checked.payload, errors: skip ? [] : errors, skip, result: null });
  });
  return { rows };
}

/**
 * THE SHEET'S FINGERPRINT — SHA-256 of its DATA: every filled-in row's values, in column order,
 * trimmed and in lower case. Not of the file's bytes, which change each time Excel re-saves
 * it: the same rows are the same sheet whatever the file is called. The template's own
 * calculated cells are left out.
 */
export async function sheetFingerprint(rows, config) {
  const cols = config.columns.filter((c) => !c.auto && c.key !== "total_warranty_years");
  const text = JSON.stringify([
    config.title,
    ...rows.map((r) => cols.map((c) => String(r.values[c.key] ?? "").trim().toLowerCase())),
  ]);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "Device Name", "device name", "DEVICE  NAME" all match. */
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** DD/MM/YYYY for showing a YYYY-MM-DD value. */
export const showDate = (iso) => (iso ? String(iso).split("-").reverse().join("/") : "");

/** A cell as YYYY-MM-DD: a real date, an Excel serial, DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD. */
function toIsoDate(XLSX, v) {
  if (v === null || v === undefined || v === "") return { value: null };
  const pad = (n) => String(n).padStart(2, "0");
  if (v instanceof Date && !isNaN(v)) {
    /*
     * A date cell comes back as midnight UTC of that day. Read in UTC, so a browser east of
     * Greenwich (India: UTC+5:30) never shifts it, and one west of it never moves it back.
     * Rounded to the nearest day first, as Excel stores some dates a few seconds off.
     */
    const t = new Date(Math.round(v.getTime() / 86400000) * 86400000);
    return { value: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` };
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return { value: `${d.y}-${pad(d.m)}-${pad(d.d)}` };
  }
  const s = String(v).trim();
  const notADate = { error: `"${s}" is not a date (use DD/MM/YYYY)` };
  // Only a day that exists: 31/31/2020 or 30/02/2024 is refused, not passed on.
  const real = (y, mo, d) => {
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
      ? { value: `${y}-${pad(mo)}-${pad(d)}` }
      : notADate;
  };
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return real(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return real(+m[1], +m[2], +m[3]);
  return notADate;
}

/** One cell, typed for its column; { value } or { error }. */
function readCell(XLSX, col, raw) {
  const blank = raw === null || raw === undefined || String(raw).trim() === "";
  if (blank) return { value: null };
  if (col.type === "date") return toIsoDate(XLSX, raw);
  if (col.type === "number" || col.type === "integer") {
    const n = Number(String(raw).replace(/,/g, "").trim());
    if (!Number.isFinite(n)) return { error: `${col.header} must be a number` };
    if (col.type === "integer" && !Number.isInteger(n)) return { error: `${col.header} must be a whole number` };
    return { value: n };
  }
  // A text column given a date (Excel turned "10-10" into one) is written back as DD/MM/YYYY.
  if (raw instanceof Date) return { value: showDate(toIsoDate(XLSX, raw).value) };
  return { value: String(raw).trim() };
}
