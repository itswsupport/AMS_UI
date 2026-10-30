"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getLocationList } from "@/services/masterService";

/**
 * Location Master — db_all_master.location_master, via GET /location/list. READ ONLY.
 *
 * location_master is a replica of db_ems_version2.sf_loc_mst's columns, a shared master, so
 * there is no ADD, no edit and no delete here, only the list. Location names only, each listed
 * once — the table repeats a location for every plant that has it.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function LocationMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    getLocationList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        const names = [...new Set(list.map((r) => r.location_name?.trim()).filter(Boolean))].sort();
        setRows(names.map((location_name) => ({ location_name })));
      })
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "location_name", label: "LOCATION NAME" },
  ];

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Location Master
        </h3>
      </div>

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loadingRows} reportTitle="Location Master" />
      </div>
    </div>
  );
}
