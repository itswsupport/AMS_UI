import { API_BASE_URL } from "@/config/api";

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

export const getAuthHeaders = () => ({ "Content-Type": "application/json" });

export async function apiGet(endpoint, params = {}) {
  const url = new URL(absolute(endpoint));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined) url.searchParams.append(k, v);
  });
  const res = await fetch(url.toString(), { method: "GET", headers: getAuthHeaders() });
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}

export async function apiPost(endpoint, data, isFormData = false) {
  const res = await fetch(ensureTrailingSlash(API_BASE_URL + "/" + endpoint), {
    method: "POST",
    headers: isFormData ? {} : getAuthHeaders(),
    body: isFormData ? data : JSON.stringify(data),
  });
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}

export async function apiPut(endpoint, data) {
  const res = await fetch(ensureTrailingSlash(API_BASE_URL + "/" + endpoint), {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}

export async function apiDelete(endpoint, params = {}) {
  const url = new URL(absolute(endpoint));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined) url.searchParams.append(k, v);
  });
  const res = await fetch(url.toString(), { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) throw new Error("API Error: " + res.status);
  return res.json();
}
