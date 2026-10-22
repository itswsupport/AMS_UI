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
/*
 * LETTERS ONLY — ready for a field that must hold no digits (none uses it yet): typing a number
 * there says "… needs letters only — numbers are not allowed", the reverse of NUMBERS_ONLY.
 */
export const LETTERS_ONLY = {
  strip: /[^A-Za-z ]/g,
  test: /^[A-Za-z ]+$/,
  chars: LETTERS + " ",
  hint: "Letters only",
};
const PART_SERIAL = {
  strip: /[^A-Za-z0-9:-]/g,
  test: /^[A-Za-z0-9:-]+$/,
  chars: DIGITS + LETTERS + ":-",
  hint: "Letters, numbers, - and : only",
};

/*
 * ADD SERVER's free-text fields, from the server register: a model / product name such as
 * "HPE ProLiant DL380 Gen10 - P08313-B21" or "ORACLE APPS R12 + DB" — letters, numbers, spaces
 * and . - + / ( ) & , — and it has to say something: a value of only numbers or symbols ("1",
 * "6363636363") is not a type or a software name. Server-only keys (`format` on the column), so
 * ADD DEVICE's OS Service Pack and Description are not affected.
 */
const NAME_TEXT = {
  strip: /[^A-Za-z0-9 .+\-/()&,]/g,
  test: /^(?=.*[A-Za-z])[A-Za-z0-9 .+\-/()&,]+$/,
  chars: DIGITS + LETTERS + " .+-/()&,",
  hint: "Letters, numbers, spaces and . - + / ( ) & , only, with at least one letter",
};

export const FIELD_FORMATS = {
  server_type: { ...NAME_TEXT, sample: "HPE ProLiant DL380 Gen10 - P08313-B21" },
  server_software: { ...NAME_TEXT, sample: "ORACLE APPS R12 + DB" },
  // "R2", "SP1", "Service Pack 2".
  server_os_sp: {
    strip: /[^A-Za-z0-9 .-]/g,
    test: /^(?=.*[A-Za-z0-9])[A-Za-z0-9 .-]+$/,
    chars: DIGITS + LETTERS + " .-",
    hint: "Letters, numbers, spaces, . and - only",
    sample: "SP1",
  },
  /*
   * A note: any text except < and >, and not only symbols. No `chars` — too open for the Excel
   * template's character check, so the sheet leaves it to the upload's own check.
   */
  server_description: {
    strip: /[<>]/g,
    test: /^(?=.*[A-Za-z0-9])[^<>]+$/,
    chars: null,
    hint: "Any text except < and >, with at least one letter or number",
    sample: "Primary SAP application server",
  },
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

/** "letters", "numbers", "spaces", "symbols" — the kinds of character in a refused set. */
const kindsOf = (chars) => {
  const kinds = [];
  if (chars.some((ch) => /[A-Za-z]/.test(ch))) kinds.push("letters");
  if (chars.some((ch) => /[0-9]/.test(ch))) kinds.push("numbers");
  if (chars.some((ch) => ch === " ")) kinds.push("spaces");
  if (chars.some((ch) => /[^A-Za-z0-9 ]/.test(ch))) kinds.push("symbols");
  return kinds.length > 1 ? `${kinds.slice(0, -1).join(", ")} and ${kinds.at(-1)}` : kinds[0];
};

/**
 * What to say the moment a refused character is typed or pasted, naming the field and what it
 * takes: "PO No. needs numbers only — letters are not allowed", and the reverse for a
 * letters-only field: "… needs letters only — numbers are not allowed". Null when everything
 * typed fits the field (or the field has no rule).
 */
export const typedWarning = (key, raw, label = "This field") => {
  const f = FIELD_FORMATS[key];
  if (!f) return null;
  const refused = [...new Set(String(raw ?? "").match(f.strip) ?? [])];
  if (!refused.length) return null;
  return `${label} needs ${f.hint.toLowerCase()} — ${kindsOf(refused)} are not allowed.`;
};

/** Why a filled-in value does not fit its field ("PO No.: numbers only"), or null if it does. */
export const fieldFormatError = (key, label, value) => {
  const f = FIELD_FORMATS[key];
  const text = String(value ?? "").trim();
  if (!f || text === "" || f.test.test(text)) return null;
  const refused = [...new Set(text.match(f.strip) ?? [])];
  // Every character allowed, yet refused: it has no letter (or no letter / number) in it.
  if (!refused.length) return `${label} needs ${f.hint.toLowerCase()} — "${text}" is not valid`;
  return `${label} needs ${f.hint.toLowerCase()} — "${text}" has ${kindsOf(refused)}`;
};

/** The FIELD_FORMATS key a column / field is checked with: its own `format`, else its key. */
export const formatKeyOf = (column) => column?.format ?? column?.key;
