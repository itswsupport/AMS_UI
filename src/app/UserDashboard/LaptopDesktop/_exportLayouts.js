/*
 * THE REGISTER EXPORT LAYOUTS — the exact columns, in order, that Excel / PDF / Print write for
 * each device type (Desktop, Laptop, Printer, Tablet), as the IT team's registers lay them out.
 * Shared by every device list that exports, so the sheets are the same wherever they come from.
 * Rows need the full device record (AssetBO fields); types not listed export the screen.
 */

import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";

/**
 * "3 yr 11 mo" → "3.11", "5 yr 1 mo" → "5.01", "5 mo" → "0.05" — AGE as Year.Month for the
 * register sheets, the month always two digits (01 to 11) so 5.01 and 5.10 never read alike.
 */
const ageYearMonth = (age) => {
  if (!age) return "";
  const years = /(\d+)\s*yr/.exec(age)?.[1] ?? "0";
  const months = /(\d+)\s*mo/.exec(age)?.[1] ?? "0";
  return `${years}.${months.padStart(2, "0")}`;
};

/*
 * THE DESKTOP SHEET — the columns Excel, PDF and Print give for the Desktop tab, in exactly
 * this order (the layout the IT team's desktop register uses). The screen table is unchanged;
 * this only decides what the three export buttons write.
 *
 * KEYBOARD has no field anywhere yet (not in the database or the form), so it is exported as
 * an empty column, keeping the sheet's layout.
 */
const DESKTOP_EXPORT_COLUMNS = [
  { label: "SR. NO." },
  { key: "po_no", label: "PO No." },
  { key: "asset_code", label: "Asset Code" },
  { key: "asset_sn", label: "Asset S/N" },
  { key: "name", label: "PC NAME" },
  { key: "device_status", label: "STATUS" },
  { key: "ip_address", label: "IP ADDRESS" },
  { key: "plant", label: "PLANT" },
  { key: "age", label: "AGE (Year.Month)", render: (r) => ageYearMonth(r.age) },
  { key: "employee_name", label: "USER" },
  { key: "os", label: "OS" },
  { key: "system_type", label: "System Type" },
  { key: "ms_office", label: "MSOFFICE" },
  { key: "software_1", label: "OTHER SOFTWARE-1" },
  { key: "keyboard", label: "KEYBOARD", render: () => "" },
  { key: "status", label: "Status", render: (r) => (r.status === 1 ? "Active" : "Inactive") },
  { key: "classification", label: "Classification" },
];

/*
 * THE LAPTOP SHEET — the same idea as the desktop one, in the laptop register's order.
 *
 * TYPE is the laptop's model. EXP. SERVICE CODE (the sheet lists it twice) has no field
 * anywhere yet, so both are exported empty, keeping the sheet's layout.
 */
const LAPTOP_EXPORT_COLUMNS = [
  { label: "Sr no" },
  { key: "asset_code", label: "Asset Code" },
  { key: "asset_sn", label: "Asset S/N" },
  { key: "name", label: "PC NAME" },
  { key: "device_status", label: "STATUS" },
  { key: "ip_address", label: "IP ADDRESS" },
  { key: "plant", label: "PLANT" },
  { key: "model", label: "TYPE" },
  { key: "service_tag", label: "SERVICE TAG / SR. NO." },
  { key: "exp_service_code_1", label: "EXP. SERVICE  CODE", render: () => "" },
  { key: "exp_service_code_2", label: "EXP. SERVICE  CODE", render: () => "" },
  { key: "processor", label: "PROCESSOR Ghz" },
  { key: "ram", label: "RAM" },
  { key: "hdd", label: "HDD (GB)" },
  { key: "warranty_status", label: "Warranty Status" },
  { key: "employee_name", label: "USER" },
  { key: "os", label: "OS" },
  { key: "os_service_pack", label: "OS Service Pack" },
  { key: "system_type", label: "System Type" },
  { key: "ms_office", label: "MSOFFICE" },
  { key: "charger", label: "CHARGER ADAPTOR" },
  { key: "software_1", label: "OTHER SOFTWARE-1" },
  { key: "software_2", label: "OTHER SOFTWARE-2" },
  { key: "status", label: "Status", render: (r) => (r.status === 1 ? "Active" : "Inactive") },
  { key: "classification", label: "Classification" },
];

/*
 * THE PRINTER SHEET. TYPE is the printer's model. A printer goes to a department rather than a
 * person, so USER is whoever the record names, and is usually blank — DEPT says where it is.
 */
const PRINTER_EXPORT_COLUMNS = [
  { label: "SR. NO." },
  { key: "description", label: "DESCRIPTION" },
  { key: "ip_address", label: "IP ADDRESS" },
  { key: "plant", label: "PLANT" },
  { key: "department", label: "DEPT" },
  { key: "location", label: "LOCATION" },
  { key: "model", label: "TYPE" },
  { key: "asset_sn", label: "S/N" },
  { key: "warranty_status", label: "Warranty Status" },
  {
    key: "last_date_of_warranty",
    label: "Last Date Of Warrantee",
    render: (r) => fmtDate(r.last_date_of_warranty),
  },
  { key: "total_warranty_years", label: "Total Warranty (In Years)" },
  { key: "age", label: "AGE (Year.Month)", render: (r) => ageYearMonth(r.age) },
  { key: "employee_name", label: "USER" },
];

/*
 * THE TABLET SHEET — exactly the tablet register's 17 columns, in this order. TYPE is the
 * tablet's model; a tablet's storage is ROM, not HDD.
 */
const TABLET_EXPORT_COLUMNS = [
  { label: "SR. NO" },
  { key: "po_no", label: "PO No" },
  { key: "asset_code", label: "Asset Code" },
  { key: "asset_sn", label: "Asset S/N" },
  { key: "name", label: "TABLET NAME" },
  { key: "device_status", label: "STATUS" },
  { key: "ip_address", label: "IP ADDRESS" },
  { key: "plant", label: "PLANT" },
  { key: "department", label: "DEPT." },
  { key: "location", label: "LOCATION" },
  { key: "model", label: "TYPE" },
  { key: "processor", label: "PROCESSOR Ghz" },
  { key: "ram", label: "RAM" },
  { key: "rom", label: "ROM (GB)" },
  { key: "warranty_status", label: "Warranty Status" },
  { key: "age", label: "AGE (Year.Month)", render: (r) => ageYearMonth(r.age) },
  { key: "system_type", label: "System Type" },
];

/** Device type (lower case) → its fixed export layout. Types not listed export the screen. */
export const EXPORT_LAYOUTS = {
  desktop: DESKTOP_EXPORT_COLUMNS,
  laptop: LAPTOP_EXPORT_COLUMNS,
  printer: PRINTER_EXPORT_COLUMNS,
  tablet: TABLET_EXPORT_COLUMNS,
};
