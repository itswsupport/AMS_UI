"use client";

import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import { Eye, FileText } from "lucide-react";

export default function ViewerDashboard() {
  const router = useRouter();

  const cards = [
    { title: "Asset Overview", icon: <Eye className="w-8 h-8" />, variant: "default", onClick: () => router.push("/ViewerDashboard/AssetOverview") },
    { title: "Reports", icon: <FileText className="w-8 h-8" />, variant: "purple", onClick: () => router.push("/Reports") },
  ];

  return (
    <div className="p-6">
      <PageTitle title="VIEWER DASHBOARD" showBack={false} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <DashboardCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}
