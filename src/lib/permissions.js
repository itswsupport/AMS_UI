/**
 * Role and permission model for the Asset Management System.
 *
 * Three roles, in descending order of authority:
 *
 *   ADMIN  - full control. Manages the asset register, allocations, maintenance,
 *            masters and users.
 *   USER   - an employee who holds assets. Sees only their own assets, and can raise
 *            requests and service tickets.
 *   VIEWER - read-only oversight. Sees everything ADMIN sees, but changes nothing.
 *
 * VIEWER deliberately outranks USER in visibility while holding no write permission at
 * all; the two are not on a simple ladder, which is why route access is decided by
 * PERMISSIONS rather than by comparing hierarchy numbers alone.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  VIEWER: "VIEWER",
  USER: "USER",
};

export const ROLE_HIERARCHY = {
  ADMIN: 3,
  VIEWER: 2,
  USER: 1,
};

export const ROLE_LIST = [
  { code: ROLES.ADMIN, label: "Admin" },
  { code: ROLES.USER, label: "User" },
  { code: ROLES.VIEWER, label: "Viewer" },
];

export const ROLE_OPTIONS = ROLE_LIST.map((r) => ({ value: r.code, label: r.label }));

export const PERMISSIONS = {
  // Asset register
  VIEW_ASSETS: "view_assets",
  CREATE_ASSETS: "create_assets",
  EDIT_ASSETS: "edit_assets",
  DELETE_ASSETS: "delete_assets",

  // Allocation / return
  VIEW_ALLOCATIONS: "view_allocations",
  ALLOCATE_ASSETS: "allocate_assets",
  RETURN_ASSETS: "return_assets",

  // Requests raised by employees
  VIEW_OWN_ASSETS: "view_own_assets",
  RAISE_REQUEST: "raise_request",
  APPROVE_REQUEST: "approve_request",

  // Maintenance
  VIEW_MAINTENANCE: "view_maintenance",
  RAISE_MAINTENANCE: "raise_maintenance",
  MANAGE_MAINTENANCE: "manage_maintenance",

  // Masters (department, category, location, vendor)
  VIEW_MASTERS: "view_masters",
  MANAGE_MASTERS: "manage_masters",

  // Reporting
  VIEW_REPORTS: "view_reports",
  EXPORT_REPORTS: "export_reports",

  // Administration
  VIEW_DASHBOARD: "view_dashboard",
  MANAGE_USERS: "manage_users",
  SYSTEM_SETTINGS: "system_settings",
};

export const ROLE_PERMISSIONS = {
  ADMIN: [...Object.values(PERMISSIONS)],

  VIEWER: [
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_ALLOCATIONS,
    PERMISSIONS.VIEW_MAINTENANCE,
    PERMISSIONS.VIEW_MASTERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_DASHBOARD,
  ],

  USER: [
    PERMISSIONS.VIEW_OWN_ASSETS,
    PERMISSIONS.RAISE_REQUEST,
    PERMISSIONS.RAISE_MAINTENANCE,
    PERMISSIONS.VIEW_DASHBOARD,
  ],
};


/*
 * MORE THAN ONE ROLE — an employee can hold ADMIN and USER together (ticked in Reporting Person,
 * stored in ams_login_access.role as "ADMIN,USER"). They have BOTH at once: every permission of
 * each role, and one sidebar with both menus (Setting and User Dashboard). No choosing, no
 * switching. VIEWER is never combined with another role.
 */

/** The order roles are stored and shown in: "ADMIN,USER", "Admin, User". */
const ROLE_ORDER = [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER];

/** "ADMIN,USER", "user", ["USER","ADMIN"] → ["ADMIN","USER"]: known roles only, no repeats. */
export function parseRoles(value) {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
  const wanted = new Set(parts.map((r) => String(r?.authority ?? r).trim().toUpperCase()));
  return ROLE_ORDER.filter((r) => wanted.has(r));
}

/** As saved: "ADMIN,USER". */
export const joinRoles = (roles) => parseRoles(roles).join(",");

