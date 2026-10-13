"use client";

import { useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useAuth } from "@/context/AuthContext";
import { exitUrl } from "@/config/auth";
import {
  SESSION_CHECK_MS,
  LAST_ACTIVITY_KEY,
  USER_KEY,
  markActivity,
  isIdleExpired,
  clearActivity,
  hasStoredSession,
} from "@/lib/session";

// Activity that keeps the session alive. None of these ends it — a popup in the middle of a
// scroll would startle the user and give them nothing to act on.
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"];

// A click is the deliberate act, so it is what reveals an expired session.
const EXPIRY_EVENTS = ["click"];

/**
 * SIGNS THE USER OUT AFTER 30 MINUTES WITHOUT ACTIVITY (the Compliance Management app's rule),
 * with a "Session Timed Out" message, then the login page.
 *
 * Mounted once by ProtectedLayout, for signed-in pages only. The idle gap is measured on the next
 * click; opening or refreshing a page counts as one, so an old session cannot be resumed. A
 * session ended in another tab ends this one too ("Session Ended").
 */
export function useIdleLogout() {
  const { user, logout } = useAuth();
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    expiredRef.current = false;

    // No stamp once past the limit — that would revive a dead session.
    const onActivity = () => {
      if (isIdleExpired()) return;
      markActivity();
    };

    // Check BEFORE stamping — stamping first would erase the gap being measured.
    const onClick = () => {
      checkPresence();
      if (expiredRef.current) return;
      markActivity();
    };

    const detach = () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      EXPIRY_EVENTS.forEach((evt) => window.removeEventListener(evt, onClick, true));
    };

    /*
     * notifyServer: false when another tab already signed this session out. The session is cleared
     * first (no redirect yet), the reason is said, and only then the login page — otherwise the
     * app would just vanish, which reads as a crash.
     */
    const expire = (notifyServer = true) => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      detach();
      clearActivity();
      if (notifyServer) logout({ redirect: false });

      Swal.fire({
        icon: "warning",
        title: notifyServer ? "Session Timed Out" : "Session Ended",
        text: notifyServer
          ? "Your session has expired after 30 minutes of inactivity. Please log in again."
          : "Your session was ended in another tab. Please log in again.",
        timer: 4000,
        timerProgressBar: true,
        confirmButtonText: "OK",
        confirmButtonColor: "#3482AE",
        width: "min(30rem, 92vw)",
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        // replace(), so BACK cannot return to the expired page.
        window.location.replace(exitUrl());
      });
    };

    // Polled: only catches the session disappearing from storage (another tab ended it).
    const checkStorage = () => {
      if (!hasStoredSession()) expire(false);
    };

    // When the user is clearly present: storage is the truth, not React state.
    const checkPresence = () => {
      if (!hasStoredSession()) return expire(false);
      if (isIdleExpired()) expire();
    };

    // Opening the page after a long absence must not hand out a fresh 30 minutes.
    checkPresence();
    if (expiredRef.current) return undefined;
    markActivity(true);

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    // Capture phase, so a component that stops the click cannot hide it.
    EXPIRY_EVENTS.forEach((evt) => window.addEventListener(evt, onClick, true));

    const timer = setInterval(checkStorage, SESSION_CHECK_MS);

    // Returning to the tab is not a click, so it never ends the session on its own.
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkStorage();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", checkStorage);

    // Fires in OTHER tabs only. key === null means storage.clear().
    const onStorage = (e) => {
      if (e.key === null || e.key === USER_KEY || e.key === LAST_ACTIVITY_KEY) checkStorage();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(timer);
      detach();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", checkStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [user, logout]);
}
