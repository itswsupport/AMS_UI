/**
 * THE DEVICE TEMPLATE WORKBOOK — built from data, with no React and no fetching, so the very
 * same code runs in the browser (Bulk Upload) and in a test against live data.
 *
 * Dropdowns, all from a very hidden "Lists" sheet of named ranges (Excel can only build a list
 * from a range):
 *
 *   Device Type -> Model -> Device Name   linked: INDIRECT(VLOOKUP(...)) through TypeMap / ModelMap
 *   Plant -> Department / Location        linked: through DeptMap / LocMap
 *   Processor, RAM, HDD, System Type,     plain lists from their masters
 *   OS, IP Address, Device Status,
 *   Warranty Status
 *
 * Calculated (light blue): Reference No from the picked Device Name (RefMap), and Total
 * Warranty from the two warranty dates.
 *
 * @param ExcelJS the exceljs module
 * @param d       { title, columns, devices, models, statusByType, masters, scope }
 *                masters: { processors, rams, hdds, oses, systemTypes, warranties, ips,
 *                           deviceStatuses, plantRows, departmentRows, locationRows }
 * @returns       the exceljs Workbook
 */
import { deviceFieldRules } from "../LaptopDesktop/_deviceFields";
import { FIELD_FORMATS, onlyChars } from "../../../lib/fieldFormats";