/** As shown: "Admin, User". */
export const formatRoles = (value) =>
  parseRoles(value)
    .map((r) => ROLE_LIST.find((x) => x.code === r)?.label ?? r)
    .join(", ");

/** Why this combination cannot be saved, or "" — VIEWER stands alone. */
export function rolesProblem(roles) {
  const list = parseRoles(roles);
  if (!list.length) return "Select a role.";
  if (list.includes(ROLES.VIEWER) && list.length > 1) return "Viewer cannot be combined with another role.";
  return "";
}

/** Every role this person holds — from `roles`, a combined `role`, or the authorities. */
export function getUserRoles(user) {
  if (!user) return [];
  return parseRoles([
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...String(user.role ?? "").split(","),
    ...(Array.isArray(user.authorities) ? user.authorities : []),
    user.authority ?? "",
  ]);
}

/** True when the person holds more than one role (Admin + User). */
export const hasMultipleRoles = (user) => getUserRoles(user).length > 1;

/**
 * THE MAIN ROLE — the highest one held (ADMIN over VIEWER over USER). It decides the landing
 * page and the plant / device-type limit: someone who is ADMIN as well as USER is not limited.
 * What they may OPEN is every role's permissions together (getUserPermissions).
 */
export function getUserRole(user) {
  if (!user) return ROLES.USER;
  const roles = getUserRoles(user);
  const priority = [ROLES.ADMIN, ROLES.VIEWER, ROLES.USER];
  return priority.find((r) => roles.includes(r)) ?? ROLES.USER;
}

/** Every authority string attached to the user, uppercased. */
export function getUserAuthorities(user) {
  if (!user) return [];
  if (Array.isArray(user.authorities)) {
    return user.authorities.map((a) => String(a.authority || a).toUpperCase()).filter(Boolean);
  }
  if (user.authority) return [String(user.authority).toUpperCase()];
  if (user.role) return [String(user.role).toUpperCase()];
  return [];
}

export function getUserPermissions(user) {
  const roles = getUserRoles(user);
  const list = roles.length ? roles : [getUserRole(user)];
  return [...new Set(list.flatMap((r) => ROLE_PERMISSIONS[r] || []))];
}

export function hasPermission(user, permission) {
  return getUserPermissions(user).includes(permission);
}

export function hasAnyPermission(user, permissions = []) {
  const userPermissions = getUserPermissions(user);
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(user, permissions = []) {
  const userPermissions = getUserPermissions(user);
  return permissions.every((p) => userPermissions.includes(p));
}

export function canAccessRole(user, targetRole) {
  const userLevel = ROLE_HIERARCHY[getUserRole(user)] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return userLevel >= targetLevel;
}

export const isAdmin = (user) => getUserRole(user) === ROLES.ADMIN;

/**
 * Read-only oversight. Kept as its own helper (rather than a role comparison) because
 * screens shared between ADMIN and VIEWER use it to hide action buttons.
 */
export const isViewer = (user) => getUserRole(user) === ROLES.VIEWER;

export const isPlainUser = (user) => getUserRole(user) === ROLES.USER;

/** The landing dashboard for a role. Used by app/page.js and the sidebar. */
export function dashboardForRole(role) {
  switch (role) {
    /*
     * An admin lands on SETTING, where their work is (the masters). /AdminDashboard itself is
     * an empty page, still reachable from the sidebar's HOME. This has to point somewhere
     * real: Login/page.jsx routes straight here on success, so a stale path would put every
     * admin sign-in on a 404.
     */
    case ROLES.ADMIN:
      return "/AdminDashboard/Setting";
    case ROLES.VIEWER:
      return "/ViewerDashboard";
    case ROLES.USER:
    default:
      return "/UserDashboard";
  }
}

/** Department scoping: an ADMIN or VIEWER sees every department, a USER sees their own. */
export function accessibleDepartments(user, allDepartments = []) {
  const role = getUserRole(user);
  if (role === ROLES.ADMIN || role === ROLES.VIEWER) return allDepartments;
  const own = user?.department ? String(user.department).toUpperCase() : null;
  return own ? allDepartments.filter((d) => String(d.code || d).toUpperCase() === own) : [];
}
