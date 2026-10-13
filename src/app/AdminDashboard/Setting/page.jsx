"use client";

import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { MASTERS } from "./_components/masterRegistry";

/**
 * SETTING — the way in to every master.
 *
 * The cards NAVIGATE; they no longer open a panel underneath themselves. With sixteen
 * masters the old behaviour meant the screen you wanted opened below four rows of cards, so
 * every visit began by scrolling past them, and nothing about which master was open survived
 * a refresh or could be linked to.
 *
 * Each card now goes to /AdminDashboard/Setting/<key>, which is a real address: it can be
 * bookmarked, opened in a new tab, and backed out of with the browser's own back button.
 *
 * The list itself lives in _components/masterRegistry.jsx, because the route at [master]
 * reads the same one to decide what to render.
 */
export default function Setting() {
  const router = useRouter();

  return (
    <ProtectedRoute permission={PERMISSIONS.MANAGE_MASTERS}>
      <div className="p-6">
        {/* showBack off: this IS the top of the section, there is nothing above it. */}
        <PageTitle title="SETTING" showBack={false} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MASTERS.map((master) => (
            <DashboardCard
              key={master.key}
              title={master.title}
              icon={master.icon}
              variant="primary"
              onClick={() => router.push(`/AdminDashboard/Setting/${master.key}`)}
            />
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
