/**
 * SESSION IDLE TIMER — a login stays valid for 30 MINUTES OF INACTIVITY (the same rule as the
 * Compliance Management app). The time of the last activity is kept in localStorage, so every
 * open tab shares one clock; useIdleLogout (src/hooks) watches it and signs the user out.
 */

/** 30 minutes without activity ends the session. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** How often a tab checks whether the session was ended in another tab. */
export const SESSION_CHECK_MS = 15 * 1000;

/** The localStorage key holding the last activity time (ms). */
export const LAST_ACTIVITY_KEY = "ams_last_activity";

/** The signed-in user (see AuthContext). */
export const USER_KEY = "ams_user";

// A localStorage write is synchronous — not one per mouse move.
const WRITE_THROTTLE_MS = 5000;
let lastWrite = 0;

/**
 * Record that the user is still active.
 * @param {boolean} force skip the throttle (on login and when a page opens).
 */
export function markActivity(force = false) {
  const now = Date.now();
  if (!force && now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    /* private window / storage full — nothing to keep */
  }
}

/** How long since the last activity, in ms. No stamp yet (just signed in) counts as active. */
export function getIdleMs() {
  let ts = 0;
  try {
    ts = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  } catch {
    return 0;
  }
  if (!ts || Number.isNaN(ts)) return 0;
  // A clock change or a stamp from the future must not end the session.
  return Math.max(0, Date.now() - ts);
}

/** True once 30 minutes have passed without activity. */
export function isIdleExpired() {
  return getIdleMs() >= SESSION_IDLE_MS;
}

/** Whether a session is still stored — false once another tab signed out or timed out. */
export function hasStoredSession() {
  try {
    const v = localStorage.getItem(USER_KEY);
    return Boolean(v && v !== "undefined");
  } catch {
    return false;
  }
}

/** Forget the activity time (on sign-out). */
export function clearActivity() {
  lastWrite = 0;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* nothing to clear */
  }
}
