"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/ui/common/DataTable";
import CheckMultiSelect from "@/components/masters/CheckMultiSelect";
import { getDepartmentList } from "@/services/masterService";

/**
 * Department master, rendered inline under the Setting cards.
 *
 * READ-ONLY. The rows come straight from db_all_master.plant_dept_mst, a shared master that
 * is maintained outside AMS — so there is no ADD, no edit and no delete here, only the list.
 *
 * Company -> plant -> department: tick one or more companies, and the Plant list offers their
 * plants (by plant code); the ticks together narrow the departments shown. Nothing ticked
 * means all of them.
 */
export default function CategoryMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  // Ticked company names and plant codes; empty = every one.
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);

  useEffect(() => {
    getDepartmentList()
      // BaseResponseBO always answers HTTP 200; status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        const t = (v) => String(v ?? "").trim();
        // One row per company + plant + department, in that order.
        const seen = new Set();
        const out = [];
        for (const r of list) {
          const row = {
            company_name: t(r.company_name),
            plant_code: t(r.plant_code),
            plant_name: t(r.plant_name),
            department: t(r.department),
          };
          const key = `${row.company_name}|${row.plant_code}|${row.department}`;
          if (!row.department || seen.has(key)) continue;
          seen.add(key);
          out.push(row);
        }
        out.sort(
          (a, b) =>
            a.company_name.localeCompare(b.company_name) ||
            a.plant_code.localeCompare(b.plant_code) ||
            a.department.localeCompare(b.department)
        );
        setRows(out);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const companyOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.company_name).filter(Boolean))]
        .sort()
        .map((c) => ({ value: c, label: c })),
    [rows]
  );

  // The plants of the ticked companies (or of every company), each once, by plant code.
  const plantOptions = useMemo(() => {
    const byCode = new Map();
    rows
      .filter((r) => r.plant_code && (!companies.length || companies.includes(r.company_name)))
      .forEach((r) => byCode.has(r.plant_code) || byCode.set(r.plant_code, r.plant_name));
    return [...byCode]
      .sort(([a], [b]) => a.localeCompare(b))
      // The code is shown; typing part of the plant's name still finds it.
      .map(([code, name]) => ({ value: code, label: code, search: `${code} ${name}`.toLowerCase() }));
  }, [rows, companies]);

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
    { key: "department", label: "DEPARTMENT" },
  ];

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";

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
                  rows.some((r) => r.plant_code === code && (!next.length || next.includes(r.company_name)))
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
          loading={loading}
          reportTitle="Department Master"
          // Excel / PDF / Print inside the table's card, on its toolbar above SR. NO.
          exportsInToolbar
        />
      </div>
    </div>
  );
}
