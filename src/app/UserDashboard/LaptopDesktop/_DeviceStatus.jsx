"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import DataTable from "@/components/ui/common/DataTable";
import { getDeviceList } from "@/services/deviceService";
import { getDeviceStatus, getAssetList } from "@/services/assetService";
import { EXPORT_LAYOUTS } from "./_exportLayouts";
import { getCompanyList } from "@/services/masterService";
import { useAuth } from "@/context/AuthContext";
import { getUserScope } from "@/lib/userScope";

/**
 * OPEN / ASSIGNED / TOTAL DEVICES — one list, opened by the page's three cards.
 *
 * Every device is either ASSIGNED (an employee holds it — a printer, its department) or OPEN.
 * OPEN includes names created in Device Name Master that have not been registered yet.
 *
 * NO ACTION COLUMN. The REFERENCE NO opens the device in the form: a registered device in Edit
 * mode (master data locked), an Open name as a pre-filled new device. Everything else — its
 * Action History (assign / reassign) and User Log — is at the bottom of that form.
 *
 * LIVE DATA from GET /asset/status, plus each device's full record from /asset/list so the
 * register exports (Excel / PDF / Print) have every column. The tabs are every active device
 * in Device Master, so a type added there later gets a tab here with nothing to change.
 *
 * @param barColor    the card's colour, so the bar reads as attached to it
 * @param onRegister  (row, deviceTypeId) — opens the row in the form (see page.jsx)
 * @param stateFilter "OPEN" | "ASSIGNED" | "ALL" — which devices this list shows
 * @param title       the bar's heading, e.g. "Open Devices"
 */

/** ASSIGNED / OPEN as plain text — no pill, no dot; only the colour tells them apart. */
function StateBadge({ state }) {
  const assigned = state === "ASSIGNED";
  return (
    <span
      className={`text-[12px] font-semibold uppercase ${
        assigned ? "text-green-700" : "text-blue-700"
      }`}
    >
      {assigned ? "Assigned" : "Open"}
    </span>
  );
}

