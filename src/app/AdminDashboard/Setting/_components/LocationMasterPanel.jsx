"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/ui/common/DataTable";
import CheckMultiSelect from "@/components/masters/CheckMultiSelect";
import { getDepartmentList, getLocationList } from "@/services/masterService";

/**
 * Location Master — db_all_master.location_master, via GET /location/list. READ ONLY.
 *
 * location_master is a replica of db_ems_version2.sf_loc_mst's columns, a shared master, so
 * there is no ADD, no edit and no delete here, only the list.
 *
 * Company -> plant -> location. A location belongs to a plant (location_master.plant_id); the
 * company and plant names come with it from plant_mst. Departments are a separate tree under
 * the plant (Department Master) — no table puts a location under a department.
 *
 * The Company and Plant choices list EVERY company and plant (from plant_dept_mst as well as
 * the locations), so each can be picked even when location_master has no locations for it
 * yet — today only Rucha Engineers' plants have any. Tick one or more; nothing ticked = all.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function LocationMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  // { company_name, plant_code } from plant_dept_mst — every company and plant.
  const [plantRows, setPlantRows] = useState([]);
  // Ticked company names and plant codes; empty = every one.
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);

  const t = (v) => String(v ?? "").trim();

  useEffect(() => {
    getDepartmentList()
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        setPlantRows(list.map((r) => ({ company_name: t(r.company_name), plant_code: t(r.plant_code) })));
      })
      .catch(() => setPlantRows([]));
  }, []);

  useEffect(() => {
    getLocationList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        // One row per company + plant + location, in that order.
        const seen = new Set();
        const out = [];
        for (const r of list) {
          const row = {
            company_name: t(r.company_name),
            plant_code: t(r.plant_code),
            location_name: t(r.location_name),
          };
          const key = `${row.company_name}|${row.plant_code}|${row.location_name}`;
          if (!row.location_name || seen.has(key)) continue;
          seen.add(key);
          out.push(row);
        }
        out.sort(
          (a, b) =>
            a.company_name.localeCompare(b.company_name) ||
            a.plant_code.localeCompare(b.plant_code) ||
            a.location_name.localeCompare(b.location_name)
        );
        setRows(out);
      })
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  // Every company and plant: the plant list and the locations together.
  const allPlants = useMemo(() => [...plantRows, ...rows], [plantRows, rows]);

  const companyOptions = useMemo(
    () =>
      [...new Set(allPlants.map((r) => r.company_name).filter(Boolean))]
        .sort()
        .map((c) => ({ value: c, label: c })),
    [allPlants]
  );

  // The plants of the ticked companies (or of every company), each once, by plant code.
  const plantOptions = useMemo(
    () =>
      [
        ...new Set(
          allPlants
            .filter((r) => r.plant_code && (!companies.length || companies.includes(r.company_name)))
            .map((r) => r.plant_code)
        ),
      ]
        .sort()
        .map((code) => ({ value: code, label: code })),
    [allPlants, companies]
  );

  const shown = rows.filter(
    (r) =>
      (!companies.length || companies.includes(r.company_name)) &&
      (!plants.length || plants.includes(r.plant_code))
  );

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "company_name", label: "COMPANY NAME" },
    { key: "plant_code", label: "PLANT CODE" },
    { key: "location_name", label: "LOCATION NAME" },
  ];

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";

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

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[40rem]">
        <div>
          <label className={labelCls}>Company</label>
          <CheckMultiSelect
            options={companyOptions}
            values={companies}
            onChange={(next) => {
              setCompanies(next);
              // Keep only the ticked plants that still belong to a ticked company.
              setPlants((prev) =>
                prev.filter((code) =>
                  allPlants.some((r) => r.plant_code === code && (!next.length || next.includes(r.company_name)))
                )
              );
            }}
            noun="companies"
            placeholder="All Companies"
          />
        </div>

        <div>
          <label className={labelCls}>Plant</label>
          <CheckMultiSelect
            options={plantOptions}
            values={plants}
            onChange={setPlants}
            noun="plants"
            placeholder="All Plants"
          />
        </div>
      </div>

      <div className="mt-2">
        <DataTable
          data={shown}
          columns={columns}
          loading={loadingRows}
          reportTitle="Location Master"
          // Excel / PDF / Print inside the table's card, on its toolbar above SR. NO.
          exportsInToolbar
        />
      </div>
    </div>
  );
}
