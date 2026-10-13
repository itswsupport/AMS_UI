/**
 * WARRANTY TERM, shown as YEARS.MONTHS ("1.10" = 1 year 10 months) instead of a decimal (1.83).
 *
 * The months are exact when both dates are known — the same rule the total itself is worked out
 * with: whole months from the start to the day after the last date (01/10/2024 to 31/07/2026 is
 * 1 Year 10 Months). A record with no start date (saved before it existed) is shown from its
 * recorded total, to the nearest month.
 */

/** Whole months from start to the day after end (YYYY-MM-DD), or null when not both / not after. */
export function warrantyMonths(start, end) {
  if (!start || !end || end <= start) return null;
  const [sy, sm, sd] = String(start).slice(0, 10).split("-").map(Number);
  const [ey, em, ed] = String(end).slice(0, 10).split("-").map(Number);
  const after = new Date(ey, em - 1, ed + 1);
  let months = (after.getFullYear() - sy) * 12 + (after.getMonth() + 1 - sm);
  if (after.getDate() < sd) months -= 1;
  return months > 0 ? months : null;
}

/**
 * AGE (in years) — the asset sheet's own formula, =(TODAY()-[Last Date Of Warrantee])/365+[Total
 * Warranty (In Years)]: the years since the warranty ended, plus the warranty's years — so how
 * old the device is today. Two decimals (9.99), as the sheet shows it. Worked out on every read,
 * never stored, since it changes each day. "" without both values.
 */
export function deviceAge(lastDate, totalYears, today = new Date()) {
  const n = Number(totalYears);
  if (!lastDate || totalYears === "" || totalYears === null || totalYears === undefined || !Number.isFinite(n)) return "";
  const [y, m, d] = String(lastDate).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const last = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return ((now - last) / 86400000 / 365 + n).toFixed(2);
}

/**
 * THE START DATE OF A RECORD SAVED WITHOUT ONE — worked back from its last date and its total:
 * the day after the last date, less the warranty's months (the same rule as the total, in
 * reverse). Last 28/10/2025 with 4 years 10 months (58 months) gives 29/12/2020. "" when it
 * cannot be worked out.
 */
export function deriveWarrantyStart(end, totalYears) {
  const n = Number(totalYears);
  if (!end || totalYears === "" || totalYears === null || !Number.isFinite(n) || n <= 0) return "";
  const months = Math.round(n * 12);
  const [ey, em, ed] = String(end).slice(0, 10).split("-").map(Number);
  if (!ey || !em || !ed) return "";
  const start = new Date(ey, em - 1 - months, ed + 1);
  const pad = (v) => String(v).padStart(2, "0");
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/**
 * YEARS.MONTHS — the whole years, a dot, then the months left over (0 to 11), for a field titled
 * "Total Warranty (Years & Months)": 1 year 7 months is "1.7", 1 year 10 months "1.10",
 * 3 years "3.0", 8 months "0.8". Not a decimal — "1.10" is NOT less than "1.7". "" when nothing
 * to show.
 */
export function formatWarranty(start, end, totalYears) {
  let months = warrantyMonths(start, end);
  if (months === null && totalYears !== "" && totalYears !== null && totalYears !== undefined) {
    const n = Number(totalYears);
    if (Number.isFinite(n) && n > 0) months = Math.round(n * 12);
  }
  if (!months) return "";
  return `${Math.floor(months / 12)}.${months % 12}`;
}
