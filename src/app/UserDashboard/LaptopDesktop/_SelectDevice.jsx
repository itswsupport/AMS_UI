"use client";

import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import { nativeSelectStyles, nativeSelectComponents } from "@/components/masters/nativeLikeSelect";
import { warnAlert, savedToast } from "@/lib/confirmDelete";
import { getDeviceList, updateDevice } from "@/services/deviceService";
// The statuses come from their own master, not a list written into this file.
import { getWarrantyList } from "@/services/warrantyService";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * LIST DEVICE — the user side of Laptop / Desktop.
 *
 * SELECT DEVICE comes first and drives everything else. It lists the devices the admin added
 * in Device Master, ACTIVE ONLY: /device/list returns inactive rows too, because the admin
 * screen needs them visible to switch back on, so the filter happens here. A device switched
 * off is deliberately out of circulation and must not be offered; deleted ones never arrive.
 *
 * Pick one and the rest of the form fills in with what that device already has recorded —
 * system type, warranty status, end date, term — and saving writes them back to that row.
 * The fields are disabled until a device is chosen, because each one belongs to a device.
 */

export default function SelectDevice({ barColor }) {
  const [devices, setDevices] = useState([]);
  const [warrantyStatuses, setWarrantyStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [deviceId, setDeviceId] = useState("");
  const [systemType, setSystemType] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [totalYears, setTotalYears] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  const loadDevices = useCallback(
    () =>
      getDeviceList()
        .then((res) => {
          const list = unwrap(res);
          if (!list) {
            setLoadError("Could not load the device list.");
            return;
          }
          setLoadError("");
          setDevices(list.filter((d) => d.status === 1));
        })
        .catch(() => setLoadError("Could not reach the server."))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  /*
   * The warranty statuses, read from ams_warranty_master rather than written into this file.
   *
   * ACTIVE ONLY, the same rule as the devices above: /warranty/list returns inactive rows too
   * because the admin screen needs them visible to switch back on, so the filter is here. Add
   * a status in Warranty Master and it appears in this dropdown; switch it off and it goes.
   */
  useEffect(() => {
    getWarrantyList()
      .then((res) => {
        const list = unwrap(res);
        if (!list) {
          setLoadError("Could not load the warranty status list.");
          return;
        }
        setWarrantyStatuses(list.filter((w) => w.status === 1).map((w) => w.name));
      })
      .catch(() => setLoadError("Could not reach the server."));
  }, []);

  const options = devices.map((d) => ({ value: String(d.id), label: d.device_name }));
  const selected = devices.find((d) => String(d.id) === String(deviceId)) ?? null;

  /*
   * Fill the rest in as the device is picked, rather than from an effect watching deviceId.
   * An effect would also fire when the list reloads after a save, quietly discarding
   * anything typed since.
   */
  const onPick = (opt) => {
    setDeviceId(opt ? opt.value : "");
    setError("");

    const device = opt ? devices.find((d) => String(d.id) === String(opt.value)) : null;
    setSystemType(device?.system_type ?? "");
    setWarrantyStatus(device?.warranty_status ?? "");
    setLastDate(device?.last_date_of_warranty ?? "");
    setTotalYears(
      device?.total_warranty_years != null ? String(device.total_warranty_years) : ""
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!deviceId) return setError("Select a device.");
    if (totalYears !== "" && Number(totalYears) < 0) {
      return setError("Total warranty cannot be negative.");
    }

    setSaving(true);
    setError("");
    try {
      const res = await updateDevice({
        id: Number(deviceId),
        /*
         * The name is not editable here — it is the admin's, and changing it would rename
         * the device for everyone. Sent unchanged because update requires it.
         *
         * Empty strings rather than null for the rest: the backend leaves a field alone when
         * null arrives, so null would mean "not on this form" and a cleared box would never
         * save as cleared.
         */
        device_name: selected.device_name,
        system_type: systemType.trim(),
        warranty_status: warrantyStatus,
        last_date_of_warranty: lastDate || null,
        total_warranty_years: totalYears === "" ? null : Number(totalYears),
      });

      if (res?.status_code !== 200) {
        await warnAlert("Could not save", res?.message || "The device could not be saved.");
        setError(res?.message || "Could not save.");
        return;
      }
      await loadDevices();
      savedToast("Device saved");
    } catch {
      await warnAlert("Could not reach the server", "Check the connection and try again.");
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
  const fieldCls = "w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100";

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          List Device
        </h3>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-b-[3px] shadow-sm p-4 sm:p-6">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>
              Select Device <span className="text-red-500">*</span>
            </label>
            <Select
              options={options}
              value={options.find((o) => o.value === deviceId) ?? null}
              onChange={onPick}
              isLoading={loading}
              placeholder="Search Device..."
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={nativeSelectStyles}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              {loading
                ? "Loading..."
                : `${options.length} active device${options.length === 1 ? "" : "s"}.`}
            </p>
          </div>

          <div>
            <label className={labelCls}>Device Name</label>
            {/* The admin's, shown for confirmation only. Renaming here would rename the
                device for everyone, so the field is read-only. */}
            <input
              type="text"
              value={selected?.device_name ?? ""}
              readOnly
              tabIndex={-1}
              placeholder="From the device you choose"
              className="w-full border rounded px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className={labelCls}>System Type</label>
            <input
              type="text"
              value={systemType}
              onChange={(e) => setSystemType(e.target.value)}
              disabled={!deviceId}
              placeholder="e.g. 64 - Bit"
              maxLength={50}
              className={fieldCls}
            />
          </div>

          <div>
            <label className={labelCls}>Warranty Status</label>
            <SearchableSelect
              value={warrantyStatus}
              onChange={(e) => setWarrantyStatus(e.target.value)}
              disabled={!deviceId}
              className={fieldCls}
            >
              <option value="">Select Warranty Status</option>
              {warrantyStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className={labelCls}>Last Date Of Warranty</label>
            <input
              type="date"
              value={lastDate}
              onChange={(e) => setLastDate(e.target.value)}
              disabled={!deviceId}
              className={fieldCls}
            />
          </div>

          <div>
            <label className={labelCls}>Total Warranty (In Years)</label>
            <input
              type="number"
              min="0"
              max="99"
              step="0.5"
              value={totalYears}
              onChange={(e) => setTotalYears(e.target.value)}
              disabled={!deviceId}
              placeholder="e.g. 3"
              className={fieldCls}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Half years allowed — 1.5 is eighteen months.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving || !deviceId}
            className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f] disabled:opacity-50"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50"
          >
            CANCEL
          </button>
        </div>
      </form>
    </div>
  );
}
