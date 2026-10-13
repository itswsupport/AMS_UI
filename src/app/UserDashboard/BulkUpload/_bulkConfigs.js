import { bulkUploadDevices, bulkUploadServers, bulkUploadSoftware } from "@/services/bulkUploadService";
import { deviceFieldRules } from "../LaptopDesktop/_deviceFields";

/*
 * THE THREE EXCEL LAYOUTS for Bulk Upload — one per register. Each column is:
 *
 *   header    the Excel heading, exactly as in the template (matched ignoring case and spaces)
 *   key       the field the backend expects
 *   required  the row is refused without it
 *   type      "text" (default), "number", "integer" or "date" (DD/MM/YYYY in the sheet)
 *   preview   shown in the preview table on screen
 *
 * The headers follow the field labels of ADD DEVICE / ADD SERVER / ADD SOFTWARE, so a sheet
 * reads the same as the form it replaces.
 */

const DEVICE_COLUMNS = [
  /*
   * First, as in ADD DEVICE: filled in by the template itself once the Device Name is picked —
   * the number that name was given in Device Name Master. Shown, never sent: the server gives
   * the device that same number on save.
   */
  { header: "Reference No", key: "reference_no", preview: true, auto: true },
  { header: "Device Type", key: "device_type", required: true, preview: true },
  { header: "Model", key: "model", required: true, preview: true },
  { header: "Device Name", key: "name", required: true, preview: true },
  // Every field of the ADD DEVICE form, in the form's order. Which are mandatory depends on the
  // device type, exactly as on the form (see deviceCheck / _deviceFields.js).
  { header: "Asset Code", key: "asset_code" },
  { header: "Asset S/N", key: "asset_sn" },
  { header: "Service Tag", key: "service_tag" },
  // The maker's Express Service Code (the asset sheet's EXP. SERVICE CODE) — optional.
  { header: "Exp. Service Code", key: "exp_service_code" },
  { header: "PO No.", key: "po_no" },
  { header: "Processor", key: "processor" },
  { header: "External Processor", key: "external_processor" },
  { header: "RAM", key: "ram" },
  { header: "External RAM", key: "external_ram" },
  { header: "ROM", key: "rom" },
  { header: "External ROM", key: "external_rom" },
  { header: "HDD", key: "hdd" },
  { header: "External HDD", key: "external_hdd" },
  // Laptops only (grey for every other type) — just before System Type, as on the form.
  { header: "Charger Adaptor", key: "charger" },
  { header: "System Type", key: "system_type" },
  { header: "Operating System", key: "os" },
  { header: "OS Service Pack", key: "os_service_pack" },
  { header: "MS Office", key: "ms_office" },
  { header: "Software 1", key: "software_1" },
  { header: "Software 2", key: "software_2" },
  // KEYBOARD / MOUSE serial numbers — desktops only (grey for every other type), optional.
  { header: "Keyboard", key: "keyboard" },
  { header: "Mouse", key: "mouse" },
  { header: "Plant", key: "plant", preview: true },
  // Filled in by the template from the Plant chosen, as on the form; shown, never sent.
  { header: "Company", key: "company", auto: true },
  { header: "Department", key: "department" },
  { header: "Location", key: "location" },
  { header: "IP Address", key: "ip_address" },
  { header: "Warranty Status", key: "warranty_status" },
  { header: "Warranty Start Date", key: "warranty_start_date", type: "date" },
  { header: "Warranty End Date", key: "last_date_of_warranty", type: "date" },
  { header: "Total Warranty (In Years)", key: "total_warranty_years", type: "number" },
  /*
   * Worked out by the template — the asset sheet's formula =(TODAY()-Warranty End Date)/365+Total
   * Warranty, so it is today's age whenever the file is opened. Shown, never sent or stored.
   */
  { header: "Age (Years)", key: "age", type: "number", auto: true },
  { header: "Description", key: "description" },
  // In Use / In Spare, as the form's STATUS (stored as device_status) — every device type.
  { header: "Status", key: "device_status" },
  /*
   * ACTION HISTORY, as at the bottom of the form: who the device is given to, and from when.
   * Optional — left empty, the device is added Open; filled in, it is added and assigned
   * (Assigned). Not for printers, which keep no employee history.
   */
  { header: "Assign To Employee", key: "assign_employee", preview: true },
  { header: "Start Date", key: "assign_start_date", type: "date" },
];

/*
 * Every field of the ADD SERVER form, in the form's order and with its labels. Only the Server
 * Name is mandatory, as on the form; it has to be a server from Server Master not added yet.
 */
