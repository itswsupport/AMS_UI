"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Select, { components as rsComponents } from "react-select";
import Swal from "sweetalert2";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
import { nativeSelectStyles, nativeSelectComponents } from "@/components/masters/nativeLikeSelect";
import { ROLES, parseRoles, joinRoles, formatRoles, rolesProblem } from "@/lib/permissions";
import { confirmDelete, deletedToast, confirmMasterUpdate, savedToast } from "@/lib/confirmDelete";
/*
 * This screen's own writes are in reportingPersonService; the dropdown lists are read from
 * the services that own them.
 */
import { getDepartmentList, getEmployeeList } from "@/services/masterService";
import { getDeviceList } from "@/services/deviceService";
import { getRoleList } from "@/services/roleService";
import {
  getReportingPersonList,
  saveReportingPerson,
  updateReportingPerson,
  deleteReportingPerson,
} from "@/services/reportingPersonService";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * Reporting Person — who handles which device types at a company + plant, and with which
 * AMS role.
 *
 *   Company / Plant   db_all_master.plant_dept_mst — company_id -> plant_code.
 *                     The company's name comes from plant_mst by company_id (backend).
 *   Device Type       db_asset.ams_device_master, one or several; saved as their ids in
 *                     ams_login_access.device_ids. A USER then adds and sees only these
 *                     device types, only in this plant.
 *   Employee          db_all_master.emp_details   (851 active — searchable, not a dropdown)
 *   Role              db_asset.ams_role_master (Role Master) — its Active roles, one or several,
 *                     saved by id in ams_login_access.role_id ("1,4"). Each role's access type
 *                     (Admin / User / Viewer) goes into ams_login_access.role for login.
 *
 * SAVING ALSO GRANTS LOGIN ACCESS. The backend writes the chosen role into
 * db_asset.ams_login_access for that employee, inserting a row if they had none. Without
 * that, someone could be assigned work they cannot sign in to do.
 */
/*
 * THE CHECKBOX PICKERS (Plant, Device Type) — one or many, kept to ONE LINE like every other
 * field: the box shows a summary ("1001, 1002, 1003 +15 more", or "All plants (18)") instead of
 * a tag per choice, and the list shows a checkbox beside each, with "All" after the last one.
 * Defined outside the panel so the open list is not rebuilt (and does not flicker) on a re-render.
 */

/** The "All" entry at the END of the list (after the last choice): ticks or clears every one. */
const ALL_PLANTS = "__ALL__";

/** "1001, 1002, 1003 +15 more" — the first few, then how many more; "All plants (18)" for all. */
const summarisePlants = (codes, total, noun = "plants") => {
  if (!codes.length) return "";
  if (total > 1 && codes.length === total) return `All ${noun} (${total})`;
  const shown = codes.slice(0, 3).join(", ");
  return codes.length > 3 ? `${shown} +${codes.length - 3} more` : shown;
};

/** A choice in the list: a checkbox, ticked when chosen, and its label. */
const PlantOption = (props) => (
  <rsComponents.Option {...props}>
    <span className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={props.isSelected}
        readOnly
        tabIndex={-1}
        className="pointer-events-none h-3.5 w-3.5 accent-[#3482AE]"
      />
      {props.label}
    </span>
  </rsComponents.Option>
);

const plantSelectComponents = { ...nativeSelectComponents, Option: PlantOption };

