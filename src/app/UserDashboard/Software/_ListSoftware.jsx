"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getSoftwareList } from "@/services/softwareService";
import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";

/**
 * LIST SOFTWARE — every product's licence position.
 *
 * The product name opens the row to READ (View Software); EDIT there opens it to change, and
 * UPDATE saves. No ACTION column — looking first, changing on purpose.
 *
 * License Excess or Deficiency is coloured: a shortfall is the number worth acting on, and a
 * bare "-5" among black figures is easy to scroll past.
 */
export default function ListSoftware({ barColor, onView }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  const loadRows = useCallback(() => {
    setLoading(true);
    return getSoftwareList()
      .then((res) => {
        const list = unwrap(res);
        if (!list) {
          setError(res?.message || "Could not load the list.");
          setRows([]);
          return;
        }
        setError("");
        setRows(list);
      })
      .catch(() => {
        setError("Could not reach the server.");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // A dash reads better than an empty cell, and 0 is a real value so it must survive.
  const cell = (value) => <span>{value === null || value === undefined || value === "" ? "-" : value}</span>;

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    {
      key: "product_name",
      label: "PRODUCT NAME",
      width: 220,
      render: (row) => (
        <button
          type="button"
          onClick={() => onView(row)}
          title="View this software"
          className="text-left font-semibold text-[#3482AE] hover:underline"
        >
          {row.product_name}
        </button>
      ),
    },
    {
      key: "total_licenses_acquired",
      label: "TOTAL LICENSES ACQUIRED",
      width: 190,
      render: (r) => cell(r.total_licenses_acquired),
    },
    {
      key: "license_excess_deficiency",
      label: "LICENSE EXCESS OR DEFICIENCY",
      width: 220,
      render: (r) => {
        const v = r.license_excess_deficiency;
        if (v === null || v === undefined || v === "") return <span>-</span>;
        // Red for a shortfall — the rows that need attention should not read like the rest.
        return (
          <span className={v < 0 ? "font-semibold text-[#e74c3c]" : ""}>
            {v > 0 ? `+${v}` : v}
          </span>
        );
      },
    },
    { key: "license_type", label: "LICENSE TYPE", width: 150, render: (r) => cell(r.license_type) },
    { key: "renewal_date", label: "RENEWAL DATE", width: 150, render: (r) => cell(fmtDate(r.renewal_date)) },
    {
      key: "status",
      label: "STATUS",
      width: 110,
      render: (r) => <span>{r.status === 1 ? "Active" : "Inactive"}</span>,
    },
    // No ACTION column: the product name opens the software to VIEW, and EDIT there changes it.
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          List Software
        </h3>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loading} reportTitle="Software list" exportsInToolbar />
      </div>
    </div>
  );
}
