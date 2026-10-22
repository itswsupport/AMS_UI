"use client";

import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import { MonitorSmartphone, Server, FileText, Upload } from "lucide-react";

/**
 * The user dashboard: three kinds of asset, each a card.
 *
 * Clicking one NAVIGATES to that asset's own page. The sidebar, header and footer come from
 * the root layout, so they stay put and only the area below changes — the difference from
 * opening a section inline is the URL, which can be linked to, bookmarked and backed out of.
 */
export default function UserDashboard() {
  const router = useRouter();

  const cards = [
    {
      key: "laptopdesktop",
      /*
       * "Add Device" rather than "Laptop/Desktop": the screen behind it covers every device
       * type in Device Master — desktop, laptop, printer, tablet — so naming two of them
       * made the rest look as though they belonged somewhere else.
       */
      title: "Add Device",
      icon: <MonitorSmartphone className="w-8 h-8" />,
      variant: "primary",
      onClick: () => router.push("/UserDashboard/LaptopDesktop"),
    },
    {
      key: "server",
      title: "Server",
      icon: <Server className="w-8 h-8" />,
      variant: "primary",
      onClick: () => router.push("/UserDashboard/Server"),
    },
    {
      key: "software",
      title: "Software",
      icon: <FileText className="w-8 h-8" />,
      variant: "primary",
      onClick: () => router.push("/UserDashboard/Software"),
    },
    {
      key: "bulkupload",
      // Excel import for Device, Server and Software, each its own card on that page.
      title: "Bulk Upload",
      icon: <Upload className="w-8 h-8" />,
      variant: "primary",
      onClick: () => router.push("/UserDashboard/BulkUpload"),
    },
  ];

  return (
    <div className="p-3 sm:p-6">
      <PageTitle title="User Dashboard" showBack={false} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <DashboardCard
            key={card.key}
            title={card.title}
            icon={card.icon}
            variant={card.variant}
            onClick={card.onClick}
          />
        ))}
      </div>
    </div>
  );
}
