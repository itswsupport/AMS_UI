"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getServerAssetList } from "@/services/serverAssetService";
import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";

/**
 * LIST SERVER — every server on record.
 *
 * No device-type dropdown, unlike LIST DEVICE: servers are one table, so there is nothing to
 * choose between before the list means anything.
 *
 * The name opens the row to READ (View Server); EDIT there opens it to change, and UPDATE saves
 * (with the "Do you want to update" check and the USER LOG). No ACTION column — looking first,
 * changing on purpose.
 *
 * AGE is not stored anywhere; the backend works it out from the warranty date and term on
 * every read.
 */
export default function ListServer({ barColor, onView }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  const loadRows = useCallback(() => {
    setLoading(true);
    return getServerAssetList()
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

  // Most sheet cells are blank, so a dash reads better than an empty box.
  const cell = (value) => <span>{value || "-"}</span>;

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    {
      key: "server_name",
      label: "NAME",
      width: 150,
      render: (row) => (
        <button
          type="button"
          onClick={() => onView(row)}
          title="View this server"
          className="text-left font-semibold text-[#3482AE] hover:underline"
        >
          {row.server_name}
        </button>
      ),
    },
    { key: "ip_address", label: "IP ADDRESS", width: 140, render: (r) => cell(r.ip_address) },
    { key: "plant", label: "PLANT", width: 100, render: (r) => cell(r.plant) },
    { key: "department", label: "DEPT.", width: 130, render: (r) => cell(r.department) },
    { key: "location", label: "LOCATION", width: 140, render: (r) => cell(r.location) },
    { key: "server_type", label: "TYPE", width: 150, render: (r) => cell(r.server_type) },
    /*
     * From here to OTHER SOFTWARE 2: exportOnly. The screen shows NAME to TYPE, then STATUS;
     * Excel, PDF and Print still carry every field below. The full record is one click
     * away on the server's name.
     */
    { key: "serial_no", exportOnly: true, label: "S/N", width: 140, render: (r) => cell(r.serial_no) },
    { key: "processor", exportOnly: true, label: "PROCESSOR GHZ", width: 180, render: (r) => cell(r.processor) },
    { key: "ram", exportOnly: true, label: "RAM", width: 110, render: (r) => cell(r.ram) },
    { key: "hdd", exportOnly: true, label: "HDD (GB)", width: 160, render: (r) => cell(r.hdd) },
    {
      key: "warranty_status", exportOnly: true,
      label: "WARRANTY STATUS",
      width: 150,
      render: (r) => cell(r.warranty_status),
    },
    {
      key: "last_date_of_warranty", exportOnly: true,
      label: "LAST DATE OF WARRANTY",
      width: 180,
      render: (r) => cell(fmtDate(r.last_date_of_warranty)),
    },
    {
      key: "total_warranty_years", exportOnly: true,
      label: "TOTAL WARRANTY (IN YEARS)",
      width: 190,
      render: (r) => cell(r.total_warranty_years),
    },
    { key: "age", exportOnly: true, label: "AGE (YEAR.MONTH)", width: 150, render: (r) => cell(r.age) },
    { key: "os_name", exportOnly: true, label: "OS", width: 170, render: (r) => cell(r.os_name) },
    {
      key: "os_service_pack", exportOnly: true,
      label: "OS SERVICE PACK",
      width: 150,
      render: (r) => cell(r.os_service_pack),
    },
    { key: "system_type", exportOnly: true, label: "SYSTEM TYPE", width: 130, render: (r) => cell(r.system_type) },
    {
      key: "other_software_1", exportOnly: true,
      label: "OTHER SOFTWARE 1",
      width: 170,
      render: (r) => cell(r.other_software_1),
    },
    {
      key: "other_software_2", exportOnly: true,
      label: "OTHER SOFTWARE 2",
      width: 170,
      render: (r) => cell(r.other_software_2),
    },
    // No STATUS (Active / Inactive) column — it is not on the form any more.
    // No ACTION column: the server's name opens it to VIEW, and EDIT there changes it.
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          List Server
        </h3>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loading} reportTitle="Server list" exportsInToolbar />
      </div>
    </div>
  );
}
