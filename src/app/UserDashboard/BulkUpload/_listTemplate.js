/**
 * A BULK UPLOAD TEMPLATE WITH DROPDOWNS — for the registers whose dropdowns stand alone (Server,
 * Software). No React and no fetching: the panel passes the live master lists in, and the same
 * code can be run in a test.
 *
 *   lists       { columnKey: [values] } — each becomes a dropdown on that column, from a named
 *               range on a very hidden "Lists" sheet (Excel builds a list only from a range)
 *   dates       date columns: only a real date accepted, shown DD/MM/YYYY
 *   mandatory   what the Instructions sheet calls MANDATORY (the form's own required fields)
 *   notes       extra lines for the Instructions sheet
 *   unique      a column key whose value may appear only once in the sheet (e.g. Product Name):
 *               a repeated value is shaded red on every row it is on
 *   linked      { columnKey: { parent: parentKey, groups: { parentValue: [values] } } } — a
 *               dropdown that lists only the values of the parent picked in the same row
 *               (e.g. Location by Plant), as the Device template does
 *   warrantyTotal { start, end, total } column keys — the total is WORKED OUT on every row from
 *               the two dates (the ADD DEVICE / ADD SERVER rule), in the calculated light blue
 *
 * @returns the exceljs Workbook
 */
export function buildListWorkbook(
  ExcelJS,
  { title, columns, example = {}, lists = {}, notes = [], unique = null, linked = {}, warrantyTotal = null }
) {
  const FIRST = 2;
  const LAST = 1001;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  const hidden = wb.addWorksheet("Lists", { state: "veryHidden" });

  // Headings, in the dark blue of the export sheets.
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.height = 30;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333399" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  const letter = (key) => ws.getColumn(columns.findIndex((c) => c.key === key) + 1).letter;

  /*
   * All-digit values ("64", "1001") are written as NUMBERS: a value picked from a list is
   * entered as if typed, Excel stores it as a number, and a number never matches the text.
   */
  const cellValue = (v) => (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v);

  // ---- one hidden column + named range + dropdown per listed column ----
  let col = 1;
  Object.entries(lists).forEach(([key, values]) => {
    if (!columns.some((c) => c.key === key) || !values?.length) return; // nothing loaded: free to type
    const name = `L_${key}`;
    const listLetter = hidden.getColumn(col).letter;
    values.forEach((v, i) => (hidden.getCell(i + 1, col).value = cellValue(v)));
    wb.definedNames.add(`Lists!$${listLetter}$1:$${listLetter}$${values.length}`, name);
    col += 1;

    const header = columns.find((c) => c.key === key).header;
    // One rule over the whole column — how Excel itself stores a dropdown.
    ws.dataValidations.add(`${letter(key)}${FIRST}:${letter(key)}${LAST}`, {
      type: "list",
      allowBlank: true,
      formulae: [name],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: header,
      error: `Pick a ${header} from the list.`,
    });
  });

  /*
   * ---- linked dropdowns (e.g. Location by Plant) ----
   * Each parent value's list is its own named range (LK_<key>_<n>), and a two-column map
   * (LKM_<key>) gives the range name for a parent value; the cell's list is
   * INDIRECT(VLOOKUP(parent cell, map)) — so it shows only that parent's values.
   */
  Object.entries(linked).forEach(([key, { parent, groups }]) => {
    if (!columns.some((c) => c.key === key) || !columns.some((c) => c.key === parent)) return;
    const entries = Object.entries(groups ?? {});
    if (!entries.length) return; // nothing loaded: free to type
    const mapRows = [];
    entries.forEach(([parentValue, values], i) => {
      const name = `LK_${key}_${i + 1}`;
      const listLetter = hidden.getColumn(col).letter;
      const items = values?.length ? values : [""];
      items.forEach((v, r) => (hidden.getCell(r + 1, col).value = cellValue(v)));
      wb.definedNames.add(`Lists!$${listLetter}$1:$${listLetter}$${items.length}`, name);
      col += 1;
      mapRows.push([cellValue(parentValue), name]);
    });
    const a = hidden.getColumn(col).letter;
    const b = hidden.getColumn(col + 1).letter;
    mapRows.forEach(([p, n], r) => {
      hidden.getCell(r + 1, col).value = p;
      hidden.getCell(r + 1, col + 1).value = n;
    });
    wb.definedNames.add(`Lists!$${a}$1:$${b}$${mapRows.length}`, `LKM_${key}`);
    col += 2;

    const header = columns.find((c) => c.key === key).header;
    const parentHeader = columns.find((c) => c.key === parent).header;
    ws.dataValidations.add(`${letter(key)}${FIRST}:${letter(key)}${LAST}`, {
      type: "list",
      allowBlank: true,
      formulae: [`INDIRECT(VLOOKUP($${letter(parent)}${FIRST},LKM_${key},2,FALSE))`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: header,
      error: `Pick the ${parentHeader} first, then one of its ${header.toLowerCase()}s.`,
    });
  });

  // ---- date columns: a real date only, shown DD/MM/YYYY ----
  columns
    // The warranty's last date has its own rule (after the start) — one rule per cell.
    .filter((c) => c.type === "date" && !(warrantyTotal && c.key === warrantyTotal.end))
    .forEach((c) => {
      const l = letter(c.key);
      ws.dataValidations.add(`${l}${FIRST}:${l}${LAST}`, {
        type: "date",
        operator: "greaterThan",
        allowBlank: true,
        formulae: [new Date(Date.UTC(1990, 0, 1))],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: c.header,
        error: "Enter a real date as DD/MM/YYYY (e.g. 31/03/2027).",
        showInputMessage: true,
        promptTitle: c.header,
        prompt: "Enter a date as DD/MM/YYYY.",
      });
      for (let r = FIRST; r <= LAST; r++) ws.getCell(`${l}${r}`).numFmt = "dd/mm/yyyy";
    });

  /*
   * ---- TOTAL WARRANTY (IN YEARS), worked out on every row ----
   * Whole months from the start to the day after the last date, in years to two decimals —
   * blank until both are real dates and the last is after the start. Excel works it out when the
   * file opens and whenever a date changes.
   */
  if (warrantyTotal && [warrantyTotal.start, warrantyTotal.end, warrantyTotal.total].every((k) => columns.some((c) => c.key === k))) {
    wb.calcProperties = { fullCalcOnLoad: true };
    const s = letter(warrantyTotal.start);
    const e = letter(warrantyTotal.end);
    const t = letter(warrantyTotal.total);
    for (let r = FIRST; r <= LAST; r++) {
      const cell = ws.getCell(`${t}${r}`);
      cell.value = {
        formula: `IF(AND(ISNUMBER(${s}${r}),ISNUMBER(${e}${r}),${e}${r}>${s}${r}),ROUND(DATEDIF(${s}${r},${e}${r}+1,"m")/12,2),"")`,
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2FF" } };
    }
    // The last date: a real date AFTER the start (a blank start lets any real date through).
    ws.dataValidations.add(`${e}${FIRST}:${e}${LAST}`, {
      type: "custom",
      allowBlank: true,
      formulae: [`AND(ISNUMBER(${e}${FIRST}),${e}${FIRST}>$${s}${FIRST})`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: columns.find((c) => c.key === warrantyTotal.end).header,
      error: "Enter a real date as DD/MM/YYYY, after the Warranty Start Date.",
      showInputMessage: true,
      promptTitle: columns.find((c) => c.key === warrantyTotal.end).header,
      prompt: "Enter a date as DD/MM/YYYY.",
    });
  }

  // ---- the same value twice in the unique column: both rows shaded red, with red text ----
  if (unique && columns.some((c) => c.key === unique)) {
    const l = letter(unique);
    ws.addConditionalFormatting({
      ref: `${l}${FIRST}:${l}${LAST}`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [`AND(LEN(TRIM(${l}${FIRST}))>0,COUNTIF($${l}$${FIRST}:$${l}$${LAST},${l}${FIRST})>1)`],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
            font: { bold: true, color: { argb: "FF9C0006" } },
          },
        },
      ],
    });
  }

  // ---- Instructions ----
  const help = wb.addWorksheet("Instructions");
  help.columns = [{ width: 30 }, { width: 14 }, { width: 22 }, { width: 34 }];
  help.addRow(["Column", "Mandatory", "Format", "Example"]);
  columns.forEach((c) => {
    const format = c.auto
      ? "Automatic — leave it"
      : lists[c.key]?.length
      ? "Pick from the list"
      : linked[c.key]
        ? `Pick from the list (by ${columns.find((x) => x.key === linked[c.key].parent)?.header ?? "parent"})`
      : c.type === "date"
        ? "DD/MM/YYYY"
        : c.type === "number" || c.type === "integer"
          ? "Number"
          : "Text";
    const row = help.addRow([c.header, c.required ? "MANDATORY" : "Optional", format, example[c.key] ?? ""]);
    if (c.required) row.getCell(2).font = { bold: true, color: { argb: "FFC00000" } };
  });
  help.addRow([]);
  notes.forEach((line) => help.addRow([line]));
  help.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333399" } };
  });

  return wb;
}
