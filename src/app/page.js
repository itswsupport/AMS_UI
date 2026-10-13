"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { exitUrl } from "@/config/auth";
import { getUserRole, dashboardForRole } from "@/lib/permissions";

/** Routes a signed-in user to the dashboard for their role. */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = exitUrl();
      return;
    }
    router.replace(dashboardForRole(getUserRole(user)));
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-12 h-12 border-4 border-[#3482AE] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
