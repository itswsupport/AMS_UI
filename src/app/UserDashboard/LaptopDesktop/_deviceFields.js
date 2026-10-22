/**
 * WHICH FIELDS EACH DEVICE TYPE HAS, AND WHICH ARE MANDATORY — one rule, used by ADD DEVICE and
 * by BULK UPLOAD, so the form and the Excel sheet always ask for the same things.
 *
 * A type listed here shows only its own fields; a type not listed (Desktop, Laptop, and any
 * type added later in Device Master) shows every field.
 */
export const FIELDS_BY_DEVICE = {
  printer: new Set([
    "asset_sn",
    "department",
    "location",
    "plant",
    "ip_address",
    "warranty_status",
    "warranty_start_date",
    "last_date_of_warranty",
    "total_warranty_years",
    "description",
    "status",
    // STATUS on the form = In Use / In Spare (stored as device_status) — every device type has it.
    "device_status",
  ]),
  tablet: new Set([
    // Device Details, as on the register's TABLET sheet: PO No., Asset Code, Asset S/N.
    "po_no",
    "asset_code",
    "asset_sn",
    // Allocation: where the tablet is (Company shows beside Plant, from the plant chosen).
    "plant",
    "ip_address",
    "department",
    "location",
    "processor",
    "ram",
    "rom",
    "system_type",
    "warranty_status",
    "warranty_start_date",
    "last_date_of_warranty",
    "total_warranty_years",
    "status",
    // STATUS on the form = In Use / In Spare (stored as device_status) — every device type has it.
    "device_status",
  ]),
};

/**
 * Fields a type SHOWS but does not require. Every shown field is otherwise mandatory. A tablet
 * has the TABLET sheet's PO No., IP Address, Asset Code and Asset S/N on its form, all OPTIONAL:
 * a tablet can be added without any of them, and saved with whichever are filled in.
 */
export const OPTIONAL_BY_DEVICE = {
  tablet: new Set(["po_no", "ip_address", "asset_code", "asset_sn"]),
};

/** Whether `field` may be left empty for this device type (its name, e.g. "tablet"). */
export const isOptionalFor = (deviceName, field) =>
  Boolean(OPTIONAL_BY_DEVICE[String(deviceName ?? "").toLowerCase()]?.has(field));

/**
 * The rules for one device type (its name, e.g. "laptop"), exactly as ADD DEVICE applies them:
 *
 *   shows(field)  the field is on the form for this type
 *   required      the fields that must be filled in (with their labels), in form order
 *
 * The Hardware and Software groups count as present when any of their fields is shown; the
 * Charger belongs to laptops only.
 */
export function deviceFieldRules(deviceName) {
  const name = String(deviceName ?? "").toLowerCase();
  const allowed = FIELDS_BY_DEVICE[name];
  const shows = (field) => !allowed || allowed.has(field);
  const any = (...fields) => fields.some(shows);
  const hardwareShown = any("processor", "ram", "rom", "hdd", "system_type");
  const softwareShown = any("os", "os_service_pack", "ms_office", "software_1", "software_2", "charger");
  const isLaptop = name === "laptop";

  const required = [
    ["asset_code", "Asset Code", shows("asset_code")],
    ["asset_sn", "Asset S/N", shows("asset_sn")],
    ["service_tag", "Service Tag", shows("service_tag")],
    ["po_no", "PO No.", shows("po_no")],
    ["processor", "Processor", hardwareShown],
    ["ram", "RAM", hardwareShown],
    ["rom", "ROM", hardwareShown && shows("rom")],
    ["hdd", "HDD", hardwareShown && shows("hdd")],
    ["system_type", "System Type", hardwareShown],
    ["os", "Operating System", softwareShown],
    ["os_service_pack", "OS Service Pack", softwareShown],
    ["ms_office", "MS Office", softwareShown],
    ["software_1", "Software 1", softwareShown],
    ["software_2", "Software 2", softwareShown],
    ["charger", "Charger Adaptor", softwareShown && isLaptop],
    ["plant", "Plant", shows("plant")],
    ["department", "Department", shows("department")],
    ["location", "Location", shows("location")],
    ["ip_address", "IP Address", shows("ip_address")],
    ["device_status", "Device Status", shows("device_status")],
    ["warranty_status", "Warranty Status", true],
    ["warranty_start_date", "Warranty Start Date", true],
    ["last_date_of_warranty", "Warranty End Date", true],
    ["total_warranty_years", "Total Warranty (In Years)", true],
    // Description is OPTIONAL for every device type — on the form and in Bulk Upload.
  ]
    .filter(([key, , needed]) => needed && !isOptionalFor(name, key))
    .map(([key, label]) => ({ key, label }));

  /*
   * A field the type does not have. The External fields go with their part (External RAM
   * with RAM, …) and Charger with laptops; Status is on every form.
   */
  const has = (field) => {
    if (field === "status") return true;
    // ACTION HISTORY (Assign To Employee, Start Date): every type but a printer, which goes to
    // a department and keeps no employee history — as on the form.
    if (field.startsWith("assign_")) return name !== "printer";
    if (field === "charger") return softwareShown && isLaptop;
    // KEYBOARD and MOUSE (their serial numbers) — desktops only, as on the Desktop sheet.
    if (field === "keyboard" || field === "mouse") return name === "desktop";
    const part = field.startsWith("external_") ? field.slice("external_".length) : field;
    if (["processor", "ram", "rom", "hdd", "system_type"].includes(part)) {
      return hardwareShown && shows(part);
    }
    if (["os", "os_service_pack", "ms_office", "software_1", "software_2"].includes(part)) return softwareShown;
    return shows(part);
  };

  return { shows, has, required };
}
