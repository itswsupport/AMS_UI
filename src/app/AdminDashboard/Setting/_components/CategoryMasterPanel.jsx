"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getDepartmentList } from "@/services/masterService";

/**
 * Department master, rendered inline under the Setting cards.
 *
 * READ-ONLY. The rows come straight from db_all_master.plant_dept_mst, a shared master that
 * is maintained outside AMS — so there is no ADD, no edit and no delete here, only the list.
 */
export default function CategoryMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartmentList()
      // BaseResponseBO always answers HTTP 200; status_code in the body is the real outcome.
      .then((res) =>
        setRows(res?.status_code === 200 && Array.isArray(res.response) ? res.response : [])
      )
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    // Company -> plant -> department, the way plant_dept_mst is organised.
    {
      key: "company_name",
      label: "COMPANY",
      render: (row) => <span>{row.company_name || "-"}</span>,
    },
    {
      key: "plant_code",
      label: "PLANT CODE",
      render: (row) => <span>{row.plant_code || "-"}</span>,
    },
    { key: "plant_name", label: "PLANT NAME" },
    { key: "department", label: "DEPARTMENT" },
    {
      key: "dept_short_name",
      label: "DEPT SHORT NAME",
      render: (row) => <span>{row.dept_short_name || "-"}</span>,
    },
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