const SERVER_COLUMNS = [
  // Server Details
  { header: "Server Name", key: "server_name", required: true, preview: true },
  { header: "Type", key: "server_type", preview: true },
  { header: "S/N", key: "serial_no" },
  // Hardware Details
  { header: "Processor Ghz", key: "processor" },
  { header: "RAM", key: "ram" },
  { header: "HDD (GB)", key: "hdd" },
  { header: "System Type", key: "system_type" },
  // Software Details
  { header: "OS", key: "os_name" },
  { header: "OS Service Pack", key: "os_service_pack" },
  { header: "Other Software 1", key: "other_software_1" },
  { header: "Other Software 2", key: "other_software_2" },
  // Server Allocation Details
  { header: "IP Address", key: "ip_address", preview: true },
  { header: "Plant", key: "plant", preview: true },
  { header: "Dept.", key: "department" },
  { header: "Location", key: "location" },
  // Warranty Details
  { header: "Warranty Status", key: "warranty_status" },
  { header: "Warranty Start Date", key: "warranty_start_date", type: "date" },
  { header: "Last Date Of Warranty", key: "last_date_of_warranty", type: "date" },
  // Worked out by the template from the two dates (as on the form) — never typed.
  { header: "Total Warranty (In Years)", key: "total_warranty_years", type: "number", auto: true },
  // Other Details — no Status (Active / Inactive): every server is saved active.
  { header: "Description", key: "description" },
];

const SOFTWARE_COLUMNS = [
  { header: "Product Name", key: "product_name", required: true, preview: true },
  { header: "Total Licenses Acquired", key: "total_licenses_acquired", type: "integer", preview: true },
  { header: "License Excess or Deficiency", key: "license_excess_deficiency", type: "integer", preview: true },
  { header: "License Type", key: "license_type", preview: true },
  { header: "Renewal Date", key: "renewal_date", type: "date" },
  { header: "Status", key: "status" },
];

/**
 * Total Warranty from two YYYY-MM-DD dates — the ADD DEVICE form's rule (and the template's
 * formula): whole months from the start to the day after the end, in years to two decimals.
 * Used when the sheet's Total Warranty cell comes in empty.
 */
const yearsBetween = (start, end) => {
  if (!start || !end || end <= start) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const after = new Date(ey, em - 1, ed + 1);
  let months = (after.getFullYear() - sy) * 12 + (after.getMonth() + 1 - sm);
  if (after.getDate() < sd) months -= 1;
  return months > 0 ? Math.round((months / 12) * 100) / 100 : null;
};

/**
 * DEVICE — Device Type is written as its name ("Laptop") and turned into its Device Master
 * id here; the Model has to be one of that type's models. For a USER, only their device types
 * are accepted, and Plant is their own plant (filled in when the cell is empty).
 */