export default function DeviceStatus({ barColor, onRegister, stateFilter = "ALL", title = "Device Status" }) {
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  // Plant code → company name, for the COMPANY column.
  const [companyByPlant, setCompanyByPlant] = useState({});
  const [error, setError] = useState("");

  // What this user may see (Reporting Person): a USER only their device types and plant.
  const { user } = useAuth();
  const scope = getUserScope(user);
  const scopeKey = `${scope.limited}|${scope.plants.join(",")}|${(user?.device_ids ?? []).join(",")}`;

  /*
   * Rows for every type, keyed by device id — loaded together so each tab can show its count.
   * undefined while a tab is still loading.
   */
  const [rowsByDevice, setRowsByDevice] = useState({});

  const defaulted = useRef(false);

  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  /*
   * One device type's rows, fresh from the server. Each registered row also carries its FULL
   * device record (from /asset/list), so the exports can write the register layouts — PO No.,
   * plant, OS, warranty and the rest. The status fields win where both have a value.
   */
  const loadDevice = useCallback(async (id) => {
    try {
      const [statusRes, assetRes] = await Promise.all([
        getDeviceStatus(id),
        getAssetList(id).catch(() => null),
      ]);
      const list = unwrap(statusRes);
      if (!list) {
        setError("Could not load the device status.");
        return;
      }
      const full = new Map((unwrap(assetRes) ?? []).map((a) => [a.id, a]));
      const merged = list.map((r) =>
        r.registered && full.has(r.id) ? { ...full.get(r.id), ...r } : r
      );
      setError("");
      setRowsByDevice((all) => ({ ...all, [String(id)]: merged }));
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    getDeviceList()
      .then((res) => {
        // A USER gets a tab only for the device types set for them in Reporting Person.
        const list = (unwrap(res) ?? []).filter((d) => d.status === 1 && scope.allowsDevice(d.id));
        setDevices(list);
        // Every tab at once, so each shows its count straight away.
        list.forEach((d) => loadDevice(d.id));
        // Opens on Desktop — or the first type if there is none.
        if (defaulted.current) return;
        defaulted.current = true;
        const preferred =
          list.find((d) => (d.device_name ?? "").toLowerCase() === "desktop") ?? list[0];
        if (preferred) setDeviceId(String(preferred.id));
      })
      .catch(() => setError("Could not load the device list."));

    // Plant code → company name, for the COMPANY column (the same list ADD DEVICE's Plant uses).
    getCompanyList()
      .then((res) => {
        const map = {};
        (unwrap(res) ?? []).forEach((c) => {
          const code = String(c.plant_code ?? "").trim();
          if (code && !map[code]) map[code] = c.company_name || c.company_short_name || "";
        });
        setCompanyByPlant(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDevice, scopeKey]);

  const rows = useMemo(() => rowsByDevice[deviceId] ?? [], [rowsByDevice, deviceId]);
  const loading = Boolean(deviceId) && rowsByDevice[deviceId] === undefined;

  /**
   * Only the devices this list is for — Open, Assigned, or all of them — and, for a USER,
   * only those in their own plant (names not registered yet have no plant and stay).
   */
  const keep = useCallback(
    (list) =>
      list
        .filter(scope.allowsRow)
        .filter((r) => stateFilter === "ALL" || r.state === stateFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateFilter, scopeKey]
  );

  const deviceName = devices.find((d) => String(d.id) === deviceId)?.device_name ?? "";

  /*
   * The table's own columns, worked out per row so they sort, search and export as plain text:
   *   company_label    the company the device's plant belongs to (company master, by plant code)
   *   holder_emp_code  the employee holding it — only an employee, so a printer (held by its
   *   holder_emp_name  department, no history) shows "-" here
   *   device_type      the tab's device type (Desktop, Laptop, …)
   */
  const shown = useMemo(
    () =>
      keep(rows).map((r) => {
        const plant = String(r.plant ?? "").trim();
        const byEmployee = r.state === "ASSIGNED" && Boolean(r.holder_entry_id);
        return {
          ...r,
          company_label: (plant && companyByPlant[plant]) || "",
          holder_emp_code: byEmployee ? r.holder_code ?? "" : "",
          holder_emp_name: byEmployee ? r.holder_name ?? "" : "",
          device_type: deviceName,
        };
      }),
    [rows, keep, companyByPlant, deviceName]
  );

  /*
   * In this order: Reference No, Company, Plant Code, Employee Code, Employee Name, Device Name,
   * Device Type, Status. No ACTION column — the Reference No opens the device.
   */
  const columns = [
    { label: "SR. NO", width: 80 },
    {
      key: "reference_no",
      label: "REFERENCE NO",
      width: 190,
      /*
       * Opens the device in the form: a registered one to VIEW first (all locked, EDIT to
       * change it or assign it), an Open name as a pre-filled new device to fill in and assign. Every name has its number from the moment it is created in Device Name
       * Master, and ADD DEVICE keeps that same number.
       */
      render: (row) => (
        <button
          type="button"
          onClick={() => onRegister?.(row, deviceId)}
          title={row.registered ? "View this device" : "Add and assign this device"}
          className="text-left font-semibold text-[#3482AE] hover:underline"
        >
          {row.reference_no || "-"}
        </button>
      ),
    },
    {
      key: "company_label",
      label: "COMPANY",
      width: 200,
      render: (r) => <span>{r.company_label || "-"}</span>,
    },
    { key: "plant", label: "PLANT CODE", width: 110, render: (r) => <span>{r.plant || "-"}</span> },
    {
      key: "holder_emp_code",
      label: "EMPLOYEE CODE",
      width: 130,
      render: (r) => <span>{r.holder_emp_code || "-"}</span>,
    },
    {
      key: "holder_emp_name",
      label: "EMPLOYEE NAME",
      width: 180,
      render: (r) => <span>{r.holder_emp_name || "-"}</span>,
    },
    { key: "name", label: "DEVICE NAME", width: 130, render: (r) => <span>{r.name || "-"}</span> },
    {
      key: "device_type",
      label: "DEVICE TYPE",
      width: 110,
      render: (r) => <span>{r.device_type || "-"}</span>,
    },
    {
      key: "state",
      label: "STATUS",
      width: 110,
      render: (r) => <StateBadge state={r.state} />,
    },
  ];

  return (
    <div>
      {/* Heading, then one tab per active device in Device Master. */}
      <div
        className="flex flex-wrap items-center gap-5 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          {title}
        </h3>
        <div role="tablist" className="flex flex-wrap gap-[10px]">
          {devices.map((d) => {
            const active = String(d.id) === deviceId;
            // This list's count for the type — open ones on OPEN DEVICES, and so on.
            const tabRows = rowsByDevice[String(d.id)];
            const n = tabRows ? keep(tabRows).length : undefined;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDeviceId(String(d.id))}
                className={`flex items-center gap-2 rounded-[3px] px-3 py-1 text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-white text-[#3482AE] shadow-sm"
                    : "border border-white/60 text-white hover:bg-white/15"
                }`}
              >
                {d.device_name}
                <span
                  className={`rounded-full px-[6px] text-[11px] ${
                    active ? "bg-[#3482AE] text-white" : "bg-white/25 text-white"
                  }`}
                >
                  {n ?? "…"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* The counts are on the page's OPEN / ASSIGNED / TOTAL DEVICES cards, not repeated here. */}
      <div className="mt-2">
        <DataTable
          data={shown}
          columns={columns}
          loading={loading}
          reportTitle={`${deviceName} ${title}`}
          exportsInToolbar
          // The Desktop / Laptop / Printer / Tablet register layouts.
          exportColumns={EXPORT_LAYOUTS[deviceName.toLowerCase()] ?? null}
        />
      </div>
    </div>
  );
}
