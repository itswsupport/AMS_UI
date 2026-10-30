"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getCompanyList } from "@/services/masterService";

/**
 * Plant Master — the plants in db_all_master.company_mst, via GET /company/list. READ ONLY.
 *
 * company_mst has one row per company AND plant, so every active row is one plant — shown as
 * its plant name and plant code only. Like Company Master it is the shared master every application
 * reads, so it is shown here but not added to, edited or deleted from.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function PlantMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    getCompanyList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) =>
        setRows(res?.status_code === 200 && Array.isArray(res.response) ? res.response : [])
      )
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "plant_name", label: "PLANT NAME" },
    { key: "plant_code", label: "PLANT CODE" },
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Plant Master
        </h3>
      </div>

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loadingRows} reportTitle="Plant Master" />
      </div>
    </div>
  );
}
