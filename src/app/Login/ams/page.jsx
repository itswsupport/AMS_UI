"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserRole, dashboardForRole } from "@/lib/permissions";
import { MOCK_AUTH_ENABLED, MOCK_CREDENTIALS } from "@/lib/mockAuth";
import { BASE_PATH } from "@/config/api";

/*
 * A FULL page load into THIS person's dashboard, not an in-app route change: nothing the
 * previous user had on screen (lists, counts, their menu) survives into the new session —
 * the new user sees only their own dashboard, straight away.
 */
const goToDashboard = (role) => window.location.replace(`${BASE_PATH}${dashboardForRole(role)}/`);

export default function LoginPage() {
  const { login } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(userId, password);
      // Admin + User lands on the admin's page; both menus are in the sidebar from there.
      goToDashboard(getUserRole(user));
      return;
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-[#f4f6f9]">
      {/* 360px on a computer; on a phone the screen's width less a small margin. */}
      <form onSubmit={onSubmit} className="bg-white p-6 sm:p-8 rounded shadow-md w-full max-w-[360px] mx-4">

      <h1 className="text-[18px] font-bold text-[#3482AE] mb-6 text-center">
        REPL </h1>
        <h1 className="text-[18px] font-bold text-[#3482AE] mb-6 text-center">
          ASSET MANAGEMENT SYSTEM
        </h1>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {/* The backend authenticates on emp_code from db_all_master.emp_details, so this
            is an employee code, not a username. inputMode numeric only hints the keyboard —
            the value stays a string, since the demo accounts are still words. */}
        <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
          Employee Code
        </label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          inputMode="numeric"
          autoComplete="username"
          className="w-full border rounded px-3 py-2 mb-4 text-sm"
          required
        />

        <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-6 text-sm"
          required
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[#3482AE] text-white py-2 rounded text-sm font-semibold hover:bg-[#2a6d8f] disabled:opacity-50"
        >
          {busy ? "SIGNING IN..." : "LOGIN"}
        </button>

        {/* No backend yet - click a row to fill the form. */}
        {MOCK_AUTH_ENABLED && (
          <div className="mt-6 border-t pt-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
              Demo accounts (frontend only)
            </p>
            <div className="space-y-1">
              {MOCK_CREDENTIALS.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => {
                    setUserId(c.userId);
                    setPassword(c.password);
                  }}
                  className="w-full flex justify-between items-center text-[12px] px-2 py-1 rounded hover:bg-gray-100"
                >
                  <span className="font-mono">
                    {c.userId} / {c.password}
                  </span>
                  <span className="text-gray-500">{c.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
