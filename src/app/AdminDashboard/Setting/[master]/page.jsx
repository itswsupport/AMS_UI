"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/common/PageTitle";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PERMISSIONS } from "@/lib/permissions";
import { findMaster, SIDEBAR_COLOR } from "../_components/masterRegistry";

export default function MasterPage({ params }) {
  // Next 15 passes params as a promise; use() unwraps it in a client component.
  const { master: key } = use(params);
  const router = useRouter();

  const master = findMaster(key);

  if (!master) {
    return (
      <ProtectedRoute permission={PERMISSIONS.MANAGE_MASTERS}>
        <div className="p-3 sm:p-6">
          <PageTitle title="SETTING" />
          <div className="mt-6 rounded-[3px] bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-[#3482AE]">No such master</p>
            <p className="mt-1 text-[12px] text-gray-500">
              &quot;{key}&quot; is not one of the masters on this page.
            </p>
            <button
              type="button"
              onClick={() => router.push("/AdminDashboard/Setting")}
              className="mt-4 rounded-sm bg-[#3482AE] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a6d8f]"
            >
              BACK TO SETTING
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const { title, Panel } = master;

  return (
    <ProtectedRoute permission={PERMISSIONS.MANAGE_MASTERS}>
      <div className="p-3 sm:p-6">
        {/* showBack ON, unlike the Setting page: this one is navigated INTO, so there has to
            be a way back that is not the sidebar. */}
        <PageTitle title={title.toUpperCase()} />

        <div className="mt-6">
          <Panel barColor={SIDEBAR_COLOR} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
