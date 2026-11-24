"use client";

import { useState, useEffect, useCallback } from "react";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import AddDevice from "./_AddDevice";
import DeviceStatus from "./_DeviceStatus";
import { getAssetList, getAssetDetails, getDeviceStatus } from "@/services/assetService";
import { getDeviceList } from "@/services/deviceService";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserScope } from "@/lib/userScope";
import { isViewer } from "@/lib/permissions";
import { warnAlert } from "@/lib/confirmDelete";

/*
 * The three device-status cards: each opens the same list (_DeviceStatus) showing only its own
 * devices, and shows their count across every device type.
 */
/** Fields of ADD DEVICE an old per-type table (ams_desktop_master, …) may already hold. */
const LEGACY_FORM_FIELDS = [
  "po_no", "asset_code", "asset_sn", "service_tag", "device_status", "ip_address", "plant",
  "department", "location", "model", "processor", "ram", "hdd", "os", "os_service_pack",
  "ms_office", "charger", "software_1", "software_2", "classification", "system_type",
  "warranty_status", "last_date_of_warranty", "total_warranty_years", "description",
];

const STATUS_VIEWS = {
  open: { title: "Open Devices", filter: "OPEN" },
  assigned: { title: "Assigned Devices", filter: "ASSIGNED" },
  total: { title: "Total Devices", filter: "ALL" },
};