const deviceCheck = (row, ctx) => {
  const errors = [];
  const type = ctx.devices.find(
    (d) => (d.device_name ?? "").trim().toLowerCase() === String(row.device_type ?? "").trim().toLowerCase()
  );
  if (row.device_type && !type) {
    errors.push(
      ctx.scope.limited
        ? `Device Type "${row.device_type}" is not one of yours`
        : `Device Type "${row.device_type}" not found in Device Master`
    );
  }
  if (type && row.model) {
    const known = ctx.models.some(
      (m) =>
        String(m.device_id) === String(type.id) &&
        (m.model_name ?? "").trim().toLowerCase() === String(row.model).trim().toLowerCase()
    );
    if (!known) errors.push(`Model "${row.model}" not found for ${type.device_name}`);
  }
  /*
   * Already added (through ADD DEVICE or an earlier upload) — SKIPPED, not an error: the usual
   * import rule is "add what is new, skip what is already there". So the same sheet with five
   * more devices at the bottom imports just those five, and the rest show as Skipped.
   */
  /*
   * The message says WHO HAS IT when the device is assigned: "This device is already assigned to
   * 101099 - GANESH BARATHE — it cannot be assigned again". (A plain string is the Reference No
   * alone, as older callers kept it.)
   */
  const found = ctx.registered?.get(String(row.name ?? "").trim().toLowerCase());
  const existing = typeof found === "string" ? { ref: found } : found;
  let skip = null;
  if (row.name && existing) {
    const ref = existing.ref ? ` (Reference No ${existing.ref})` : "";
    const holder = [existing.holderCode, existing.holderName].filter(Boolean).join(" - ");
    skip = holder
      ? `This device is already assigned to ${holder}${ref} — it cannot be added or assigned again`
      : `This device is already added${ref} and is Open — assign it from Open Devices, not from the sheet`;
  }
  // A USER's plant(s): one is filled in when the cell is empty; with several, one must be picked.
  let plant = row.plant;
  const myPlants = ctx.scope.limited ? ctx.scope.plants ?? [] : [];
  if (myPlants.length) {
    if (!plant && myPlants.length === 1) plant = myPlants[0];
    else if (plant && !myPlants.includes(String(plant).trim())) {
      errors.push(`You can upload devices only for plant ${myPlants.join(", ")}`);
    }
  }

  const totalYears =
    row.total_warranty_years ?? yearsBetween(row.warranty_start_date, row.last_date_of_warranty);

  /*
   * MANDATORY FIELDS — the same as the ADD DEVICE form for this device type: a printer has no
   * processor or OS, a tablet no HDD, only a laptop a charger. Every field the form requires
   * must be filled in here too, or the row is not imported.
   */
  const rules = type ? deviceFieldRules(type.device_name) : null;
  if (rules) {
    const filled = { ...row, plant, total_warranty_years: totalYears };
    const missing = rules.required.filter(({ key }) => String(filled[key] ?? "").trim() === "");
    if (missing.length) errors.push(`Required: ${missing.map((m) => m.label).join(", ")}`);
    if (row.warranty_start_date && row.last_date_of_warranty && row.last_date_of_warranty <= row.warranty_start_date) {
      errors.push("Warranty End Date must be after the Start Date");
    }
  }

  // STATUS (In Use / In Spare) is device_status, checked as a mandatory field above; the
  // record itself is always saved active.

  /*
   * ASSIGN TO EMPLOYEE — "101099 - GANESH BARATHE" from the dropdown, or just the code. Must be
   * an active employee, with a Start Date; not for a printer. Saved as the device's holder and,
   * after the device, as its first Action History entry ("Assigned") — as the form does.
   */
  let employee = null;
  const empText = String(row.assign_employee ?? "").trim();
  if (empText) {
    const code = empText.split(/\s*-\s*/)[0].trim();
    employee = (ctx.employees ?? []).find((e) => String(e.emp_code) === code) ?? null;
    if (type && type.device_name?.toLowerCase() === "printer") {
      errors.push("Printers are not assigned to an employee — leave Assign To Employee empty");
    } else if (!employee) {
      errors.push(`Employee "${empText}" not found among active employees`);
    }
    if (!row.assign_start_date) errors.push("Start Date is required when assigning an employee");
  } else if (row.assign_start_date) {
    errors.push("Start Date given but no employee to assign");
  }

  // Device Type travels as its id; Reference No and Company are the server's / the plant's, never the sheet's.
  // Age is the template's own calculation (today's age) — shown, never sent.
  const { device_type: _drop, reference_no: _ref, company: _company, assign_employee: _emp, age: _age, ...rest } = row;
  // A field this device type does not have is not sent — as the form never sends one.
  if (rules) {
    Object.keys(rest).forEach((k) => {
      if (k !== "model" && k !== "name" && !rules.has(k)) rest[k] = null;
    });
  }
  const payload = {
    ...rest,
    device_id: type ? type.id : null,
    plant: plant ?? null,
    total_warranty_years: totalYears,
    status: 1,
    // The holder, as the form sets it; the server then records the Action History entry.
    employee_code: employee ? String(employee.emp_code) : null,
    employee_name: employee ? employee.emp_name ?? "" : null,
    assign_start_date: employee ? row.assign_start_date : null,
    ...ctx.changedBy,
  };
  return { errors, payload, skip };
};

/**
 * SERVER — as ADD SERVER: the name has to be one in Server Master (the form's dropdown), and
 * one already on the register is SKIPPED (the form greys those out). Saved active.
 */
const serverCheck = (row, ctx) => {
  const errors = [];
  const name = String(row.server_name ?? "").trim();
  const key = name.toLowerCase();
  if (name && ctx.serverNames && !ctx.serverNames.has(key)) {
    errors.push(`Server "${name}" is not in Server Master — add it there first`);
  }
  const skip = name && ctx.registeredServers?.has(key) ? "This server is already added" : null;
  // Warranty: the last date after the start, and the total worked out from the two (as the form does).
  if (row.warranty_start_date && row.last_date_of_warranty && row.last_date_of_warranty <= row.warranty_start_date) {
    errors.push("Last Date Of Warranty must be after the Warranty Start Date");
  }
  const totalYears = yearsBetween(row.warranty_start_date, row.last_date_of_warranty);
  // No Status (Active / Inactive) column any more: every server is saved active.
  return {
    errors,
    skip,
    payload: { ...row, total_warranty_years: totalYears, status: 1 },
  };
};

