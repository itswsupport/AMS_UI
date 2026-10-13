"use client";

import { useState, useEffect, useCallback } from "react";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import AddDevice from "./_AddDevice";
import DeviceStatus from "./_DeviceStatus";
import { getAssetList, getDeviceStatus } from "@/services/assetService";
import { getDeviceList } from "@/services/deviceService";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserScope } from "@/lib/userScope";
import { isViewer } from "@/lib/permissions";

/*
 * The three device-status cards: each opens the same list (_DeviceStatus) showing only its own
 * devices, and shows their count across every device type.
 */
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
     * An OPEN device that IS registered (a record in ams_add_device_master, just nobody
     * holding it) opens that record in ADD DEVICE to edit — its Action History is where the
     * employee is assigned. The full record comes from the same list LIST DEVICE loads.
     */
    if (row.registered) {
      try {
        const res = await getAssetList(typeId);
        const found =
          res?.status_code === 200 && Array.isArray(res.response)
            ? res.response.find((a) => a.id === row.id)
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
      } catch {
        /* falls through to a pre-filled new form below */
      }
    }
    // An Open name not added yet: ADD DEVICE to fill in (type, model, name locked) — read-only for a VIEWER.
    setEditing(null);
    setReadOnly(viewer);
    setPrefill({ device_id: String(typeId), model: row.model ?? "", name: row.name ?? "" });
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
    <div className="p-6">
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
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${viewer ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
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
