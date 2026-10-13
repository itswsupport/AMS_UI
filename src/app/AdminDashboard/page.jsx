"use client";

import PageTitle from "@/components/ui/common/PageTitle";

/**
 * Admin landing page.
 *
 * No cards. SETTING is reached from the sidebar only — having it in both places meant two
 * lists to keep in step as masters are added. The masters themselves live on the Setting
 * page, so this stays the plain landing spot HOME points at.
 */
export default function AdminDashboard() {
  return (
    <div className="p-6">
      <PageTitle title="ADMIN DASHBOARD" showBack={false} />
    </div>
  );
}
