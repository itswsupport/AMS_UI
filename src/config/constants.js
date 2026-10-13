/**
 * Domain constants for the Asset Management System.
 *
 * These are the values the UI renders in dropdowns and badges. The backend masters
 * (see services/masterService.js) remain the source of truth once they are wired up -
 * these exist so screens are usable before the API is live, and so the spelling of a
 * department or status is defined in exactly one place.
 */

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export const DEPARTMENTS = {
  IT: "IT",
  OPERATIONS: "OPERATIONS",
  HR: "HR",
};

export const DEPARTMENT_LIST = [
  { code: DEPARTMENTS.IT, label: "IT" },
  { code: DEPARTMENTS.OPERATIONS, label: "Operations" },
  { code: DEPARTMENTS.HR, label: "HR" },
];

export const DEPARTMENT_OPTIONS = DEPARTMENT_LIST.map((d) => ({
  value: d.code,
  label: d.label,
}));

export function departmentLabel(code) {
  const found = DEPARTMENT_LIST.find((d) => d.code === String(code || "").toUpperCase());
  return found ? found.label : code || "-";
}

// ---------------------------------------------------------------------------
// Asset lifecycle
// ---------------------------------------------------------------------------

export const ASSET_STATUS = {
  AVAILABLE: "AVAILABLE",
  ALLOCATED: "ALLOCATED",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
  RETIRED: "RETIRED",
};

export const ASSET_STATUS_LIST = [
  { code: ASSET_STATUS.AVAILABLE, label: "Available", color: "#2ed8b6" },
  { code: ASSET_STATUS.ALLOCATED, label: "Allocated", color: "#3482AE" },
  { code: ASSET_STATUS.UNDER_MAINTENANCE, label: "Under Maintenance", color: "#FFB64D" },
  { code: ASSET_STATUS.RETIRED, label: "Retired", color: "#e74c3c" },
];

export const ASSET_STATUS_OPTIONS = ASSET_STATUS_LIST.map((s) => ({
  value: s.code,
  label: s.label,
}));

export function assetStatusMeta(code) {
  return (
    ASSET_STATUS_LIST.find((s) => s.code === String(code || "").toUpperCase()) || {
      code: code || "UNKNOWN",
      label: code || "Unknown",
      color: "#6c757d",
    }
  );
}

// ---------------------------------------------------------------------------
// Requests (a User asking for an asset)
// ---------------------------------------------------------------------------

export const REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const REQUEST_STATUS_LIST = [
  { code: REQUEST_STATUS.PENDING, label: "Pending", color: "#FFB64D" },
  { code: REQUEST_STATUS.APPROVED, label: "Approved", color: "#2ed8b6" },
  { code: REQUEST_STATUS.REJECTED, label: "Rejected", color: "#e74c3c" },
];

export function requestStatusMeta(code) {
  return (
    REQUEST_STATUS_LIST.find((s) => s.code === String(code || "").toUpperCase()) || {
      code: code || "UNKNOWN",
      label: code || "Unknown",
      color: "#6c757d",
    }
  );
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export const MAINTENANCE_STATUS = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  CLOSED: "CLOSED",
};

export const MAINTENANCE_STATUS_LIST = [
  { code: MAINTENANCE_STATUS.OPEN, label: "Open", color: "#e74c3c" },
  { code: MAINTENANCE_STATUS.IN_PROGRESS, label: "In Progress", color: "#FFB64D" },
  { code: MAINTENANCE_STATUS.CLOSED, label: "Closed", color: "#2ed8b6" },
];

// Brand colour, matched to the reference project so both apps look like one suite.
export const BRAND_COLOR = "#3482AE";
export const BRAND_COLOR_DARK = "#2a6d8f";
