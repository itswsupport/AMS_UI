"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, Server, FileText, ChevronLeft } from "lucide-react";
import BulkUploadPanel from "./_BulkUploadPanel";
import DashboardCard from "@/components/ui/common/DashboardCard";

/**
 * BULK UPLOAD — Excel import for the three registers: DEVICE, SERVER, SOFTWARE.
 *
 * Laid out as the Payroll project's Bulk Upload: BACK on the right (to the User Dashboard), three
 * tab cards (all the same blue), then the chosen register's upload card and its table below.
 * Opens on Device.
 */
const TABS = [
  { key: "device", label: "Device", Icon: MonitorSmartphone },
  { key: "server", label: "Server", Icon: Server },
  { key: "software", label: "Software", Icon: FileText },
];

export default function BulkUploadPage() {
  // Device Bulk Upload is open when the page loads.
  const [activeTab, setActiveTab] = useState("device");
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-6">
      {/* BACK, on the right — always to the main User Dashboard. */}
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/UserDashboard")}
          className="flex items-center rounded-sm bg-[#3482AE] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a6d8f]"
        >
          <ChevronLeft className="mr-1 h-5 w-5" />
          BACK
        </button>
      </div>

      {/*
        * Tab cards — the SAME cards as the User Dashboard (DashboardCard, same icons at the same
        * size, same height), all three the same blue.
        */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        {TABS.map(({ key, label, Icon }) => (
          <DashboardCard
            key={key}
            title={label}
            icon={<Icon className="w-8 h-8" />}
            variant="primary"
            onClick={() => setActiveTab(key)}
          />
        ))}
      </div>

      {/* A fresh panel per tab, so switching never carries one register's file into another. */}
      <BulkUploadPanel key={activeTab} type={activeTab} />
    </div>
  );
}
