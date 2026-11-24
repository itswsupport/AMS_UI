"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config/api";
import { redirectAfterLogout } from "@/config/auth";
import { MOCK_AUTH_ENABLED, mockLogin } from "@/lib/mockAuth";
import { markActivity, clearActivity } from "@/lib/session";
import { clearApiCache } from "@/lib/api";
import { getReportingPersonList } from "@/services/reportingPersonService";

export const AuthContext = createContext();

/*
 * One person's own working data kept in the browser (e.g. a Bulk Upload preview not uploaded
 * yet). Cleared whenever someone signs in or out, so the next person never sees it.
 */
const PER_USER_PREFIXES = ["ams_bulk_upload_"];
function clearPerUserData() {
  // Master lists kept by the API helper start fresh for the next person too.
  clearApiCache();
  try {
    Object.keys(localStorage)
      .filter((k) => PER_USER_PREFIXES.some((p) => k.startsWith(p)))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable (private window) — nothing kept, nothing to clear */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first paint.
  useEffect(() => {
    const stored = localStorage.getItem("ams_user");
    let restored = null;
    if (stored && stored !== "undefined") {
      try {
        restored = JSON.parse(stored);
        setUser(restored);
      } catch (err) {
        localStorage.removeItem("ams_user");
      }
    }
    setLoading(false);

    /*
     * ACCESS KEPT UP TO DATE. The plants, companies, device types and role saved at sign-in can
     * be changed afterwards in Setting → Login Access. Read again from the database each time the
     * app opens, so a change shows at once — e.g. plants 2001 / 3001 given today appear in Add
     * Device without signing in again. Only this person's own row is used; if it cannot be read,
     * the session simply keeps what it had.
     */
    if (!restored?.token || MOCK_AUTH_ENABLED) return;
    getReportingPersonList()
      .then((res) => {
        const rows = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        const mine = rows.find(
          (r) => String(r.emp_code) === String(restored.emp_code ?? restored.user_id) && r.status === 1
        );
        if (!mine) return;
        const plantCodes = String(mine.plant_code ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        const fresh = {
          ...restored,
          plant_code: mine.plant_code ?? restored.plant_code,
          plant_codes: plantCodes,
          plant_company: mine.company_name ?? restored.plant_company,
          device_ids: Array.isArray(mine.device_ids) ? mine.device_ids : restored.device_ids,
          role: mine.role || restored.role,
        };
        if (JSON.stringify(fresh) === JSON.stringify(restored)) return;
        setUser(fresh);
        localStorage.setItem("ams_user", JSON.stringify(fresh));
      })
      .catch(() => {
        /* offline or not allowed — keep the access from sign-in */
      });
  }, []);

  /*
   * OTHER TABS: when someone signs in as another person (or signs out) in one tab, every other
   * open AMS tab reloads at once — so no tab keeps showing the previous person's dashboard.
   */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "ams_user" && e.newValue !== e.oldValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * @param empCode  the employee code from db_all_master.emp_details (the login form's
   *                 first field), not a username.
   */
  const login = async (empCode, password) => {
    // Demo accounts, for reviewing screens without the backend running.
    if (MOCK_AUTH_ENABLED) {
      const data = mockLogin(empCode, password);
      clearPerUserData();
      markActivity(true);
      setUser(data);
      localStorage.setItem("ams_user", JSON.stringify(data));
      return data;
    }

    /*
     * POST, not GET: the password must stay out of access logs and browser history.
     *
     * The trailing slash is required, not cosmetic. next.config.mjs sets trailingSlash:true,
     * so "/api/login" is answered with a 308 to "/api/login/" — an extra round trip, and a
     * redirect some HTTP clients mishandle on a POST by dropping the method or body.
     */
    const res = await axios.post(API_BASE_URL + "/login/", null, {
      params: { emp_code: empCode, emp_pass: password },
    });

    /*
     * The backend wraps every reply in BaseResponseBO and always answers HTTP 200 — a
     * rejected sign-in included. axios therefore never throws here, so the real outcome
     * has to be read from status_code in the body. Trusting the HTTP status would let a
     * failed login through as a success.
     */
    const body = res.data;
    if (!body || body.status_code !== 200 || !body.response) {
      throw new Error(body?.message || "Login failed");
    }

    const data = body.response;
    // A new person signing in: nothing of whoever used this browser before carries over.
    clearPerUserData();
    // The 30-minute idle clock starts now — a stamp left by a closed browser must not end it.
    markActivity(true);
    setUser(data);
    localStorage.setItem("ams_user", JSON.stringify(data));
    return data;
  };

  /**
   * Sign out. `logout({ redirect: false })` clears the session but stays on the page — used by the
   * 30-minute idle timeout (useIdleLogout), which says why before going to the login page.
   * Called from a button, the argument is the click event, so it redirects as usual.
   */
  const logout = useCallback(async (opts) => {
    const redirect = !(opts && opts.redirect === false);
    const empCode = user?.emp_code ?? user?.user_id;

    // The local session is cleared FIRST, so it never depends on the network.
    setUser(null);
    localStorage.removeItem("ams_user");
    clearPerUserData();
    clearActivity();

    /*
     * Best-effort: the server keeps no session, so /logout only records the event. If it is
     * unreachable the local session is still cleared — otherwise a backend outage would trap
     * someone inside the app with no way to sign out.
     */
    if (!MOCK_AUTH_ENABLED) {
      try {
        await axios.post(API_BASE_URL + "/logout/", null, { params: { emp_code: empCode } });
      } catch (err) {
        // Deliberately ignored — see above.
      }
    }

    if (redirect) redirectAfterLogout();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
