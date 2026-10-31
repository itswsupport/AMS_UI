"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/ui/common/DataTable";
import SearchableSelect from "@/components/ui/common/SearchableSelect";
import { getCompanyList } from "@/services/masterService";

/**
 * Plant Master — the plants in db_all_master.company_mst, via GET /company/list. READ ONLY.
 *
 * company_mst has one row per company AND plant, so every active row is one plant. They are
 * shown company-wise: the company each plant belongs to, then its plant name and plant code,
 * and the Company select narrows the list to one company's plants. Like Company Master it is
 * the shared master every application reads, so it is shown here but not added to, edited or
 * deleted from.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function PlantMasterPanel({ barColor }) {
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  // "" = every company.
  const [company, setCompany] = useState("");

  useEffect(() => {
    getCompanyList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) => {
        const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : [];
        // Company-wise: by company name, then plant name within it.
        const byName = (a, b) => String(a ?? "").trim().localeCompare(String(b ?? "").trim());
        setRows(
          [...list].sort(
            (a, b) => byName(a.company_name, b.company_name) || byName(a.plant_name, b.plant_name)
          )
        );
      })
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  const companies = useMemo(
    () => [...new Set(rows.map((r) => r.company_name?.trim()).filter(Boolean))].sort(),
    [rows]
  );

  const shown = company ? rows.filter((r) => r.company_name?.trim() === company) : rows;

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "company_name", label: "COMPANY NAME" },
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

      <div className="mt-2 w-full sm:w-80">
        <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">Company</label>
        <SearchableSelect value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SearchableSelect>
      </div>

      <div className="mt-2">
        <DataTable data={shown} columns={columns} loading={loadingRows} reportTitle="Plant Master" />
      </div>
    </div>
  );
}
