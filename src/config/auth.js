/**
 * Where unauthenticated and logged-out users get sent.
 *
 * One environment variable decides, so local-only edits never leak into a build:
 *
 *   NEXT_PUBLIC_LOGIN_MODE=local   - the app owns its /Login page (default).
 *   NEXT_PUBLIC_LOGIN_MODE=portal  - the app is launched from an external portal, so
 *                                    users are handed back to that portal.
 */

import { BASE_PATH } from "./api";

export const LOGIN_MODE = process.env.NEXT_PUBLIC_LOGIN_MODE || "local";

// Where the portal sends users in (unauthenticated hitting a protected page).
export const PORTAL_ENTRY_URL = process.env.NEXT_PUBLIC_PORTAL_ENTRY_URL || "";

// Where users land back on the portal after logging out.
export const PORTAL_DASHBOARD_URL = process.env.NEXT_PUBLIC_PORTAL_DASHBOARD_URL || "";

export const LOCAL_LOGIN_PATH = "/Login";

/** Someone hit a protected page without a session. */
export function redirectUnauthenticated(router) {
  if (LOGIN_MODE === "portal" && PORTAL_ENTRY_URL) {
    window.location.href = PORTAL_ENTRY_URL;
    return;
  }
  // Trailing slash on purpose: next.config.mjs sets trailingSlash:true, so "/Login" is
  // answered with a 308 to "/Login/". Navigating straight to the canonical form skips that
  // extra hop — which matters most during logout, when this fires alongside the hard
  // navigation in redirectAfterLogout().
  router.replace(`${LOCAL_LOGIN_PATH}/`);
}

/**
 * Where "leaving the app" lands: the portal home page when we were launched from it,
 * our own login page when running locally.
 */
export function exitUrl() {
  if (LOGIN_MODE === "portal" && PORTAL_DASHBOARD_URL) return PORTAL_DASHBOARD_URL;
  return `${BASE_PATH}${LOCAL_LOGIN_PATH}/`;
}

/** Someone logged out. Hard navigation - the reload is what clears React state. */
export function redirectAfterLogout() {
  window.location.href = exitUrl();
}
