"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getAssetList } from "@/services/assetService";
import { getDeviceList } from "@/services/deviceService";
import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";
import { EXPORT_LAYOUTS } from "./_exportLayouts";

/**
 * LIST DEVICE — everything recorded for one device type.
 *
 * DEVICE TYPE drives this the same way it drives ADD DEVICE, and for the same reason: laptops
 * and desktops are separate tables, so "the list" is meaningless until one is chosen. The type
 * is remembered across a save, so adding a desktop lands you in the desktop list.
 *
 * The table shows the columns worth scanning, not all thirty — the rest are on the row's edit
 * form. AGE is not stored anywhere; the backend works it out from the warranty date and term
 * on every read.
 *
 * @param barColor    the card's colour, so the bar reads as attached to it
 * @param deviceId  which list to show
 * @param onDeviceId called when a device tab is clicked, so the page remembers the choice
 */
export default function ListDevice({ barColor, deviceId, onDeviceId, onView }) {
  const [devices, setDevices] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  /*
   * Whether the opening choice has already been made.
   *
   * Once only. Without it the effect below would re-select desktop every time the device
   * list settled, so deliberately choosing "Select" would snap straight back.
   */
  const defaulted = useRef(false);

  useEffect(() => {
    getDeviceList()
      .then((res) => {
        const list = (unwrap(res) ?? []).filter((d) => d.status === 1);
        setDevices(list);

        /*
         * Open on desktop, so the page arrives showing something rather than an empty panel
         * and a prompt. Matched by NAME rather than a hardcoded id, so it survives the master
         * being renumbered — which has already happened once, from 40/41/43 to 1/2/3.
         *
         * Falls back to the first device, because a master without a desktop in it should
         * still open on something; and does nothing at all if the page already has a device,
         * which is the case when a save has just sent you here.
         */
        if (defaulted.current || deviceId) return;
        defaulted.current = true;

        const preferred =
          list.find((d) => (d.device_name ?? "").toLowerCase() === "desktop") ?? list[0];
        if (preferred) onDeviceId(String(preferred.id));
      })
      .catch(() => setError("Could not load the device list."));
    // Runs once: it is the opening choice, not something to redo as the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRows = useCallback(() => {
    if (!deviceId) {
      setRows([]);
      return Promise.resolve();
    }
    setLoading(true);
    return getAssetList(deviceId)
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
  }, [deviceId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Every active device in the master — nothing is filtered out here.
  const typeOptions = devices;

  /** The chosen device's name, for the messages and the report title. */
  const deviceName = useMemo(() => {
    const match = devices.find((d) => String(d.id) === String(deviceId));
    return match ? match.device_name ?? "" : "";
  }, [devices, deviceId]);

  // A cell that shows "-" rather than an empty box, since most sheet cells are blank.
  const cell = (value) => <span>{value || "-"}</span>;

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position, so it renumbers
    // itself after sorting or filtering.
    { label: "SR. NO", width: 80 },
    {
      key: "name",
      label: "DEVICE NAME",
      width: 130,
      /*
       * The name opens the row to READ — every field filled in, nothing editable, no save.
       * EDIT on that view screen is what opens it to change.
       *
       * Two different intentions, and the commoner one is looking. The table shows twenty of
       * the thirty fields, so the rest are only visible on the form, and needing to open an
       * editable form to read them would put every casual look one keystroke from an
       * accidental change.
       */
      render: (row) => (
        <button
          type="button"
          onClick={() => onView(row)}
          title="View this device"
          className="text-left font-semibold text-[#3482AE] hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    { key: "reference_no", label: "REFERENCE NO", width: 170, render: (r) => cell(r.reference_no) },
    { key: "model", label: "MODEL", width: 170, render: (r) => cell(r.model) },
    { key: "asset_code", label: "ASSET CODE", width: 130, render: (r) => cell(r.asset_code) },
    { key: "asset_sn", label: "ASSET S/N", width: 140, render: (r) => cell(r.asset_sn) },
    { key: "po_no", label: "PO NO.", width: 120, render: (r) => cell(r.po_no) },
    { key: "device_status", label: "DEVICE STATUS", width: 130, render: (r) => cell(r.device_status) },
    { key: "department", label: "DEPARTMENT", width: 130, render: (r) => cell(r.department) },
    { key: "location", label: "LOCATION", width: 130, render: (r) => cell(r.location) },
    { key: "employee_name", label: "EMPLOYEE NAME", width: 150, render: (r) => cell(r.employee_name) },
    { key: "ip_address", label: "IP ADDRESS", width: 140, render: (r) => cell(r.ip_address) },
    { key: "processor", label: "PROCESSOR", width: 150, render: (r) => cell(r.processor) },
    { key: "ram", label: "RAM", width: 100, render: (r) => cell(r.ram) },
    { key: "hdd", label: "HDD", width: 100, render: (r) => cell(r.hdd) },
    { key: "os", label: "OS", width: 150, render: (r) => cell(r.os) },
    { key: "warranty_status", label: "WARRANTY STATUS", width: 150, render: (r) => cell(r.warranty_status) },
    {
      key: "last_date_of_warranty",
      label: "LAST DATE OF WARRANTY",
      width: 170,
      render: (r) => cell(fmtDate(r.last_date_of_warranty)),
    },
    { key: "age", label: "AGE", width: 110, render: (r) => cell(r.age) },
    { key: "classification", label: "CLASSIFICATION", width: 140, render: (r) => cell(r.classification) },
    {
      key: "status",
      label: "STATUS",
      width: 110,
      render: (r) => <span>{r.status === 1 ? "Active" : "Inactive"}</span>,
    },
    // No ACTION column: a device is opened by its name (View), and changed from there (EDIT).
  ];

  return (
    <div>
      {/*
        * The heading on the left, the selector hard against the right.
        *
        * justify-between rather than a fixed gap, so the control keeps to the right edge at
        * every window width instead of drifting inward on a wide screen and colliding with
        * the heading on a narrow one. flex-wrap means it drops onto its own line rather than
        * being squashed when there is genuinely no room.
        */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <div className="flex flex-wrap items-center gap-5">
          <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
            List Device
          </h3>

          {/*
            * ONE TAB PER DEVICE TYPE, beside the heading — every active device in Device
            * Master, so a type added there later gets its own tab with nothing to change here.
            * Clicking one loads that type's table; the page opens on Desktop (see above).
            * The chosen tab is the white one.
            */}
          <div role="tablist" className="flex flex-wrap gap-[10px]">
            {typeOptions.map((d) => {
              const active = String(d.id) === String(deviceId);
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onDeviceId(String(d.id))}
                  className={`rounded-[3px] px-3 py-1 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? "bg-white text-[#3482AE] shadow-sm"
                      : "border border-white/60 text-white hover:bg-white/15"
                  }`}
                >
                  {d.device_name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!deviceId ? (
        <div className="mt-2 rounded-[3px] bg-white p-6 text-center shadow-sm">
          <p className="text-[12px] text-gray-500">
            Choose a device type to see its list.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            reportTitle={`${deviceName} list`}
            exportsInToolbar
            // Desktop and Laptop export their fixed register layouts; other types export the screen.
            exportColumns={EXPORT_LAYOUTS[deviceName.toLowerCase()] ?? null}
          />
        </div>
      )}
    </div>
  );
}
