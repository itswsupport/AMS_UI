/**
 * Centralized API configuration - single source of truth for the API base URL.
 *
 * There is deliberately no NODE_ENV branching here. Local and live differ only by the
 * value of NEXT_PUBLIC_API_BASE_URL, which comes from the environment (.env.local for a
 * dev machine, a build arg for the live server). The default "/ams/api" is a relative
 * path proxied to the backend by the rewrite in next.config.mjs, so it is correct in
 * both places.
 *
 * Usage:
 *   import { API_BASE_URL } from "@/config/api";
 *   axios.get(`${API_BASE_URL}/login/`)
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

// Next's basePath. window.location and fetch() do not apply it automatically, so any
// hard navigation or non-axios request has to prepend it explicitly. Empty because the
// app currently serves from the root - set NEXT_PUBLIC_BASE_PATH if that changes.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const getApiUrl = (endpoint) => `${API_BASE_URL}/${String(endpoint).replace(/^\//, "")}`;

export default API_BASE_URL;
