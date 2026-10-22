/**
 * WHAT A SOFTWARE ENTRY MUST SATISFY — one rule set for ADD SOFTWARE and Bulk Upload, taken
 * from the register's SOFTWARE sheet (Asset_2026-27.xlsx):
 *
 *   Total Licenses Acquired       filled on every product; a whole number of at most 2 digits
 *                                 (0 to 99) — and Excess / Deficiency likewise (−99 to 99)
 *   License Excess or Deficiency  filled on every product; a whole number, negative for a
 *                                 deficiency (Windows 10 Preload: 255 − 275 = −20). It is
 *                                 Total Licenses − Installations, so it can never be MORE than
 *                                 Total Licenses Acquired.
 *   Renewal Date                  a Subscription renews (Office 365 → Dec-25), so it needs a
 *                                 date; a Perpetual licence never renews ("N.A." on every
 *                                 Perpetual row), so it has none.
 *
 * `v` holds the values as the form / sheet gives them: numbers as numbers or digit strings,
 * the date as YYYY-MM-DD. Returns { key: message }; empty when the entry is right.
 */
/** Both counts are at most 2 digits: Total 0 to 99, Excess / Deficiency −99 to 99. */
export const LICENSE_MAX = 99;
export const LICENSE_DIGITS = 2;

const isBlank = (x) => x === null || x === undefined || String(x).trim() === "";

/** A whole number (optionally negative) as text or a number, within ±LICENSE_MAX. */
const wholeNumber = (x, allowNegative) => {
  const s = String(x).trim();
  if (!(allowNegative ? /^-?\d+$/ : /^\d+$/).test(s)) return null;
  const n = Number(s);
  return Math.abs(n) <= LICENSE_MAX ? n : null;
};

export function softwareErrors(v) {
  const out = {};

  let total = null;
  if (isBlank(v.total_licenses_acquired)) {
    out.total_licenses_acquired = "Total Licenses Acquired is required.";
  } else {
    total = wholeNumber(v.total_licenses_acquired, false);
    if (total === null) {
      out.total_licenses_acquired = `Total Licenses Acquired must be a whole number of at most 2 digits (0 to ${LICENSE_MAX}).`;
    }
  }

  if (isBlank(v.license_excess_deficiency)) {
    out.license_excess_deficiency = "License Excess or Deficiency is required.";
  } else {
    const excess = wholeNumber(v.license_excess_deficiency, true);
    if (excess === null) {
      out.license_excess_deficiency = `License Excess or Deficiency must be a whole number of at most 2 digits (-${LICENSE_MAX} to ${LICENSE_MAX}).`;
    } else if (total !== null && excess > total) {
      out.license_excess_deficiency = `License Excess (${excess}) cannot be more than Total Licenses Acquired (${total}).`;
    }
  }

  const type = String(v.license_type ?? "").trim().toLowerCase();
  const date = String(v.renewal_date ?? "").trim().slice(0, 10);
  if (date) {
    const year = Number(date.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || year < 1990 || year > 2100) {
      out.renewal_date = "Enter a real Renewal Date (year 1990 to 2100).";
    } else if (type.includes("perpetual")) {
      out.renewal_date = "A Perpetual licence does not renew — leave Renewal Date empty.";
    }
  } else if (type.includes("subscription")) {
    out.renewal_date = "Renewal Date is required for a Subscription licence.";
  }

  return out;
}
