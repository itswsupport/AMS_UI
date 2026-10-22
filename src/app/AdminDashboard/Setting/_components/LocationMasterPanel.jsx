"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import Select from "react-select";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
import { nativeSelectStyles, nativeSelectComponents } from "@/components/masters/nativeLikeSelect";
import { warnAlert, savedToast } from "@/lib/confirmDelete";
import { getDepartmentList, getLocationList, saveLocation } from "@/services/masterService";

/**
 * Location Master — db_all_master.location_master, via GET /location/list and POST /location/save.
 *
 * location_master is a replica of db_ems_version2.sf_loc_mst's columns (loaded from its CSV
 * export), so a row is a plant code and a name — no status. Its Hindi-name column is kept in
 * the table but not shown or filled in here.
 *
 *   Company / Plant   db_all_master.plant_dept_mst — company_id -> plant_code, the same chain
 *                     as Reporting Person (company and plant names come from plant_mst)
 *   Location Name     typed; unique within its plant
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function LocationMasterPanel({ barColor }) {
  const [showForm, setShowForm] = useState(false);

  const [plantRows, setPlantRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [companyName, setCompanyName] = useState("");
  // Several plants at once: the location is saved once for each.
  const [plantCodes, setPlantCodes] = useState([]);
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  const loadRows = useCallback(() => {
    setLoadingRows(true);
    return getLocationList()
      .then((res) =>
        setRows(
          (unwrap(res) ?? []).map((r) => ({
            ...r,
            // Code and name together, so sorting, filtering and the exports see the same text.
            plant_display: `${r.plant_code}${r.plant_name ? " - " + r.plant_name : ""}`,
          }))
        )
      )
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    getDepartmentList()
      .then((res) => {
        const list = unwrap(res);
        if (!list) return setLoadError("Could not load the company and plant list.");
        setPlantRows(list);
      })
      .catch(() => setLoadError("Could not reach the server."));
  }, []);

  // plant_dept_mst has one row per department, so companies and plants are de-duplicated.
  const companyNames = [...new Set(plantRows.map((r) => r.company_name).filter(Boolean))].sort();
  const companyOptions = companyNames.map((n) => ({ value: n, label: n }));

  const plantsForCompany = [
    ...new Map(
      plantRows
        .filter((r) => r.company_name === companyName && r.plant_code)
        .map((r) => [String(r.plant_code), r])
    ).values(),
  ].sort((a, b) => String(a.plant_code).localeCompare(String(b.plant_code)));

  const plantOptions = plantsForCompany.map((p) => ({
    value: String(p.plant_code),
    label: `${p.plant_code} - ${p.plant_name}`,
  }));

  const clearFields = () => {
    setCompanyName("");
    setPlantCodes([]);
    setLocationName("");
    setError("");
  };

  const openAdd = () => {
    clearFields();
    setShowForm(true);
  };

  const closeForm = () => {
    clearFields();
    setShowForm(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!companyName) return setError("Select a company.");
    if (plantCodes.length === 0) return setError("Select at least one plant.");
    const name = locationName.trim();
    if (!name) return setError("Enter a location name.");

    setSaving(true);
    setError("");
    try {
      /*
       * One row per plant, written one after another. A plant that refuses (usually because
       * it already has this location) does not stop the others; it is reported at the end.
       */
      const saved = [];
      const failed = [];
      for (const code of plantCodes) {
        const res = await saveLocation({
          plant_code: code,
          location_name: name,
        });
        if (res?.status_code === 200) saved.push(code);
        else failed.push(`${code}: ${res?.message || "could not be saved"}`);
      }

      if (saved.length > 0) await loadRows();

      if (failed.length > 0) {
        await warnAlert(
          saved.length > 0 ? `Saved for ${saved.length}, not for ${failed.length}` : "Could not save",
          failed.join("\n")
        );
        // Keep only the plants that did not save, so SAVE can be pressed again for them.
        setPlantCodes((codes) => codes.filter((c) => !saved.includes(c)));
        setError("Some plants were not saved — see the message.");
        return;
      }

      closeForm();
      savedToast(
        saved.length === 1 ? "Location added successfully" : `Location added successfully for ${saved.length} plants`
      );
    } catch {
      await warnAlert("Could not reach the server", "Check the connection and try again.");
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    { key: "company_name", label: "COMPANY" },
    { key: "plant_display", label: "PLANT" },
    { key: "location_name", label: "LOCATION NAME" },
  ];

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
  const fieldCls = "w-full border rounded px-3 py-2 text-sm";

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Location Master
        </h3>

        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 rounded-[3px] bg-white px-3 py-1 text-[12px] font-semibold text-[#3482AE] hover:bg-[#eef4f8]"
        >
          <Plus className="w-4 h-4" />
          ADD
        </button>
      </div>

      <Modal open={showForm} title="Add Location" barColor={barColor} onClose={closeForm}>
        <form onSubmit={onSubmit} className="p-4 sm:p-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Company <span className="text-red-500">*</span></label>
              <Select
                options={companyOptions}
                value={companyOptions.find((o) => o.value === companyName) ?? null}
                onChange={(opt) => {
                  setCompanyName(opt ? opt.value : "");
                  // The plants belonged to the previous company.
                  setPlantCodes([]);
                }}
                placeholder="Search company..."
                menuPlacement="bottom"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                components={nativeSelectComponents}
                styles={nativeSelectStyles}
              />
            </div>

            <div>
              <label className={labelCls}>Plant <span className="text-red-500">*</span></label>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={plantOptions}
                value={plantOptions.filter((o) => plantCodes.includes(o.value))}
                onChange={(opts) => setPlantCodes((opts ?? []).map((o) => o.value))}
                // Full "code - name" in the list; just the code once selected, so many fit.
                formatOptionLabel={(opt, { context }) =>
                  context === "value" ? opt.value : opt.label
                }
                isDisabled={!companyName}
                placeholder="Search plants..."
                menuPlacement="bottom"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                components={nativeSelectComponents}
                styles={nativeSelectStyles}
              />
            </div>

            <div>
              <label className={labelCls}>Location Name <span className="text-red-500">*</span></label>
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Office"
                maxLength={255}
                className={fieldCls}
              />
            </div>

          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f] disabled:opacity-50">
              {saving ? "SAVING..." : "SAVE"}
            </button>
            <button type="button" onClick={closeForm}
              className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50">
              CANCEL
            </button>
          </div>
        </form>
      </Modal>

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loadingRows} reportTitle="Location Master" />
      </div>
    </div>
  );
}
