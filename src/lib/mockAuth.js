/**
 * Frontend-only authentication.
 *
 * There is no AMS backend yet, so the app signs users in against this fixed list
 * instead of calling an API. It exists purely so every screen and every role can be
 * opened and reviewed while the UI is being built.
 *
 * Turn it off by setting NEXT_PUBLIC_MOCK_AUTH=false once the real /login endpoint is
 * live; AuthContext then falls back to the HTTP call and nothing here is used.
 *
 * Obviously: these are demo credentials in client-side source. They are not a security
 * boundary and must never survive into a build that talks to real data.
 */

import { ROLES } from "@/lib/permissions";
import { DEPARTMENTS } from "@/config/constants";

export const MOCK_AUTH_ENABLED = process.env.NEXT_PUBLIC_MOCK_AUTH !== "false";

/** userId -> account. Password is deliberately the same as the user id. */
const MOCK_USERS = {
  admin: {
    user_id: "admin",
    password: "admin",
    userFname: "Asha",
    userLname: "Kulkarni",
    role: ROLES.ADMIN,
    department: DEPARTMENTS.IT,
    email: "admin@example.com",
  },
  user: {
    user_id: "user",
    password: "user",
    userFname: "Rohit",
    userLname: "Deshmukh",
    role: ROLES.USER,
    department: DEPARTMENTS.OPERATIONS,
    email: "user@example.com",
  },
  // ADMIN + USER together — both menus (Setting and User Dashboard) in one sidebar.
  both: {
    user_id: "both",
    password: "both",
    userFname: "Ganesh",
    userLname: "Barathe",
    role: `${ROLES.ADMIN},${ROLES.USER}`,
    department: DEPARTMENTS.IT,
    email: "both@example.com",
  },
  viewer: {
    user_id: "viewer",
    password: "viewer",
    userFname: "Meera",
    userLname: "Joshi",
    role: ROLES.VIEWER,
    department: DEPARTMENTS.HR,
    email: "viewer@example.com",
  },
};

/** Shown on the login page so nobody has to read the source to get in. */
export const MOCK_CREDENTIALS = Object.values(MOCK_USERS).map((u) => ({
  userId: u.user_id,
  password: u.password,
  role: u.role,
}));

/**
 * Resolve a mock login. Returns the user object without the password, shaped the way
 * getUserRole() in @/lib/permissions expects.
 */
export function mockLogin(userId, password) {
  const key = String(userId || "").trim().toLowerCase();
  const account = MOCK_USERS[key];

  if (!account || account.password !== password) {
    throw new Error("Invalid user ID or password");
  }

  const { password: _omit, ...user } = account;
  return {
    ...user,
    name: `${user.userFname} ${user.userLname}`,
    // One authority per role ("ADMIN,USER" gives two), as the real login sends them.
    authorities: String(user.role).split(",").map((authority) => ({ authority })),
  };
}