export function buildDeviceWorkbook(ExcelJS, d) {
  const { title, columns: allColumns, devices, models, statusByType, masters, scope } = d;

  /*
   * ONLY THE COLUMNS THESE DEVICE TYPES HAVE. A sheet for one type (Desktop) leaves out what the
   * form hides for it (Charger, …); a sheet for every type keeps any column one of them uses.
   * Missing columns are fine on upload — only Device Type, Model and Device Name must be there.
   */
  const typeNames = devices.map((t) => t.device_name);
  const columns = typeNames.length
    ? allColumns.filter((c) => c.auto || c.required || typeNames.some((n) => deviceFieldRules(n).has(c.key)))
    : allColumns;

  /*
   * MANDATORY COLUMNS, marked " *" in the heading: required for every type in this sheet (for a
   * one-type sheet, simply that type's mandatory fields — the Add Device form's). Calculated
   * columns are filled in by the sheet, so never starred.
   */
  const requiredBy = (key) => typeNames.filter((n) => deviceFieldRules(n).required.some((f) => f.key === key));
  const isMandatory = (c) =>
    !c.auto &&
    c.key !== "total_warranty_years" &&
    (c.required || (typeNames.length > 0 && requiredBy(c.key).length === typeNames.length));

  // Distinct, trimmed, A→Z (numbers in number order).
  const tidy = (values) =>
    [...new Map(values.map((v) => String(v ?? "").trim()).filter(Boolean).map((v) => [v.toLowerCase(), v])).values()]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  /*
   * A value that is all digits ("64", "101", "1001") is written as a NUMBER: picking it enters
   * it as if typed, Excel stores that as a number, and a number never matches the text "64" —
   * the pick would be refused and the lookups would miss. An IP address stays text.
   */
  const cellValue = (v) => (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v);

  // A USER's own plant(s) only — one or several, as set in Reporting Person.
  const plants = tidy(masters.plantRows.map((p) => p.plant_code)).filter(
    (c) => !(scope.limited && scope.plants?.length) || scope.plants.includes(c)
  );

  const wb = new ExcelJS.Workbook();
  // Excel works every formula out when the file opens (Reference No, Total Warranty), and
  // again whenever a cell they read changes — never left showing a stale or empty result.
  wb.calcProperties = { fullCalcOnLoad: true };
  const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1 }] });
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });

  /*
   * HEADINGS, all in the same dark blue, with a yellow " *" when the column is mandatory. The
   * cells below carry no colour at all. The upload matches headings ignoring the " *".
   */
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 6) }));
  const head = ws.getRow(1);
  head.height = 32;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = isMandatory(c)
      ? {
          richText: [
            { text: c.header, font: { bold: true, color: { argb: "FFFFFFFF" } } },
            { text: " *", font: { bold: true, size: 13, color: { argb: "FFFFD966" } } },
          ],
        }
      : c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A93" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });

  // ---- the hidden lists ----
  const colRef = (n) => ws.getColumn(n).letter; // 1 -> A
  let col = 1;
  const writeList = (values, rangeName) => {
    const letter = colRef(col);
    const items = values.length ? values.map(cellValue) : [""];
    items.forEach((v, i) => (lists.getCell(i + 1, col).value = v));
    wb.definedNames.add(`Lists!$${letter}$1:$${letter}$${items.length}`, rangeName);
    col += 1;
  };
  const writeMap = (pairs, rangeName) => {
    const a = colRef(col);
    const b = colRef(col + 1);
    const rows = pairs.length ? pairs : [["", ""]];
    rows.forEach(([k, v], i) => {
      lists.getCell(i + 1, col).value = k;
      lists.getCell(i + 1, col + 1).value = v;
    });
    wb.definedNames.add(`Lists!$${a}$1:$${b}$${rows.length}`, rangeName);
    col += 2;
  };

  // Device Type -> Model -> Device Name.
  writeList(devices.map((t) => t.device_name), "DeviceTypes");
  const typeMap = [];
  const modelMap = [];
  devices.forEach((t, i) => {
    const typeModels = models
      .filter((m) => String(m.device_id) === String(t.id))
      .sort((a, b) => (a.model_name ?? "").localeCompare(b.model_name ?? ""));
    writeList(typeModels.map((m) => m.model_name), `T_${t.id}`);
    typeMap.push([t.device_name, `T_${t.id}`]);

    const open = (statusByType[i] ?? []).filter((r) => !r.registered && r.name);
    typeModels.forEach((m) => {
      const names = open
        .filter((r) => (r.model ?? "").trim().toLowerCase() === (m.model_name ?? "").trim().toLowerCase())
        .map((r) => r.name)
        .sort((a, b) => a.localeCompare(b));
      writeList(names, `M_${m.id}`);
      // The model goes through the number rule too: "type|101" is what Excel builds from a
      // picked numeric model, and the key has to be the same text.
      modelMap.push([`${t.device_name}|${cellValue(m.model_name)}`, `M_${m.id}`]);
    });
  });
  writeMap(typeMap, "TypeMap");
  writeMap(modelMap, "ModelMap");

  // Reference No of each name offered (names are unique across every device type).
  writeMap(
    statusByType
      .flat()
      .filter((r) => !r.registered && r.name && r.reference_no)
      .map((r) => [cellValue(r.name), r.reference_no]),
    "RefMap"
  );

  // The plain master lists.
  const simpleLists = {
    processor: ["L_Processor", tidy(masters.processors)],
    ram: ["L_Ram", tidy(masters.rams)],
    hdd: ["L_Hdd", tidy(masters.hdds)],
    system_type: ["L_SystemType", tidy(masters.systemTypes)],
    os: ["L_Os", tidy(masters.oses)],
    warranty_status: ["L_Warranty", tidy(masters.warranties)],
    ip_address: ["L_Ip", tidy(masters.ips)],
    // The form's STATUS — In Use / In Spare (device_status), the "Status" column of the sheet.
    device_status: ["L_DeviceStatus", tidy(masters.deviceStatuses)],
    // Action History's Assign To Employee: active employees as "101099 - GANESH BARATHE".
    /*
     * Sorted as plain TEXT, not as numbers: the type-to-search dropdown below shows the block of
     * entries that START with what was typed, so all of "1011…" must sit together — a numeric
     * sort would put 9001 between 1001 and 100119.
     */
    assign_employee: [
      "L_Employee",
      [...new Set((masters.employees ?? []).map((e) => `${e.emp_code} - ${e.emp_name ?? ""}`.trim()))].sort(),
    ],
  };
  Object.values(simpleLists).forEach(([rangeName, values]) => writeList(values, rangeName));

  // Plant -> each plant's departments (D_<code>) and locations (L_<code>).
  writeList(plants, "Plants");
  const deptMap = [];
  const locMap = [];
  plants.forEach((code) => {
    const of = (rows) => rows.filter((r) => String(r.plant_code ?? "").trim() === code);
    writeList(tidy(of(masters.departmentRows).map((r) => r.department)), `D_${code}`);
    writeList(tidy(of(masters.locationRows).map((r) => r.location_name)), `L_${code}`);
    deptMap.push([cellValue(code), `D_${code}`]);
    locMap.push([cellValue(code), `L_${code}`]);
  });
  writeMap(deptMap, "DeptMap");
  writeMap(locMap, "LocMap");

  // Plant -> its company, for the read-only Company column (as the form shows beside Plant).
  const companyOf = new Map();
  masters.plantRows.forEach((p) => {
    const code = String(p.plant_code ?? "").trim();
    if (code && !companyOf.has(code)) companyOf.set(code, p.company_name || p.company_short_name || "");
  });
  writeMap(
    plants.map((code) => [cellValue(code), companyOf.get(code) ?? ""]),
    "CompanyMap"
  );

  // An empty list: the dropdown of a field that row's device type does not have (see below).
  writeList([], "L_NotUsed");

  // ---- the data rows: dropdowns and calculated cells on rows 2–1001 ----
  const at = (key) => columns.findIndex((c) => c.key === key) + 1;
  // A column left out of this sheet (a field its device type does not have) gets no rules.
  const inSheet = (key) => at(key) > 0;
  const letter = (key) => colRef(at(key));
  const rule = (formula, ruleTitle, error) => ({
    type: "list",
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: ruleTitle,
    error,
  });
  const typeCol = letter("device_type");
  const modelCol = letter("model");
  const nameCol = letter("name");
  const plantCol = letter("plant");

  /*
   * FIELDS A DEVICE TYPE DOES NOT HAVE — as the form hides them (_deviceFields.js): for a
   * printer no Processor, RAM, OS, …; for a tablet no HDD, IP Address, …; Charger for laptops
   * only. Excel cannot hide a column for one row, so in a row whose Device Type lacks a field,
   * that cell is shaded grey and refuses anything typed in.
   */
  const notUsedBy = (key) => typeNames.filter((n) => !deviceFieldRules(n).has(key));
  const isOneOf = (types) => `OR(${types.map((n) => `$${typeCol}${FIRST}="${n}"`).join(",")})`;
  const notUsedNote = (label, types) => `${label} is not used for ${types.join(", ")} — leave it empty.`;
  // The columns given a rule of their own (a cell holds one rule); the rest get a "not used" rule.
  const validated = new Set(["device_type", "model", "name"]);

  /*
   * ONE RULE PER COLUMN, over rows 2–1001 — how Excel itself stores a dropdown. A linked rule
   * is written for row 2 ($B2) and Excel shifts it down row by row. (Not one rule per cell:
   * exceljs merges those wrongly — it sorts "B10" before "B2" and writes overlapping ranges.)
   */
  const FIRST = 2;
  const LAST = 1001;
  const dropdown = (col, formula, label, error) =>
    ws.dataValidations.add(`${col}${FIRST}:${col}${LAST}`, rule(formula, label, error));
  /*
   * A field's dropdown, EMPTY in a row whose device type does not have the field — so nothing
   * can be picked or typed there (the cell's one rule is this list, so it has to say both).
   */
  const fieldDropdown = (key, formula, label, error) => {
    validated.add(key);
    const off = notUsedBy(key);
    if (!off.length) return dropdown(letter(key), formula, label, error);
    return dropdown(letter(key), `IF(${isOneOf(off)},L_NotUsed,${formula})`, label, `${error} ${notUsedNote(label, off)}`);
  };

  dropdown(typeCol, "DeviceTypes", "Device Type", "Pick a Device Type from the list.");
  dropdown(
    modelCol,
    `INDIRECT(VLOOKUP($${typeCol}${FIRST},TypeMap,2,FALSE))`,
    "Model",
    "Pick the Device Type first, then a Model of that type."
  );
  dropdown(
    nameCol,
    `INDIRECT(VLOOKUP($${typeCol}${FIRST}&"|"&$${modelCol}${FIRST},ModelMap,2,FALSE))`,
    "Device Name",
    "Pick the Model first, then one of its device names."
  );
  Object.entries(simpleLists).forEach(([key, [rangeName, values]]) => {
    if (!values.length) return; // nothing loaded — leave the column free to type
    if (!inSheet(key)) return; // not a field of this sheet's device type
    if (key === "assign_employee") return; // its own searchable dropdown, below
    const label = columns[at(key) - 1].header;
    fieldDropdown(key, rangeName, label, `Pick a ${label} from the list.`);
  });

  /*
   * ASSIGN TO EMPLOYEE — A DROPDOWN YOU CAN SEARCH, in every Excel version (2007 included):
   * type the start of the code (e.g. 1011), open the dropdown, and it lists only the employees
   * whose code starts with that; an empty cell lists them all. The list is the cell's own
   * text matched against L_Employee (OFFSET + MATCH + COUNTIF over a text-sorted list).
   *
   * Typed text has to be let through for the search to work, so a value that is not an
   * employee is not blocked here — the preview marks it ("Employee … not found") instead.
   */
  if (simpleLists.assign_employee[1].length && inSheet("assign_employee")) {
    // Typing has to stay free for the search, so a printer row's cell is only shaded grey here
    // (the upload refuses an employee on a printer).
    validated.add("assign_employee");
    const empCol = letter("assign_employee");
    const cell = `$${empCol}${FIRST}`;
    ws.dataValidations.add(`${empCol}${FIRST}:${empCol}${LAST}`, {
      type: "list",
      allowBlank: true,
      formulae: [
        `IF(${cell}="",L_Employee,OFFSET(INDEX(L_Employee,1),MATCH(${cell}&"*",L_Employee,0)-1,0,COUNTIF(L_Employee,${cell}&"*"),1))`,
      ],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: "Assign To Employee",
      prompt: "Pick from the list, or type the start of the employee code (e.g. 1011) and open the list to see only those.",
    });
  }
  if (plants.length) {
    fieldDropdown("plant", "Plants", "Plant", "Pick a Plant from the list.");
    fieldDropdown(
      "department",
      `INDIRECT(VLOOKUP($${plantCol}${FIRST},DeptMap,2,FALSE))`,
      "Department",
      "Pick the Plant first, then one of its departments."
    );
    fieldDropdown(
      "location",
      `INDIRECT(VLOOKUP($${plantCol}${FIRST},LocMap,2,FALSE))`,
      "Location",
      "Pick the Plant first, then one of its locations."
    );
  }

  /*
   * WARRANTY DATES must be REAL dates, or Total Warranty cannot be worked out: Excel keeps a
   * date it does not recognise (e.g. 25/10/2019 on a PC set to month-first) as plain text,
   * and the formula then sees no date at all. Each date cell therefore only accepts a date,
   * and the End Date only one after the Start Date — with a message saying how to enter it.
   */
  const startCol = letter("warranty_start_date");
  const endCol = letter("last_date_of_warranty");
  const dateRule = (formula, ruleTitle, error) => ({
    type: "date",
    operator: "greaterThan",
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: ruleTitle,
    error,
    showInputMessage: true,
    promptTitle: ruleTitle,
    prompt: "Enter a date as DD/MM/YYYY, e.g. 10/10/2019.",
  });
  ws.dataValidations.add(
    `${startCol}${FIRST}:${startCol}${LAST}`,
    dateRule(new Date(Date.UTC(1990, 0, 1)), "Warranty Start Date", "Enter a real date as DD/MM/YYYY (e.g. 10/10/2019).")
  );
  // The End Date as a formula rule: a real date (a number to Excel) and after the Start Date
  // (a blank Start Date counts as 0, so any real End Date passes until one is entered).
  ws.dataValidations.add(`${endCol}${FIRST}:${endCol}${LAST}`, {
    ...dateRule(null, "Warranty End Date", "Enter a real date as DD/MM/YYYY, after the Warranty Start Date."),
    type: "custom",
    operator: undefined,
    formulae: [`AND(ISNUMBER(${endCol}${FIRST}),${endCol}${FIRST}>$${startCol}${FIRST})`],
  });

  validated.add("warranty_start_date").add("last_date_of_warranty").add("assign_start_date");

  // The assignment's Start Date: a real date too (any day — history can be entered late), and
  // nothing at all on a row whose type keeps no employee history (a printer).
  // (A printer-only sheet has no Start Date column at all.)
  const assignCol = inSheet("assign_start_date") ? letter("assign_start_date") : null;
  const assignOff = notUsedBy("assign_start_date");
  const assignMsg = "Enter a real date as DD/MM/YYYY — when the employee got the device.";
  if (assignCol) {
    ws.dataValidations.add(
      `${assignCol}${FIRST}:${assignCol}${LAST}`,
      assignOff.length
        ? {
            ...dateRule(null, "Start Date", `${assignMsg} ${notUsedNote("Start Date", assignOff)}`),
            type: "custom",
            operator: undefined,
            formulae: [`AND(NOT(${isOneOf(assignOff)}),ISNUMBER(${assignCol}${FIRST}),${assignCol}${FIRST}>DATE(1990,1,1))`],
          }
        : dateRule(new Date(Date.UTC(1990, 0, 1)), "Start Date", assignMsg)
    );
  }

  /*
   * Every other typed-in column: refused on a row whose type does not have it, and a code field
   * (PO No., Service Tag, …) refuses a character it may not hold — numbers only, letters and
   * numbers only — the form's own rule (lib/fieldFormats.js). One rule per cell, so both in one.
   */
  columns.forEach((c) => {
    if (c.auto || validated.has(c.key) || c.key === "total_warranty_years") return;
    const off = notUsedBy(c.key);
    const fmt = FIELD_FORMATS[c.key];
    if (!off.length && !fmt) return;
    const col = letter(c.key);
    const parts = [];
    if (off.length) parts.push(`NOT(${isOneOf(off)})`);
    if (fmt) parts.push(onlyChars(`${col}${FIRST}`, fmt.chars));
    const messages = [];
    // "PO No. needs numbers only — e.g. 410000074." — Excel's own error box, naming the column.
    if (fmt) messages.push(`${c.header} needs ${fmt.hint.toLowerCase()} — e.g. ${fmt.sample}.`);
    if (off.length) messages.push(notUsedNote(c.header, off));
    ws.dataValidations.add(`${col}${FIRST}:${col}${LAST}`, {
      type: "custom",
      allowBlank: true,
      formulae: [parts.length > 1 ? `AND(${parts.join(",")})` : parts[0]],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: c.header,
      error: messages.join(" "),
      ...(fmt
        ? { showInputMessage: true, promptTitle: c.header, prompt: `${fmt.hint}. e.g. ${fmt.sample}` }
        : {}),
    });
  });

  /*
   * NO COLOURS ON THE CELLS — none for filled, empty, mandatory, not used or calculated: every
   * cell stays plain. The * in the heading says what is mandatory; a field a row's type does not
   * have is still refused by its rule above, just not shaded.
   */

  // The calculated cells, row by row (plain, like every other cell).
  for (let r = FIRST; r <= LAST; r++) {
    if (assignCol) ws.getCell(`${assignCol}${r}`).numFmt = "dd/mm/yyyy";
    // Reference No — appears once the Device Name is picked, as in ADD DEVICE.
    // Company — appears once the Plant is picked, as beside Plant on the form.
    const company = ws.getCell(`${letter("company")}${r}`);
    company.value = { formula: `IF(${plantCol}${r}="","",IFERROR(VLOOKUP(${plantCol}${r},CompanyMap,2,FALSE),""))` };

    const ref = ws.getCell(`${letter("reference_no")}${r}`);
    ref.value = { formula: `IF(${nameCol}${r}="","",IFERROR(VLOOKUP(${nameCol}${r},RefMap,2,FALSE),""))` };

    // Total Warranty — the form's rule: whole months to the day after the end, in years.
    const start = `${letter("warranty_start_date")}${r}`;
    const end = `${letter("last_date_of_warranty")}${r}`;
    ws.getCell(start).numFmt = "dd/mm/yyyy";
    ws.getCell(end).numFmt = "dd/mm/yyyy";
    const total = ws.getCell(`${letter("total_warranty_years")}${r}`);
    total.value = {
      formula: `IF(AND(ISNUMBER(${start}),ISNUMBER(${end}),${end}>${start}),ROUND(DATEDIF(${start},${end}+1,"m")/12,2),"")`,
    };

    /*
     * AGE as YEAR.MONTH — how old the device is today, from its Warranty Start Date: whole years,
     * a dot, the months left over as two digits (5.01 = 5 years 1 month, 5.11, 3.00, 0.07).
     * Text, so 5.10 stays 5.10 (as a number it would show 5.1). TODAY() keeps it current every
     * time the file is opened; a start date still to come counts as 0.00. Blank without a date.
     */
    const age = ws.getCell(`${letter("age")}${r}`);
    age.value = {
      formula:
        `IF(ISNUMBER(${start}),IF(${start}>TODAY(),"0.00",` +
        `DATEDIF(${start},TODAY(),"y")&"."&TEXT(DATEDIF(${start},TODAY(),"ym"),"00")),"")`,
    };
    age.alignment = { horizontal: "right" };
  }

  /*
   * THE AUTO-GENERATED COLUMNS CANNOT BE TYPED IN — and say WHY, in their own words (Excel's
   * "protected cell" box cannot be reworded, so a rule refuses the typing instead). Shaded GREY,
   * the only colour on the sheet, so they read as filled in by the sheet. Clicking one shows
   * the same note as a tip.
   */
  const AUTO_NOTES = {
    reference_no: "Reference No is auto-generated from the Device Type, Model and Device Name — it cannot be typed.",
    company: "Company fills in from the Plant you pick — it cannot be typed.",
    total_warranty_years: "Total Warranty is worked out from the Warranty Start and End Date — it cannot be typed.",
    age: "Age is worked out from the Warranty Start Date — it cannot be typed.",
  };
  const GREY = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  columns.forEach((c) => {
    const note = AUTO_NOTES[c.key];
    if (!note) return;
    const col = letter(c.key);
    ws.dataValidations.add(`${col}${FIRST}:${col}${LAST}`, {
      type: "custom",
      allowBlank: false,
      // Anything typed has a length — refused. The sheet's own formula result is never checked.
      formulae: [`LEN(${col}${FIRST})=0`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Auto-generated",
      error: note,
      showInputMessage: true,
      promptTitle: "Auto-generated",
      prompt: note,
    });
    for (let r = FIRST; r <= LAST; r++) ws.getCell(`${col}${r}`).fill = GREY;
  });

  // THE HEADINGS cannot be renamed either — the upload finds each column by its heading.
  const lastCol = colRef(columns.length);
  ws.dataValidations.add(`A1:${lastCol}1`, {
    type: "custom",
    allowBlank: false,
    formulae: ["LEN(A1)=0"],
    showErrorMessage: true,
    errorStyle: "stop",
    errorTitle: "Column heading",
    error: "Column headings cannot be changed — the upload reads them.",
  });

  // No Instructions sheet: the workbook is the Device sheet alone (and its hidden lists).
  return wb;
}
