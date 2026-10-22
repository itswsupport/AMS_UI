import { API_BASE_URL } from "@/config/api";
import { USER_KEY } from "@/lib/session";

function ensureTrailingSlash(url) {
  const [p, q] = url.split("?");
  const s = p.endsWith("/") ? p : p + "/";
  return q ? s + "?" + q : s;
}

function absolute(endpoint) {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : (typeof window !== "undefined" ? window.location.origin : "") + API_BASE_URL;
  return ensureTrailingSlash(base + "/" + endpoint);
}

/*
 * WHO IS ASKING. Every request carries the signed-in employee code in X-Emp-Code, so the
 * backend can store it as reg_by on whatever is added — any master, device, server, software,
 * licence or bulk upload — without each form having to send it.
 */
function currentEmpCode() {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return String(u?.emp_code ?? u?.user_id ?? "");
  } catch {
    return "";
  }
}

function userHeader() {
  const code = typeof window !== "undefined" ? currentEmpCode() : "";
  return code ? { "X-Emp-Code": code } : {};
}

export const getAuthHeaders = () => ({ "Content-Type": "application/json", ...userHeader() });

/*
 * ONE REQUEST PER API AT A TIME. When two parts of a screen ask for the same GET together (the
 * Add Device count cards and its device list both want asset/status), only ONE request goes to
 * the server and both get its answer. Nothing is kept afterwards: the next call — after a
 * save, say — always fetches fresh data. Each caller gets its own copy, so one changing its
 * list cannot change another's.
 */
const inFlight = new Map();

/*
 * MASTER LISTS ARE KEPT FOR 5 MINUTES. RAM, OS, plants, departments, employees … change rarely,
 * yet every form fetched all of them each time it opened (Add Device: ~14 lists). Now a list is
 * fetched once and reused for 5 minutes.
 *
 * Never stale after a change: ANY save, update or delete (apiPost / apiPut / apiDelete) clears
 * them all, and so does signing in or out. Device, server and software records themselves
 * (asset/…, serverasset/…, software/…) are never kept — they are always fetched fresh.
 */
const MASTER_LISTS = new Set([
  "company/list", "department/list", "location/list", "employee/list", "devicestatus/list",
  "device/list", "devicename/list", "model/list", "hdd/list", "ipaddress/list", "os/list",
  "processor/list", "ram/list", "systemtype/list", "warranty/list", "product/list",
  "license/list", "server/list", "category/list", "subcategory/list", "plantcategory/list",
  "vendor/list",
]);
const MASTER_TTL_MS = 5 * 60 * 1000;
const kept = new Map(); // url -> { at, text }
// Goes up on every change; an answer is kept only if no change happened while it was coming.
let generation = 0;

/** Forget every kept master list — after any change, and on sign-in / sign-out. */
export function clearApiCache() {
  kept.clear();
  generation += 1;
}

export async function apiGet(endpoint, params = {}) {
  const url = new URL(absolute(endpoint));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined) url.searchParams.append(k, v);
  });
  const key = url.toString();
  const keepable = MASTER_LISTS.has(String(endpoint).replace(/^\/+|\/+$/g, ""));
  const hit = keepable ? kept.get(key) : null;
  if (hit && Date.now() - hit.at < MASTER_TTL_MS) return JSON.parse(hit.text);

  const startedAt = generation;
  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetch(key, { method: "GET", headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("API Error: " + res.status);
        return res.text();
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const text = await pending;
  if (keepable && startedAt === generation) {
    // Only a good answer is kept — never a failed one, nor one a change overtook.
    try {
      if (JSON.parse(text)?.status_code === 200) kept.set(key, { at: Date.now(), text });
    } catch {
      /* not JSON — not kept */
    }
  }
  return JSON.parse(text);
}

export async function apiPost(endpoint, data, isFormData = false) {
  // A change: kept master lists may now be out of date (before AND after, so a list read
  // while this is on its way is not kept either).
  clearApiCache();
  const res = await fetch(ensureTrailingSlash(API_BASE_URL + "/" + endpoint), {
    method: "POST",
    headers: isFormData ? userHeader() : getAuthHeaders(),
    body: isFormData ? data : JSON.stringify(data),
  });
  clearApiCache();
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}

export async function apiPut(endpoint, data) {
  clearApiCache();
  const res = await fetch(ensureTrailingSlash(API_BASE_URL + "/" + endpoint), {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  clearApiCache();
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}

export async function apiDelete(endpoint, params = {}) {
  clearApiCache();
  const url = new URL(absolute(endpoint));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined) url.searchParams.append(k, v);
  });
  const res = await fetch(url.toString(), { method: "DELETE", headers: getAuthHeaders() });
  clearApiCache();
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}
