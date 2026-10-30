"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getCompanyList } from "@/services/masterService";

/**
 * Company Master — db_all_master.company_mst, via GET /company/list. READ ONLY.
 *
 * company_mst is the shared company/plant master that every application reads, so it is
 * shown here but not added to, edited or deleted from. Company names only, each listed once
 * (active rows). Bank details in that table are never sent by the backend.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function CompanyMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    getCompanyList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        // company_mst has one row per plant, so each company is listed once.
        const names = [...new Set(list.map((r) => r.company_name?.trim()).filter(Boolean))].sort();
        setRows(names.map((company_name) => ({ company_name })));
      })
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "company_name", label: "COMPANY NAME" },
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Company Master
        </h3>
      </div>

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loadingRows} reportTitle="Company Master" />
      </div>
    </div>
  );
}
