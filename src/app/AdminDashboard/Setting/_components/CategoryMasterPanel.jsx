"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getDepartmentList } from "@/services/masterService";

/**
 * Department master, rendered inline under the Setting cards.
 *
 * READ-ONLY. The rows come straight from db_all_master.plant_dept_mst, a shared master that
 * is maintained outside AMS — so there is no ADD, no edit and no delete here, only the list.
 * Department names only, each listed once.
 */
export default function CategoryMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartmentList()
      // BaseResponseBO always answers HTTP 200; status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        // plant_dept_mst repeats a department for every plant, so each name is listed once.
        const names = [...new Set(list.map((r) => r.department?.trim()).filter(Boolean))].sort();
        setRows(names.map((department) => ({ department })));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "department", label: "DEPARTMENT" },
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Department Master
        </h3>
      </div>

      <div className="mt-2">
        <DataTable
          data={rows}
          columns={columns}
          loading={loading}
          reportTitle="Department Master"
        />
      </div>
    </div>
  );
}