export default function LaptopDesktop() {
  /*
   * "add", "open", "assigned", "total", or null when all are closed.
   *
   * Opens on OPEN DEVICES — the devices waiting to be registered and assigned.
   */
  const [view, setView] = useState("open");

  /*
   * The device list to come back to after the form: the one the user last opened (Open,
   * Assigned or Total), so SUBMIT, UPDATE and BACK land where they started.
   */
  const [returnTo, setReturnTo] = useState("open");

  // The row the form is open on, or null when it is adding a new one.
  const [editing, setEditing] = useState(null);

  /*
   * Whether that row is open to READ or to CHANGE.
   *
   * The list offers both on the same row: its name opens it to read, the pencil to change it.
   * Reading a record is the commoner of the two and should not put anyone one stray keystroke
   * away from altering it, so the read form has every field locked and no save button at all.
   */
  const [readOnly, setReadOnly] = useState(false);

  /*
   * { device_id, model, name } to start ADD DEVICE from — set when DEVICE STATUS assigns an
   * OPEN device that exists only as a name in Device Name Master. Cleared by everything else.
   */
  const [prefill, setPrefill] = useState(null);

  // The sidebar blue, matching the cards and the panel's own title bar.
  const BAR_COLOR = "#3482AE";

  const openAdd = () => {
    // Always a fresh, editable form from the card; a row is only ever opened from the list.
    setEditing(null);
    setReadOnly(false);
    setPrefill(null);
    // Stays open on a second click; another card switches to its own view.
    setView("add");
  };

  /** OPEN / ASSIGNED / TOTAL DEVICES — a second click on the same card closes its list. */
  const openStatus = (which) => {
    setEditing(null);
    setReadOnly(false);
    setPrefill(null);
    setReturnTo(which);
    // Stays open on a second click; another card switches to its own list.
    setView(which);
  };

  /*
   * THE CARD COUNTS — open, assigned and total devices across EVERY device type, from the same
   * /asset/status the lists use, so a card and its list always agree. Reloaded whenever the
   * view changes (after an add, an edit or an assignment), and after an Assign in a list.
   */
  const [counts, setCounts] = useState({ open: 0, assigned: 0, total: 0, loading: true });

  // What this user may see (Reporting Person): a USER only their device types and plant.
  const { user } = useAuth();
  const scope = getUserScope(user);
  // A VIEWER only ever reads: no ADD DEVICE card, no EDIT, no SUBMIT / UPDATE.
  const viewer = isViewer(user);
  const scopeKey = `${scope.limited}|${scope.plants.join(",")}|${(user?.device_ids ?? []).join(",")}`;

  const loadCounts = useCallback(async () => {
    try {
      const res = await getDeviceList();
      // A USER counts only their own device types and plant (Reporting Person).
      const types =
        res?.status_code === 200 && Array.isArray(res.response)
          ? res.response.filter((d) => d.status === 1 && scope.allowsDevice(d.id))
          : [];
      const lists = await Promise.all(
        types.map((t) =>
          getDeviceStatus(t.id)
            .then((r) => (r?.status_code === 200 && Array.isArray(r.response) ? r.response : []))
            .catch(() => [])
        )
      );
      const all = lists.flat().filter(scope.allowsRow);
      const assigned = all.filter((r) => r.state === "ASSIGNED").length;
      setCounts({ open: all.length - assigned, assigned, total: all.length, loading: false });
    } catch {
      setCounts((c) => ({ ...c, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    loadCounts();
  }, [view, loadCounts]);

  /*
   * DEVICE STATUS → Assign on an OPEN device that is only a name in Device Name Master: it has
   * no record to attach a holder to yet, so ADD DEVICE opens with its type, model and name
   * already chosen — fill in the rest and the employee, SUBMIT, and it becomes ASSIGNED.
   */
  const onRegister = async (row, typeId) => {
    /*
     * A device already saved through ADD DEVICE (a record in ams_add_device_master, just nobody
     * holding it) opens THAT record — every field entered when it was added (processor, RAM,
     * OS, plant, warranty, …) — never a blank form with only type / model / name.
     *
     * Looked up by id, and by name too: an Open row whose catalogue name matches a saved device
     * is that device, even if the list did not flag it as registered.
     */
    /*
     * FIRST: the device's own saved record, fetched by type and name from ams_add_device_master
     * (GET /asset/details). Found → it opens with everything entered on ADD DEVICE.
     */
    // Values the old per-type table holds for a device not added yet (warranty, system type, …).
    let legacy = null;
    if (row.name) {
      try {
        const res = await getAssetDetails(typeId, row.name);
        if (res?.status_code === 200 && res.response?.id) {
          setPrefill(null);
          setEditing(res.response);
          setReadOnly(true);
          setView("add");
          return;
        }
        if (res?.status_code === 200 && res.response?.source === "legacy") legacy = res.response;
      } catch {
        /* falls back to the list lookup below */
      }
    }

    let lookupFailed = false;
    try {
      const res = await getAssetList(typeId);
      const list = res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;
      if (!list) lookupFailed = row.registered;
      const key = String(row.name ?? "").trim().toLowerCase();
      const found = list
        ? (row.registered && list.find((a) => String(a.id) === String(row.id))) ||
          (key && list.find((a) => String(a.name ?? "").trim().toLowerCase() === key)) ||
          null
        : null;
      if (found) {
        /*
         * VIEW FIRST: a Reference No click means "show me this device", so it opens to READ —
         * every field locked, no UPDATE. EDIT at the bottom opens the same device to change
         * (and to assign an employee in its Action History).
         */
        setPrefill(null);
        setEditing(found);
        setReadOnly(true);
        setView("add");
        return;
      }
      if (row.registered) lookupFailed = true;
    } catch {
      lookupFailed = row.registered;
    }
    // A saved device that could not be loaded must not open as an empty new form.
    if (lookupFailed) {
      await warnAlert(
        "Could not open this device",
        "Its saved details could not be loaded. Check the connection and try again."
      );
      return;
    }
    // An Open name not added yet: ADD DEVICE to fill in (type, model, name locked) — read-only for a VIEWER.
    setEditing(null);
    setReadOnly(viewer);
    // Whatever the old table has for it (warranty, system type, …) is filled in too, still editable.
    const fromLegacy = {};
    if (legacy) {
      LEGACY_FORM_FIELDS.forEach((k) => {
        const v = legacy[k];
        if (v !== null && v !== undefined && String(v).trim() !== "") fromLegacy[k] = String(v);
      });
    }
    setPrefill({
      ...fromLegacy,
      device_id: String(typeId),
      model: row.model || fromLegacy.model || "",
      name: row.name ?? "",
    });
    setView("add");
  };

  /** After SUBMIT / UPDATE: back to the device list the user came from. */
  const onSaved = () => {
    setEditing(null);
    setReadOnly(false);
    setPrefill(null);
    setView(returnTo);
  };

  /** BACK on the form: to the device list the user came from. */
  const backToList = () => {
    setEditing(null);
    setReadOnly(false);
    setPrefill(null);
    setView(returnTo);
  };

  return (
    <div className="p-3 sm:p-6">
      {/* showBack left on, unlike the Setting page: this one is navigated INTO, so there has
          to be a way back that is not the sidebar. */}
      {/* ADD DEVICE, matching the card on the dashboard that leads here. "Laptop / Desktop"
          named two of the four device types this screen covers and left the rest looking as
          though they belonged somewhere else. */}
      <PageTitle title="ADD DEVICE" />

      {/*
        * Four across: ADD DEVICE, then OPEN / ASSIGNED / TOTAL DEVICES with their counts across
        * every device type (OPEN + ASSIGNED = TOTAL). All the same height. There is no separate
        * LIST DEVICE: devices are reached through these three lists.
        */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${viewer ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        {/* A VIEWER adds nothing, so no ADD DEVICE card for them. */}
        {!viewer && (
          <DashboardCard
            title="Add Device"
            icon={<Plus className="h-7 w-7" />}
            variant="primary"
            onClick={openAdd}
            tall
          />
        )}
        <DashboardCard
          title="Open Devices"
          variant="primary"
          onClick={() => openStatus("open")}
          count={counts.open}
          loading={counts.loading}
        />
        <DashboardCard
          title="Assigned Devices"
          variant="primary"
          onClick={() => openStatus("assigned")}
          count={counts.assigned}
          loading={counts.loading}
        />
        <DashboardCard
          title="Total Devices"
          variant="primary"
          onClick={() => openStatus("total")}
          count={counts.total}
          loading={counts.loading}
        />
      </div>

      <div className="mt-6">
        {view === "add" && (
          <AddDevice
            barColor={BAR_COLOR}
            onSaved={onSaved}
            editing={editing}
            prefill={prefill}
            readOnly={readOnly || viewer}
            onClose={backToList}
            // EDIT on the view screen: the same row, now open to change. None for a VIEWER.
            onStartEdit={viewer ? undefined : () => setReadOnly(false)}
          />
        )}

        {STATUS_VIEWS[view] && (
          <DeviceStatus
            // A fresh list per card, so switching cards starts it again on Desktop.
            key={view}
            barColor={BAR_COLOR}
            onRegister={onRegister}
            stateFilter={STATUS_VIEWS[view].filter}
            title={STATUS_VIEWS[view].title}          />
        )}
      </div>
    </div>
  );
}