/**
 * SOFTWARE — as ADD SOFTWARE: Product Name has to be an active product in Product Master (the
 * form's dropdown). The same product MAY be added more than once — already on the register or
 * on several rows of the sheet (see allowDuplicates below) — but an entry identical in EVERY
 * value to one already saved is that entry again, and is skipped.
 * License Type from License Master; Total Licenses not negative (Excess/Deficiency may be).
 */
const softwareCheck = (row, ctx) => {
  const errors = [];
  const name = String(row.product_name ?? "").trim();
  const key = name.toLowerCase();
  if (name && ctx.productNames && !ctx.productNames.has(key)) {
    errors.push(`Product "${name}" is not in Product Master — add it there first`);
  }
  const license = String(row.license_type ?? "").trim();
  if (license && ctx.licenseTypes && !ctx.licenseTypes.has(license.toLowerCase())) {
    errors.push(`License Type "${license}" is not in License Master`);
  }
  if (row.total_licenses_acquired != null && row.total_licenses_acquired < 0) {
    errors.push("Total Licenses Acquired cannot be negative");
  }
  const statusText = String(row.status ?? "").trim().toLowerCase();
  if (statusText && statusText !== "active" && statusText !== "inactive") {
    errors.push(`Status must be Active or Inactive, not "${row.status}"`);
  }
  const payload = { ...row, product_name: name, status: statusText === "inactive" ? 0 : 1 };
  /*
   * ALREADY UPLOADED: the same product may be added again, but only as a DIFFERENT entry. A row
   * whose every value (product, both counts, licence type, renewal date, status) matches a
   * software entry already saved is that same entry again — SKIPPED, not added twice. Change
   * any one of them and it is a new entry, uploaded as usual.
   */
  const existing = ctx.softwareEntries?.get(softwareKey(payload));
  const skip =
    existing !== undefined
      ? `This software entry is already added${existing ? ` (on ${existing})` : ""} — same product, licences, licence type, renewal date and status`
      : null;
  return { errors, skip, payload };
};

/**
 * One software entry's identity: every value the Add Software form saves, normalised (case,
 * spaces, empty = ""), so the same entry typed again matches whatever its spelling. Used for
 * a sheet row (its payload) and for an entry already saved (from software/list).
 */
export const softwareKey = (r) =>
  [
    String(r.product_name ?? "").trim().toLowerCase(),
    r.total_licenses_acquired === null || r.total_licenses_acquired === undefined || r.total_licenses_acquired === "" ? "" : String(Number(r.total_licenses_acquired)),
    r.license_excess_deficiency === null || r.license_excess_deficiency === undefined || r.license_excess_deficiency === "" ? "" : String(Number(r.license_excess_deficiency)),
    String(r.license_type ?? "").trim().toLowerCase(),
    String(r.renewal_date ?? "").slice(0, 10),
    Number(r.status) === 0 ? "0" : "1",
  ].join("|");

export const BULK_TYPES = {
  device: {
    title: "Device",
    templateName: "Device_Bulk_Upload_Template",
    columns: DEVICE_COLUMNS,
    check: deviceCheck,
    upload: bulkUploadDevices,
    // Only these on the example row; the rest are left for the user.
    example: {
      device_type: "laptop",
      model: "DELL Latitude 3420",
      name: "IT501",
      plant: "1001",
      warranty_start_date: "10/10/2023",
      last_date_of_warranty: "09/10/2026",
      device_status: "In Use",
    },
  },
  server: {
    title: "Server",
    templateName: "Server_Bulk_Upload_Template",
    columns: SERVER_COLUMNS,
    check: serverCheck,
    upload: bulkUploadServers,
    example: {
      server_name: "From Server Master",
      server_type: "Rack",
      ip_address: "192.168.10.20",
      plant: "1001",
      location: "From Location Master (by Plant)",
      warranty_start_date: "01/04/2024",
      last_date_of_warranty: "31/03/2027",
      total_warranty_years: "Automatic (3)",
    },
  },
  software: {
    title: "Software",
    templateName: "Software_Bulk_Upload_Template",
    columns: SOFTWARE_COLUMNS,
    check: softwareCheck,
    upload: bulkUploadSoftware,
    // The same product may be on several rows and already on the register.
    allowDuplicates: true,
    example: {
      product_name: "From Product Master",
      total_licenses_acquired: 50,
      license_excess_deficiency: -5,
      license_type: "From License Master",
      renewal_date: "31/03/2027",
      status: "Active",
    },
  },
};
