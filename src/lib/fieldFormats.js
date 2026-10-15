/**
 * WHAT EACH TYPED-IN CODE FIELD MAY HOLD — one rule, used by the ADD DEVICE / ADD SERVER forms,
 * the Bulk Upload row check and the Excel template, so a value refused on one is refused on all.
 *
 * Taken from the asset register (Asset_2026-27.xlsx):
 *
 *   PO No., Asset Code             numbers only           410000074, 1900058
 *   Service Tag, Exp. Service Code letters and numbers     FJWG9F2, 33855098798, 5CD137LYVN
 *   Server S/N                     letters and numbers     SGH910WPLN
 *   Asset S/N                      + : - .  (MAC / serial) 54:13:79:68:A7:FD
 *   Charger Adaptor, Keyboard,     + - :   (part serials)  CN-0DMR5H-CH200-769-039K-A02
 *   Mouse
 *
 * Fields picked from a master (Processor, RAM, IP Address, …) are not here: their dropdown
 * already allows only the master's values. Free-text fields (Software, Description) take anything.
 *
 *   strip   the characters removed as they are typed or pasted into the form
 *   test    the whole value, for a value that did not come through the form (an Excel row)
 *   chars   the same set for the Excel template's own check (FIND, so case-sensitive)
 */
const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const NUMBERS_ONLY = {
  strip: /[^0-9]/g,
  test: /^[0-9]+$/,
  chars: DIGITS,
  hint: "Numbers only",
};
const ALPHANUMERIC = {
  strip: /[^A-Za-z0-9]/g,
  test: /^[A-Za-z0-9]+$/,
  chars: DIGITS + LETTERS,
  hint: "Letters and numbers only (no spaces or symbols)",
};
const PART_SERIAL = {
  strip: /[^A-Za-z0-9:-]/g,
  test: /^[A-Za-z0-9:-]+$/,
  chars: DIGITS + LETTERS + ":-",
  hint: "Letters, numbers, - and : only",
};

export const FIELD_FORMATS = {
  po_no: { ...NUMBERS_ONLY, sample: "410000074" },
  asset_code: { ...NUMBERS_ONLY, sample: "1900058" },
  service_tag: { ...ALPHANUMERIC, sample: "FJWG9F2" },
  exp_service_code: { ...ALPHANUMERIC, sample: "33855098798" },
  serial_no: { ...ALPHANUMERIC, sample: "SGH910WPLN" },
  asset_sn: {
    strip: /[^A-Za-z0-9:.-]/g,
    test: /^[A-Za-z0-9:.-]+$/,
    chars: DIGITS + LETTERS + ":.-",
    hint: "Letters, numbers, : - . only",
    sample: "54:13:79:68:A7:FD",
  },
  charger: { ...PART_SERIAL, sample: "CN-0DMR5H-CH200-769-039K-A02" },
  keyboard: { ...PART_SERIAL, sample: "CN-0P5GY2-M6D00-3C9-06LW-A01" },
  mouse: { ...PART_SERIAL, sample: "CN-05NT8R-PRC00-62D-0648-A08" },
};

/** The value as the form keeps it: characters the field cannot hold are dropped as typed. */
export const cleanField = (key, value) => {
  const f = FIELD_FORMATS[key];
  return f ? String(value ?? "").replace(f.strip, "") : value;
};

/**
 * The Excel template's check: a formula true when every character of `cell` is one of `chars`.
 * FIND, so it is case-sensitive and has no wildcards (SEARCH would let "?" through). A number
 * typed into the cell is read as its digits. Works in every Excel version (no LET / TEXTSPLIT).
 */
export const onlyChars = (cell, chars) =>
  `SUMPRODUCT(--ISNUMBER(FIND(MID(${cell},ROW(INDIRECT("1:"&LEN(${cell}))),1),"${chars}")))=LEN(${cell})`;

/**
 * What to say the moment a refused character is typed or pasted: `"A" is not allowed — numbers
 * only`. Null when everything typed fits the field (or the field has no rule).
 */
export const typedWarning = (key, raw) => {
  const f = FIELD_FORMATS[key];
  if (!f) return null;
  const refused = [...new Set(String(raw ?? "").match(f.strip) ?? [])];
  if (!refused.length) return null;
  const shown = refused
    .slice(0, 3)
    .map((ch) => (ch === " " ? "Space" : `"${ch}"`))
    .join(", ");
  return `${shown} ${refused.length > 1 ? "are" : "is"} not allowed — ${f.hint.toLowerCase()}`;
};

/** Why a filled-in value does not fit its field ("PO No.: numbers only"), or null if it does. */
export const fieldFormatError = (key, label, value) => {
  const f = FIELD_FORMATS[key];
  const text = String(value ?? "").trim();
  if (!f || text === "" || f.test.test(text)) return null;
  return `${label}: ${f.hint.toLowerCase()} — "${text}" is not allowed`;
};
