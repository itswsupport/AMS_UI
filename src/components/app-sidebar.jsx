"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader } from "@/components/ui/sidebar";
import { getUserRole, getUserRoles, ROLES } from "@/lib/permissions";
import { User, LogOut, LayoutDashboard, FileText, Eye, Settings, Home } from "lucide-react";

/** Nav entries per role. The sidebar renders exactly one of these lists. */
const NAV = {
  /*
   * The asset, allocation, maintenance, Reports and Settings screens were removed from this
   * menu earlier; the two masters are what admin manages here now. LOGOUT is not listed —
   * it is appended to every role's menu further down.
   *
   * The key must stay even if this list ever shrinks to one: NAV[role] falling through to
   * NAV[ROLES.USER] would silently hand an admin the employee menu rather than the short one
   * intended.
   */
  [ROLES.ADMIN]: [
    { label: "HOME", path: "/AdminDashboard", icon: LayoutDashboard },
    // SETTING is the entry point to the masters — the Category and Sub Category cards live
    // on that page rather than as two more entries here, so the menu stays short as more
    // masters are added.
    { label: "SETTING", path: "/AdminDashboard/Setting", icon: Settings },
  ],
  [ROLES.VIEWER]: [
    { label: "DASHBOARD", path: "/ViewerDashboard", icon: LayoutDashboard },
    { label: "ASSET OVERVIEW", path: "/ViewerDashboard/AssetOverview", icon: Eye },
    { label: "REPORTS", path: "/Reports", icon: FileText },
  ],
  /*
   * HOME then USER DASHBOARD, and LOGOUT is appended to every role's menu further down.
   *
   * Two separate pages, not one linked twice: HOME is the landing page and is empty for now,
   * while USER DASHBOARD carries the asset cards — Laptop/Desktop, Server, Software,
   * Printer. Pointing both at the same route would make one of them look broken.
   *
   * The asset screens themselves are reached from those cards rather than listed here, the
   * same as SETTING holds the masters for admin, so the menu stays short as more are added.
   *
   * MY ASSETS, REQUEST ASSET and MY REQUESTS were removed earlier — all three were
   * placeholders with a TODO and nothing on them, so they were menu items that led nowhere.
   * Their routes still exist under app/UserDashboard/ and can be linked again once built.
   */
  [ROLES.USER]: [
    { label: "HOME", path: "/UserDashboard/Home", icon: Home },
    { label: "USER DASHBOARD", path: "/UserDashboard", icon: LayoutDashboard },
  ],
};

export function AppSidebar() {
  const { user, logout } = useContext(AuthContext);
  const router = useRouter();

  const role = getUserRole(user);
  const roles = getUserRoles(user);
  /*
   * ONE MENU FOR EVERY ROLE HELD — Admin + User sees HOME, SETTING and USER DASHBOARD together.
   * The main role's menu comes first; another role adds only the entries not already there by
   * name (so one HOME, not two).
   */
  const items = (roles.length > 1 ? [role, ...roles.filter((r) => r !== role)] : [role])
    .flatMap((r) => NAV[r] || [])
    .filter((item, i, all) => all.findIndex((x) => x.label === item.label) === i);
  if (!items.length) items.push(...NAV[ROLES.USER]);
  // Admin + User in this order: HOME, USER DASHBOARD, SETTING (LOGOUT is added after).
  if (roles.length > 1) {
    const ORDER = ["HOME", "USER DASHBOARD", "SETTING"];
    const at = (label) => (ORDER.includes(label) ? ORDER.indexOf(label) : ORDER.length);
    items.sort((a, b) => at(a.label) - at(b.label));
  }
  // Under the name: the main role only — "[ADMIN]" for someone who is Admin + User.
  const roleTag = role;

  /*
   * First + last name, e.g. "GANESH BARATHE" rather than just "GANESH".
   *
   * filter(Boolean) matters: emp_lname is null for some rows in the employee master, and a
   * plain join would leave a trailing space. The master's own display_name column is not
   * used as the primary source because it is empty for most rows — it is only a fallback.
   *
   * The middle name is deliberately left out; emp_mname is often a full patronymic
   * ("SUBHASH") and three names wrap onto two lines in a 16rem sidebar.
   */
  const fullName = [user?.userFname, user?.userLname].filter(Boolean).join(" ");

  const displayName =
    fullName || user?.displayName || user?.name || user?.username || user?.user_id || "Guest";

  // The divider between the menu and the page is removed in globals.css, not here — the
  // shadcn rule that draws it (group-data-[side=left]:border-r) has a more specific selector
  // than any utility class put on this element, so border-r-0 here has no effect.
  return (
    <Sidebar className="w-64 bg-[#3482AE] text-white flex flex-col h-screen">
      <SidebarHeader className="p-4 border-b border-white/30">
        <div className="flex items-center space-x-3">
          {/* The file is 140x100, so height + width:auto keeps the real aspect — a
              square box would letterbox it and squash the RUCHA wordmark. AMS has no
              basePath, so the bare path resolves. */}
          <img
            src="/RUCHA-LOGO-WHITE.png"
            alt="Rucha Logo"
            style={{ opacity: 0.9, height: 40, width: "auto" }}
          />
          {/* text-white for the same reason as the name below — no inherited colour here
              is safe once the Sidebar's own foreground token applies. */}
          <span className="font-bold text-base tracking-wide whitespace-nowrap text-white">REPL</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0 border-b border-white/60">
        <div className="px-4 py-3 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center bg-[#f5f5f5]">
            <User className="w-5 h-5 text-[#3482AE]" />
          </div>
          <div>
            {/* text-white explicitly. The shadcn Sidebar's inner container sets
                text-sidebar-foreground, which is near-black, and that beats the text-white
                on the outer Sidebar — so anything here without its own colour renders black
                against the blue. This line was doing exactly that. */}
            <div className="font-semibold leading-tight text-sm text-white">{displayName}</div>
            <div className="text-xs text-white/70 uppercase tracking-wider">[{roleTag}]</div>
          </div>
        </div>

        <hr className="border-t border-white/60 my-2" />

        <nav className="px-2 py-2 text-white">
          <SidebarGroup>
            <ul className="space-y-0">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    {/* No selected-state background. Only the hover tint remains, so the
                        menu keeps one flat colour while you move between pages. */}
                    <button
                      onClick={() => router.push(item.path)}
                      className="flex items-center gap-3 px-4 py-2.5 font-semibold text-sm w-full text-left text-white"
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-4 py-2.5 font-semibold text-sm w-full text-left text-white"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>LOGOUT</span>
                </button>
              </li>
            </ul>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
