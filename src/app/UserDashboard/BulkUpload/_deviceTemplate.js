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
 * @param d       { title, columns, example, devices, models, statusByType, masters, scope }
 *                masters: { processors, rams, hdds, oses, systemTypes, warranties, ips,
 *                           deviceStatuses, plantRows, departmentRows, locationRows }
 * @returns       the exceljs Workbook
 */
import { deviceFieldRules } from "../LaptopDesktop/_deviceFields";

export function buildDeviceWorkbook(ExcelJS, d) {
  const { title, columns, example, devices, models, statusByType, masters, scope } = d;

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

  // Headings, in the dark blue of the export sheets.
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 4) }));
  const head = ws.getRow(1);
  head.height = 30;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333399" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
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
  const CALC_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2FF" } };
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
  const typeNames = devices.map((t) => t.device_name);
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
  if (simpleLists.assign_employee[1].length) {
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
  const assignCol = letter("assign_start_date");
  const assignOff = notUsedBy("assign_start_date");
  const assignMsg = "Enter a real date as DD/MM/YYYY — when the employee got the device.";
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

  // Every other column a type may not have (typed in, no list): refused on such a row.
  columns.forEach((c) => {
    if (c.auto || validated.has(c.key) || c.key === "total_warranty_years") return;
    const off = notUsedBy(c.key);
    if (!off.length) return;
    const col = letter(c.key);
    ws.dataValidations.add(`${col}${FIRST}:${col}${LAST}`, {
      type: "custom",
      allowBlank: true,
      formulae: [`NOT(${isOneOf(off)})`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: c.header,
      error: notUsedNote(c.header, off),
    });
  });

  /*
   * ONE COLOUR SCHEME FOR EVERY DEVICE TYPE — the same meaning in every row, whatever the type.
   * It starts as soon as the row has a Device Type:
   *
   *   GREY   not used by this device type (cannot be filled — see the rules above)
   *   YELLOW MANDATORY for this device type and still empty — fill it in
   *   GREEN  filled in (entered)
   *   WHITE  optional and empty
   *
   * The three never overlap (a cell is not used, or empty, or filled), so each cell shows
   * exactly one colour. The mandatory list is the form's own (_deviceFields.js). Excel 2007+;
   * the colour changes the moment the cell is filled or emptied.
   */
  const COLOR = {
    notUsed: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFD9D9D9" } }, font: { color: { argb: "FF808080" } } },
    mandatory: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFEB9C" } } },
    filled: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFC6EFCE" } } },
  };
  const started = `$${typeCol}${FIRST}<>""`;
  const requiredBy = (key) =>
    typeNames.filter((n) => deviceFieldRules(n).required.some((f) => f.key === key));
  columns.forEach((c) => {
    // Calculated cells (Reference No, Company, Total Warranty) keep their light blue.
    if (c.auto || c.key === "total_warranty_years") return;
    const col = letter(c.key);
    const cell = `${col}${FIRST}`;
    const empty = `LEN(TRIM(${cell}))=0`;
    const off = notUsedBy(c.key);
    // Device Type / Model / Device Name are mandatory for every type; the rest per type.
    const needs = c.required ? typeNames : requiredBy(c.key);
    const rules = [];
    if (off.length) {
      rules.push({ type: "expression", priority: 1, formulae: [isOneOf(off)], style: COLOR.notUsed });
    }
    if (needs.length && c.key !== "device_type") {
      const isNeeded = needs.length === typeNames.length ? started : `OR(${needs.map((n) => `$${typeCol}${FIRST}="${n}"`).join(",")})`;
      rules.push({ type: "expression", priority: 2, formulae: [`AND(${started},${isNeeded},${empty})`], style: COLOR.mandatory });
    }
    rules.push({
      type: "expression",
      priority: 3,
      formulae: [
        c.key === "device_type"
          ? `NOT(${empty})`
          : off.length
            ? `AND(${started},NOT(${empty}),NOT(${isOneOf(off)}))`
            : `AND(${started},NOT(${empty}))`,
      ],
      style: COLOR.filled,
    });
    ws.addConditionalFormatting({ ref: `${col}${FIRST}:${col}${LAST}`, rules });
  });

  // The calculated cells, row by row.
  for (let r = FIRST; r <= LAST; r++) {
    ws.getCell(`${assignCol}${r}`).numFmt = "dd/mm/yyyy";
    // Reference No — appears once the Device Name is picked, as in ADD DEVICE.
    // Company — appears once the Plant is picked, as beside Plant on the form.
    const company = ws.getCell(`${letter("company")}${r}`);
    company.value = { formula: `IF(${plantCol}${r}="","",IFERROR(VLOOKUP(${plantCol}${r},CompanyMap,2,FALSE),""))` };
    company.fill = CALC_FILL;

    const ref = ws.getCell(`${letter("reference_no")}${r}`);
    ref.value = { formula: `IF(${nameCol}${r}="","",IFERROR(VLOOKUP(${nameCol}${r},RefMap,2,FALSE),""))` };
    ref.fill = CALC_FILL;
    ref.font = { bold: true, color: { argb: "FF3482AE" } };

    // Total Warranty — the form's rule: whole months to the day after the end, in years.
    const start = `${letter("warranty_start_date")}${r}`;
    const end = `${letter("last_date_of_warranty")}${r}`;
    ws.getCell(start).numFmt = "dd/mm/yyyy";
    ws.getCell(end).numFmt = "dd/mm/yyyy";
    const total = ws.getCell(`${letter("total_warranty_years")}${r}`);
    total.value = {
      formula: `IF(AND(ISNUMBER(${start}),ISNUMBER(${end}),${end}>${start}),ROUND(DATEDIF(${start},${end}+1,"m")/12,2),"")`,
    };
    total.fill = CALC_FILL;

    /*
     * AGE (YEARS) — the asset sheet's own formula, =(TODAY()-Last Date)/365+Total Warranty: how
     * old the device is today (years since the warranty ended, plus its warranty years). TODAY()
     * makes it current whenever the file is opened. Blank until both are there.
     */
    const totalRef = `${letter("total_warranty_years")}${r}`;
    const age = ws.getCell(`${letter("age")}${r}`);
    age.value = {
      formula: `IF(AND(ISNUMBER(${end}),ISNUMBER(${totalRef})),ROUND((TODAY()-${end})/365+${totalRef},2),"")`,
    };
    age.numFmt = "0.00";
    age.fill = CALC_FILL;
  }

  /*
   * ---- Instructions ---- one row per column, and for each device type whether it is
   * MANDATORY, optional or not used — the very rules of the ADD DEVICE form (_deviceFields.js).
   */
  const help = wb.addWorksheet("Instructions");
  const typeRules = devices.map((t) => ({ name: t.device_name, rules: deviceFieldRules(t.device_name) }));
  help.columns = [{ width: 30 }, { width: 14 }, ...typeRules.map(() => ({ width: 14 })), { width: 30 }];
  help.addRow(["Column", "Format", ...typeRules.map((t) => t.name.toUpperCase()), "Example"]);
  columns.forEach((c) => {
    const format = c.auto ? "Automatic" : c.type === "date" ? "DD/MM/YYYY" : c.type === "number" ? "Number" : "Text";
    const perType = typeRules.map(({ rules }) => {
      if (c.auto) return "Automatic";
      if (c.required || rules.required.some((f) => f.key === c.key)) return "MANDATORY";
      return rules.has(c.key) ? "Optional" : "Not used";
    });
    const row = help.addRow([c.header, format, ...perType, example[c.key] ?? ""]);
    perType.forEach((v, i) => {
      if (v === "MANDATORY") row.getCell(3 + i).font = { bold: true, color: { argb: "FFC00000" } };
      if (v === "Not used") row.getCell(3 + i).font = { color: { argb: "FF999999" } };
    });
  });
  help.addRow([]);
  help.addRow(["MANDATORY fields must be filled in, or that row is not imported — as on the Add Device form."]);
  help.addRow(["COLOURS — the same for every device type, once the row has a Device Type:"]);
  [
    ["   YELLOW", "Mandatory for this device type and still empty — fill it in", "FFFFEB9C"],
    ["   GREEN", "Filled in", "FFC6EFCE"],
    ["   GREY", "Not used for this device type — cannot be filled (as the form hides it)", "FFD9D9D9"],
    ["   WHITE", "Optional and empty — fill it in only if needed", "FFFFFFFF"],
  ].forEach(([name, meaning, argb]) => {
    const row = help.addRow([name, meaning]);
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    row.getCell(1).font = { bold: true };
  });
  help.addRow(["Light blue cells (Reference No, Company, Total Warranty) fill in by themselves — leave them."]);
  help.addRow(["Assign To Employee + Start Date (Action History): optional. Filled in, the device is added and"]);
  help.addRow(["assigned to that employee (Assigned); left empty, it is added Open. Not for printers."]);
  [
    "Device Type, Model and Device Name are dropdowns: pick them in that order.",
    "Reference No (first column) fills in by itself once the Device Name is picked — leave it.",
    "Plant, then Department and Location: pick the Plant first — they list that plant's own.",
    "Total Warranty (In Years) is calculated from Warranty Start and End Date — leave it.",
    "Processor, RAM, HDD, System Type, Operating System, IP Address, Device Status and",
    "Warranty Status are dropdowns from their masters, the same lists as the Add Device form.",
    "Device Name lists only names created in Device Name Master and not registered yet.",
  ].forEach((line) => help.addRow([line]));
  if (scope.limited && scope.plants?.length) help.addRow(["Your plant(s):", scope.plants.join(", ")]);
  help.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333399" } };
  });

  return wb;
}