const plantSelectStyles = {
  ...nativeSelectStyles,
  // The summary is the value, so it reads as normal text, cut with "…" if it is too long.
  placeholder: (base, state) => ({
    ...base,
    color: state.selectProps.pickedCount ? "#111827" : "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  // A light tint for a ticked plant — the checkbox already says it is chosen.
  option: (base, state) => ({
    ...nativeSelectStyles.option(base, state),
    backgroundColor: state.isFocused && !state.isDisabled ? "#eef4f8" : "#ffffff",
    // A choice that cannot be ticked now (Viewer with Admin / User) reads as greyed out.
    color: state.isDisabled ? "#9ca3af" : state.data.value === ALL_PLANTS ? "#3482AE" : "#111827",
    cursor: state.isDisabled ? "not-allowed" : base.cursor,
    fontWeight: state.isSelected || state.data.value === ALL_PLANTS ? 600 : 400,
    // "All" sits under the last plant, set apart by a line.
    borderTop: state.data.value === ALL_PLANTS ? "1px solid #e5e7eb" : base.borderTop,
  }),
};

/**
 * One checkbox picker: `options` [{ value, label, search? }], `values` the chosen values,
 * `onChange(values)`. "All" after the last option ticks every one; unticking it clears them.
 * `noun` names them in the summary ("All device types (4)").
 */
function CheckMultiSelect({
  options, values, onChange, noun, placeholder, isDisabled = false, showAll = true, isOptionDisabled,
}) {
  const picked = options.filter((o) => values.includes(o.value));
  const allOption = { value: ALL_PLANTS, label: "All", search: "all" };
  // Roles have no "All": Viewer is never combined with the others.
  const allPicked = showAll && options.length > 0 && picked.length === options.length;
  return (
    <Select
      isMulti
      options={options.length ? (showAll ? [...options, allOption] : options) : []}
      value={allPicked ? [...picked, allOption] : picked}
      onChange={(opts, meta) => {
        if (meta?.option?.value === ALL_PLANTS) {
          onChange(meta.action === "select-option" ? options.map((o) => o.value) : []);
          return;
        }
        onChange((opts ?? []).filter((o) => o.value !== ALL_PLANTS).map((o) => o.value));
      }}
      isDisabled={isDisabled}
      // A choice that cannot go with what is ticked (Viewer with Admin / User) is greyed out.
      isOptionDisabled={isOptionDisabled}
      // The summary stands in for the tags (shown through the placeholder).
      controlShouldRenderValue={false}
      placeholder={summarisePlants(picked.map((o) => o.label), options.length, noun) || placeholder}
      hideSelectedOptions={false}
      closeMenuOnSelect={false}
      isClearable={false}
      backspaceRemovesValue={false}
      // Matches `search` when an option has one (a plant's hidden name), else its label.
      filterOption={(option, input) =>
        !input ||
        (option.data.search ?? String(option.label).toLowerCase()).includes(input.trim().toLowerCase())
      }
      pickedCount={picked.length}
      menuPlacement="bottom"
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      components={plantSelectComponents}
      styles={plantSelectStyles}
    />
  );
}

export default function ReportingPersonPanel({ barColor }) {
  const [showForm, setShowForm] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  // Role Master rows; null until loaded (or if it could not be), when the built-in list is used.
  const [roleRows, setRoleRows] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [companyName, setCompanyName] = useState("");
  // Plant codes, as strings — one or several (saved comma-separated: "1001,1003").
  const [plantCodes, setPlantCodes] = useState([]);
  // Device Master ids, as strings — one or several.
  const [deviceIds, setDeviceIds] = useState([]);
  const [empCode, setEmpCode] = useState("");
  // One role or several (Admin + User) — saved as "ADMIN,USER". Viewer is never combined.
  // Role Master ids, as strings — one or several ("1,4"). Viewer-type roles stand alone.
  const [roleIds, setRoleIds] = useState([]);
  const [description, setDescription] = useState("");
  // 1 = active, 0 = inactive. -1 (deleted) is never set from this form.
  const [status, setStatus] = useState(1);
  // null while adding; holds the row id while editing.
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  const loadRows = useCallback(() => {
    setLoadingRows(true);
    return getReportingPersonList()
      .then((res) => setRows(unwrap(res) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    Promise.all([getDepartmentList(), getDeviceList(), getEmployeeList()])
      .then(([c, dev, emp]) => {
        const companyRows = unwrap(c);
        const deviceRows = unwrap(dev);
        const empRows = unwrap(emp);

        if (!companyRows || !deviceRows || !empRows) {
          setLoadError("Could not load one of the lists.");
          return;
        }
        setCompanies(companyRows);
        // Active device types only — an inactive one is out of circulation.
        setDeviceTypes(deviceRows.filter((d) => d.status === 1));
        setEmployees(empRows);
      })
      .catch(() => setLoadError("Could not reach the server."));
  }, []);

  useEffect(() => {
    getRoleList()
      .then((res) => setRoleRows(unwrap(res)))
      .catch(() => setRoleRows(null));
  }, []);

  /*
   * plant_dept_mst has one row per department, so a company repeats once per department and
   * a plant once per department too — both are de-duplicated here. Rows whose plant has no
   * company in company_mst are left out, since they cannot be filed under a company.
   */
  const companyNames = [
    ...new Set(companies.map((c) => c.company_name).filter(Boolean)),
  ].sort();
  const plantsForCompany = [
    ...new Map(
      companies
        .filter((c) => c.company_name === companyName && c.plant_code)
        .map((c) => [String(c.plant_code), c])
    ).values(),
  ].sort((a, b) => String(a.plant_code).localeCompare(String(b.plant_code)));

  /*
   * Only the plant CODE is shown (1001, 1002 …). The plant's name is carried in `search`, never
   * displayed, so typing part of the name still finds its code (see filterOption below).
   */
  const plantOptions = plantsForCompany.map((p) => ({
    value: String(p.plant_code),
    label: String(p.plant_code),
    search: `${p.plant_code} ${p.plant_name ?? ""}`.toLowerCase(),
  }));

  /** DEVICE TYPE — every active device in Device Master, "Laptop" rather than "laptop". */
  const deviceTypeOptions = deviceTypes.map((d) => {
    const n = d.device_name ?? "";
    return { value: String(d.id), label: n.charAt(0).toUpperCase() + n.slice(1) };
  });

  /*
   * ROLE — every role in Role Master, picked BY ID and saved as role_id ("1,4"). Each role has
   * an access type (Admin / User / Viewer), and `roles` below is those access types — what the
   * rules here and the backend's `role` column work with ("ADMIN,USER").
   *
   * Only Active roles are offered. One the person being edited already holds stays in the list
   * even if inactive, so opening their entry does not silently drop it.
   */
  const roleById = Object.fromEntries((roleRows ?? []).map((r) => [String(r.id), r]));
  const splitIds = (v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  /** A row's roles as ids — from role_id, or (an older row) its role codes' built-in roles. */
  const roleIdsOf = (row) =>
    row?.role_id
      ? splitIds(row.role_id)
      : parseRoles(row?.role)
          .map((code) => (roleRows ?? []).find((r) => r.role_code === code)?.id)
          .filter(Boolean)
          .map(String);
  const idsText = (ids) => ids.map((id) => roleById[id]?.role_name ?? id).join(", ");
  /** A row's roles by name ("Admin, IT Support"); its access types if Role Master is not loaded. */
  const rowRoleText = (row) => idsText(roleIdsOf(row)) || formatRoles(row?.role);
  /** Access types by name: "Admin, User". */
  const roleText = (value) => formatRoles(value);
  const heldNow = editingId ? roleIdsOf(rows.find((r) => r.id === editingId)) : [];
  const roleOptions = (roleRows ?? [])
    .filter((r) => r.status === 1 || heldNow.includes(String(r.id)))
    .map((r) => ({ value: String(r.id), label: r.role_name, access: r.access_type }));
  // The access types of the roles picked — ["ADMIN","USER"].
  const roles = parseRoles(roleIds.map((id) => roleById[id]?.access_type));
  const viewerPicked = roles.includes(ROLES.VIEWER);

  /*
   * PLANT-WISE ACCESS FOR EVERY ROLE — Admin included: the plants and device types are picked
   * here by hand, and the person then works only on those (userScope.js, and the backend's
   * device check). "All" at the end of each list still ticks every one when that is wanted.
   */

  /*
   * 851 employees is far too many for a plain <select>, so the employee field is a
   * react-select combobox: typing filters the list in place and the matches drop down under
   * the box, rather than a search input feeding a second control below it.
   *
   * The label carries the code as well as the name because people are known by one or the
   * other, and react-select searches the label — so typing either finds the person.
   */
  const employeeOptions = employees.map((e) => ({
    value: e.emp_code,
    label: `${e.emp_code} - ${e.emp_name}`,
  }));

  const clearFields = () => {
    setCompanyName("");
    setPlantCodes([]);
    setDeviceIds([]);
    setEmpCode("");
    setRoleIds([]);
    setDescription("");
    setStatus(1);
    setEditingId(null);
    setError("");
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    // The company that plant belongs to in plant_dept_mst, so a row saved with another
    // spelling of the company name still opens on the right one.
    const saved = String(row.plant_code ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    const plantRow = companies.find((d) => String(d.plant_code) === saved[0]);
    setCompanyName(plantRow?.company_name ?? row.company_name ?? "");
    setPlantCodes(saved);
    setDeviceIds(Array.isArray(row.device_ids) ? row.device_ids.map((id) => String(id)) : []);
    setEmpCode(row.emp_code ? String(row.emp_code) : "");
    setRoleIds(roleIdsOf(row));
    setDescription(row.description ?? "");
    setStatus(row.status ?? 1);
    setError("");
    setShowForm(true);
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
    if (deviceIds.length === 0) return setError("Select at least one device type.");
    if (!empCode) return setError("Select an employee.");
    if (!roleIds.length) return setError("Select a role.");
    const roleProblem = rolesProblem(roles);
    if (roleProblem) return setError(roleProblem);
    if (viewerPicked && roleIds.length > 1) return setError("A Viewer role cannot be combined with another role.");

    /*
     * ONE ENTRY PER EMPLOYEE. ADDING someone who already has access would REPLACE their entry —
     * their plants 1002, 1003 lost for the 1006 picked now. So it is refused, saying what they
     * have, with EDIT THEIR ACCESS opening their own entry to add the plant there.
     */
    if (!editingId) {
      const existing = rows.find((r) => String(r.emp_code) === String(empCode));
      if (existing) {
        const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
        const who = [existing.emp_code, existing.emp_name].filter(Boolean).join(" - ");
        const plants = String(existing.plant_code ?? "").split(",").map((c) => c.trim()).filter(Boolean).join(", ");
        const types =
          existing.device_names ||
          (existing.device_ids ?? [])
            .map((id) => deviceTypeOptions.find((o) => o.value === String(id))?.label ?? id)
            .join(", ");
        const go = await Swal.fire({
          icon: "warning",
          title: "This employee already has access",
          html:
            `<p><b>${esc(who)}</b> already has AMS access:</p>` +
            `<p style="margin-top:8px;text-align:left;font-size:13px">` +
            `Role: <b>${esc(rowRoleText(existing) || existing.role)}</b><br/>` +
            `Plant(s): <b>${esc(plants || "-")}</b><br/>` +
            `Device type(s): <b>${esc(types || "-")}</b></p>` +
            `<p style="margin-top:8px;font-size:13px">To add a plant, a device type or a role, edit their existing access.</p>`,
          showCancelButton: true,
          confirmButtonText: "Edit their access",
          cancelButtonText: "Cancel",
          confirmButtonColor: "#3482AE",
          cancelButtonColor: "#6b7280",
        });
        if (go.isConfirmed) onEdit(existing);
        return;
      }
    }

    /*
     * VIEWER STANDS ALONE ACROSS EVERY ENTRY of this employee, not only within this one: an
     * employee already Viewer in another Reporting Person entry cannot be given Admin / User
     * here, and one already Admin / User elsewhere cannot be made Viewer — together they would
     * still hold Viewer + User or Viewer + Admin.
     */
    const otherRoles = rows
      .filter((r) => r.id !== editingId && String(r.emp_code) === String(empCode))
      .flatMap((r) => parseRoles(r.role));
    const clash = rolesProblem([...new Set([...roles, ...otherRoles])]);
    if (otherRoles.length && clash) {
      const emp = employees.find((e) => String(e.emp_code) === String(empCode));
      const who = [empCode, emp?.emp_name].filter(Boolean).join(" - ");
      const theirs = roleText([...new Set(otherRoles)]);
      return setError(
        roles.includes(ROLES.VIEWER)
          ? `${who} is already ${theirs} in another entry — Viewer cannot be added with Admin or User.`
          : `${who} is already Viewer in another entry — Admin or User cannot be added with Viewer.`
      );
    }

    // In plant-code order, so "1003,1001" and "1001,1003" are saved the same.
    const picked = [...plantCodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    setSaving(true);
    setError("");
    try {
      const body = {
        company_name: companyName,
        // Only the codes — a plant's name is in the plant master (shown from the company).
        plant_code: picked.join(","),
        device_ids: deviceIds.map(Number),
        emp_code: Number(empCode),
        // The roles picked, as Role Master ids ("1,4"); the backend works out `role` from them.
        role_id: [...roleIds].sort((a, b) => Number(a) - Number(b)).join(","),
        // Their access types, "ADMIN,USER" — the backend checks it again from the ids.
        role: joinRoles(roles),
        description: description.trim() || null,
        status,
      };
      // UPDATE asks first, listing each changed field FROM → TO; Cancel sends nothing.
      if (editingId) {
        const original = rows.find((r) => r.id === editingId);
        const sorted = (list) => [...list].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
        const deviceName = (id) => deviceTypeOptions.find((o) => o.value === String(id))?.label ?? id;
        const employee = (code) => {
          const e = employees.find((x) => String(x.emp_code) === String(code));
          return code ? `${code} - ${e?.emp_name ?? (String(code) === String(original?.emp_code) ? original?.emp_name ?? "" : "")}` : "";
        };
        const ok = await confirmMasterUpdate(original, body, {
          labels: {
            company_name: "Company",
            plant_code: "Plant",
            device_ids: "Device Type",
            emp_code: "Employee",
            role_id: "Role",
            description: "Description",
            status: "Status",
          },
          show: {
            // Order does not matter: "1003,1001" and "1001,1003" are the same plants.
            plant_code: (v) => sorted(String(v ?? "").split(",").map((c) => c.trim()).filter(Boolean)).join(", "),
            device_ids: (v) => sorted((Array.isArray(v) ? v : []).map(deviceName)).join(", "),
            emp_code: employee,
            // By name, and order does not matter.
            role_id: (v) => idsText(splitIds(v).sort((a, b) => Number(a) - Number(b))),
          },
          what: `login access ${employee(original?.emp_code ?? empCode)}`,
        });
        if (!ok) return;
      }
      // Same form for both; the id is what turns a save into an update.
      const res = editingId
        ? await updateReportingPerson({ ...body, id: editingId })
        : await saveReportingPerson(body);

      if (res?.status_code !== 200) {
        setError(res?.message || "Could not save.");
        return;
      }
      closeForm();
      await loadRows();
      savedToast(`Login access ${editingId ? "updated" : "added"} successfully`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row) => {
    /*
     * Worth spelling out: the assignment and the login access are the same row now, so
     * deleting here signs the person out of AMS entirely, not just off these device types.
     */
    const confirmed = await confirmDelete(
      "Remove AMS access?",
      // Code as well as name, so the right person is confirmed when two share a name.
      `${row.emp_code} - ${row.emp_name || ""} will lose access to AMS and will no longer be able to sign in.`
    );
    if (!confirmed) return;
    try {
      const res = await deleteReportingPerson(row.id);
      if (res?.status_code !== 200) {
        setError(res?.message || "Could not delete.");
        return;
      }
      await loadRows();
      deletedToast("AMS access removed");
    } catch {
      setError("Could not reach the server.");
    }
  };

  const columns = [
    { label: "SR. NO", width: 70 },
    { key: "company_name", label: "COMPANY" },
    // One plant or several: "1001, 1003".
    {
      key: "plant_code",
      label: "PLANT",
      // Up to three codes, then "+N more" — the full list on hover.
      render: (row) => {
        const codes = String(row.plant_code ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        if (!codes.length) return <span>-</span>;
        return <span title={codes.join(", ")}>{summarisePlants(codes, 0)}</span>;
      },
    },
    { key: "device_names", label: "DEVICE TYPE", render: (row) => <span>{row.device_names || "-"}</span> },
    /*
     * Code and name as two columns rather than one "101099 - GANESH BARATHE" cell. People
     * search this table by whichever of the two they know, and a combined cell cannot be
     * sorted or filtered by code on its own.
     *
     * Both already come back from /reportingperson/list — emp_code straight off the
     * ams_login_access row, emp_name resolved from db_all_master.emp_details — so this
     * needed no backend change.
     */
    { key: "emp_code", label: "EMP CODE", width: 110 },
    { key: "emp_name", label: "EMPLOYEE NAME" },
    { key: "role", label: "ROLE", render: (row) => <span>{rowRoleText(row) || row.role || "-"}</span> },
    { key: "description", label: "DESCRIPTION", render: (row) => <span>{row.description || "-"}</span> },
    {
      key: "status",
      label: "STATUS",
      width: 110,
      render: (row) => (
        <span>
          {row.status === 1 ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      label: "ACTION",
      render: (row) => (
        <div className="flex h-full items-center gap-3">
          <button onClick={() => onEdit(row)} title="Edit"
            className="text-[#3482AE] hover:text-[#2a6d8f]">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(row)} title="Delete"
            className="text-[#e74c3c] hover:text-[#c0392b]">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
  const fieldCls = "w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100";

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Login Access
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

      <Modal
        open={showForm}
        title={editingId ? "Edit Login Access" : "Add Login Access"}
        barColor={barColor}
        onClose={closeForm}
      >
        <form onSubmit={onSubmit} className="p-4 sm:p-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

          {/* gap-y-5: room for the Role hint that hangs under its picker. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-5">
            <div>
              <label className={labelCls}>Company <span className="text-red-500">*</span></label>
              <SearchableSelect
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  // The plants belonged to the previous company.
                  setPlantCodes([]);
                }}
                className={fieldCls}
              >
                <option value="">Select Company</option>
                {companyNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </SearchableSelect>
            </div>

            <div>
              <label className={labelCls}>Plant <span className="text-red-500">*</span></label>
              {/*
                react-select styled as a native select — same as the Category Master panel.
                nativeLikeSelect.jsx explains why a real <select> cannot be used here.
              */}
              {/*
                One plant or several, on ONE line: the box shows a summary, the list a checkbox
                per plant and "All" after the last (see PlantOption above).
              */}
              <CheckMultiSelect
                options={plantOptions}
                values={plantCodes}
                onChange={setPlantCodes}
                noun="plants"
                placeholder="Search Plant..."
                isDisabled={!companyName}
              />
            </div>

            <div>
              <label className={labelCls}>Device Type <span className="text-red-500">*</span></label>
              {/*
                One or several: what this person may add and see in Add Device, for the plant(s)
                beside it. Same picker as Plant — a checkbox per type, "All" after the last.
              */}
              <CheckMultiSelect
                options={deviceTypeOptions}
                values={deviceIds}
                onChange={setDeviceIds}
                noun="device types"
                placeholder="Select Device Type..."
              />
            </div>

            <div>
              <label className={labelCls}>Employee <span className="text-red-500">*</span></label>
              {/* Opens below, with a list short enough to end inside the popup. */}
              <Select
                options={employeeOptions}
                value={employeeOptions.find((o) => String(o.value) === String(empCode)) ?? null}
                onChange={(opt) => setEmpCode(opt ? opt.value : "")}
                placeholder="Search name or code..."
                isClearable
                menuPlacement="bottom"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                components={nativeSelectComponents}
                /*
                 * A shorter list than the shared 168px: only ~120px of the popup lies below
                 * this second-row field, so the full height hung off its bottom edge. It still
                 * scrolls, and typing narrows the 851 names to the one wanted.
                 */
                styles={{
                  ...nativeSelectStyles,
                  menuList: (base, state) => ({
                    ...(nativeSelectStyles.menuList ? nativeSelectStyles.menuList(base, state) : base),
                    maxHeight: "110px",
                  }),
                }}
              />
            </div>

            {/* relative: the hint under the picker hangs below it rather than making this row taller. */}
            <div className="relative">
              <label className={labelCls}>Role <span className="text-red-500">*</span></label>
              {/*
                One role or several, from Role Master. A VIEWER-type role STANDS ALONE: with one
                ticked, every other role is greyed out; with any other ticked, Viewer-type roles
                are greyed out. Untick to change.
              */}
              <CheckMultiSelect
                options={roleOptions}
                values={roleIds}
                onChange={(next) => setRoleIds(next)}
                isOptionDisabled={(opt) =>
                  viewerPicked
                    ? !roleIds.includes(opt.value)
                    : roleIds.length > 0 && opt.access === ROLES.VIEWER
                }
                noun="roles"
                placeholder={roleRows ? "Select Role..." : "Role Master could not be loaded"}
                showAll={false}
              />
              {/* On a phone (one column) it stays in the flow, so it cannot cover the next field. */}
              <p className="mt-1 text-[11px] leading-tight text-gray-500 normal-case md:absolute md:left-0 md:top-full md:mt-0.5">
                {viewerPicked
                  ? "A Viewer role is view-only — no other role can be added with it."
                  : roleIds.length
                    ? "A Viewer role cannot be added with these."
                    : "Several roles can be given together; a Viewer role only on its own."}
              </p>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              {/* Same box as the pickers beside it (nativeLikeSelect: 38px, 14px, #d1d5db). */}
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                maxLength={255}
                className="block w-full h-[38px] rounded-[4px] border border-[#d1d5db] bg-white px-3 text-[14px] outline-none focus:border-[#3482AE]"
              />
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <SearchableSelect
                value={status}
                onChange={(e) => setStatus(Number(e.target.value))}
                className={fieldCls}
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </SearchableSelect>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f] disabled:opacity-50">
              {saving ? "SAVING..." : editingId ? "UPDATE" : "SAVE"}
            </button>
            <button type="button" onClick={closeForm}
              className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50">
              CANCEL
            </button>
          </div>
        </form>
      </Modal>

      {/* Hidden while the form is open, so ADD shows the form and nothing else. */}
      <div className="mt-2">
        <DataTable
            data={rows}
            columns={columns}
            loading={loadingRows}
            reportTitle="Login Access"
          />
        </div>
    </div>
  );
}
