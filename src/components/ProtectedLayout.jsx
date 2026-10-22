"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import ScrollFooter from "@/components/ScrollFooter";
import { redirectUnauthenticated } from "@/config/auth";
import { HelpCircle, LogOut } from "lucide-react";
import { useIdleLogout } from "@/hooks/useIdleLogout";

// Pages that render without a session.
const PUBLIC_ROUTES = ["/Login", "/access-denied"];

export default function ProtectedLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname === r + "/" || pathname.startsWith(r + "/")
  );
  const isRoot = pathname === "/" || pathname === "";

  // A login is valid for 30 MINUTES OF INACTIVITY — then "Session Timed Out" and the login page.
  useIdleLogout();

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic && !isRoot) redirectUnauthenticated(router);
  }, [user, loading, isPublic, isRoot, router]);

  /*
   * Public and root pages render bare - no chrome, no redirect. The LOGIN page is ALWAYS bare,
   * even while someone is still signed in: it never shows the previous user's sidebar and
   * name around the form of the person now signing in.
   */
  if (loading || isPublic || (!user && isRoot)) {
    return <div className="w-full h-full">{children}</div>;
  }

  if (!user) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header
          className="bg-[#3482AE] text-white px-3 py-2 flex justify-between items-center z-10"
          style={{ minHeight: 44 }}
        >
          {/* text-white + hover:text-white: the ghost Button variant sets
              hover:text-accent-foreground, which is near-black and turned the icon
              black against this blue header on hover/click. */}
          <SidebarTrigger className="p-0 bg-transparent hover:bg-transparent border-none shadow-none text-white hover:text-white" />
          <div className="flex items-center space-x-4">
            {/*
              * HELP — the user guide (public/user_manual/help.html) is NOT opened yet; it is kept
              * hidden until it is ready. To show it, make this an <a> to
              * `${BASE_PATH}/user_manual/help.html` with target="_blank".
              */}
            <button type="button" className="flex items-center space-x-2 px-3 py-1.5 rounded transition-colors">
              <HelpCircle className="w-5 h-5" />
              <span>HELP</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center space-x-2 px-3 py-1.5 rounded transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>LOGOUT</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#f4f6f9]" id="main-content">
          {children}
        </main>
        <ScrollFooter />
      </div>
    </div>
  );
}
