"use client";

import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import { BookOpen, Building2, ArrowLeftRight, Wrench } from "lucide-react";

export default function ReportsHub() {
  const router = useRouter();

  const cards = [
    { title: "Asset Register", icon: <BookOpen className="w-8 h-8" />, variant: "default", onClick: () => router.push("/Reports/AssetRegister") },
    { title: "Department Wise", icon: <Building2 className="w-8 h-8" />, variant: "blue", onClick: () => router.push("/Reports/DepartmentWise") },
    { title: "Allocation Report", icon: <ArrowLeftRight className="w-8 h-8" />, variant: "teal", onClick: () => router.push("/Reports/AllocationReport") },
    { title: "Maintenance Report", icon: <Wrench className="w-8 h-8" />, variant: "warning", onClick: () => router.push("/Reports/MaintenanceReport") },
  ];

  return (
    <div className="p-6">
      <PageTitle title="REPORTS" showBack={false} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <DashboardCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}
