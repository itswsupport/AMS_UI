"use client";

import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-3">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You do not have permission to view this page.
        </p>
        <button
          onClick={() => router.back()}
          className="bg-[#3482AE] text-white px-6 py-2 rounded text-sm font-semibold"
        >
          GO BACK
        </button>
      </div>
    </div>
  );
}
