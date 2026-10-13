"use client";

import PageTitle from "@/components/ui/common/PageTitle";

/**
 * HOME — the first entry in the user's sidebar.
 *
 * DELIBERATELY EMPTY. The asset cards live on USER DASHBOARD, the entry below it; this is
 * the landing page and has nothing on it yet.
 *
 * It exists as its own route rather than pointing HOME at the dashboard, because two menu
 * entries leading to the same page look like one of them is broken. Whatever belongs on a
 * home page — a summary, recent activity, whatever is decided — goes here.
 */
export default function UserHome() {
  return (
    <div className="p-6">
      {/* showBack off: this is the top of the section, there is nothing above it. */}
      <PageTitle title="HOME" showBack={false} />
    </div>
  );
}
