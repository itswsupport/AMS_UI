"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import Select from "react-select";
import {
  nativeSelectStyles,
  nativeSelectComponents,
} from "@/components/masters/nativeLikeSelect";
import { warnAlert, savedToast, confirmUpdate } from "@/lib/confirmDelete";
import { formatWarranty, deriveWarrantyStart } from "@/lib/warranty";
import {
  getServerAssetList,
  saveServerAsset,
  updateServerAsset,
  getServerChangeLog,
} from "@/services/serverAssetService";
import { useAuth } from "@/context/AuthContext";
import { cleanField, typedWarning } from "@/lib/fieldFormats";
import UserLogTable from "@/components/ui/common/UserLogTable";
// The NAME dropdown is the admin's Server Master, not free text.
import { getServerList } from "@/services/serverService";
import { getRamList } from "@/services/ramService";
import { getProcessorList } from "@/services/processorService";
import { getHddList } from "@/services/hddService";
import { getOsList } from "@/services/osService";
import { getWarrantyList } from "@/services/warrantyService";
import { getIpAddressList } from "@/services/ipAddressService";
import { getSystemTypeList } from "@/services/systemTypeService";
// Departments come from db_all_master.plant_dept_mst, the same list as Department Master.
import { getCompanyList, getDepartmentList, getLocationList } from "@/services/masterService";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * ADD SERVER — the user side of Server.
 *
 * The fields are the workbook's SERVER sheet, which is also exactly the shape of
 * ams_server_with_ip_master. Only NAME is required; the sheet leaves most cells blank on
 * most rows, so a form that insisted on more could not record the servers the company has.
 *
 * AGE is not here. It is (last date of warranty − term) measured to today, so it changes by
 * itself as months pass — the backend works it out on every read and the list shows it.
 *
 * Where a master owns a list, the field is a searchable dropdown over it and nothing else
 * can be entered: Processor, RAM, HDD, OS, System Type, IP Address, Department, Plant and
 * Warranty Status. The rest are typed, because no master owns them yet.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 * @param onSaved  called after a successful save, so the page can show the list
 * @param editing  a row handed over by the list view, or null to add
 * @param readOnly open to read: every field locked, no save button
 * @param onClose  back to the list
 */

const LABEL_CLS = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
const FIELD_CLS =
  "w-full border rounded px-3 py-2 text-sm disabled:bg-[var(--ams-disabled-bg,#f3f4f6)]";
const SELECT_CLS = FIELD_CLS + " ams-select";

/** BACK in a form's title bar: white on the bar's blue, right-hand side. */
const FORM_BACK_CLS =
  "flex items-center gap-1 rounded-[3px] bg-white px-3 py-1 text-[11px] font-semibold uppercase text-[#3482AE] hover:bg-white/90";

/** Fields on a record opened to read: filled in, not editable. */
const VIEW_BG = "#E6F2FF";
const NOT_READY_BG = "#f3f4f6";

const BLANK = {
  server_name: "",
  ip_address: "",
  plant: "",
  department: "",
  location: "",
  server_type: "",
  serial_no: "",
  processor: "",
  ram: "",
  hdd: "",
  warranty_status: "",
  warranty_start_date: "",
  last_date_of_warranty: "",
  total_warranty_years: "",
  os_name: "",
  os_service_pack: "",
  system_type: "",
  other_software_1: "",
  other_software_2: "",
  description: "",
  /*
   * NOT ON THE FORM, but carried so an edit cannot blank it. The sheet recorded an owner
   * against some servers and there is no field asking for one.
   */
  owner_name: "",
  status: 1,
};

/**
 * TOTAL WARRANTY (IN YEARS) from the two dates — the same rule as ADD DEVICE: whole months from
 * the start to the day after the last date, as years to two decimals (01/10/2026 to 30/09/2029
 * is 3, to 31/03/2028 is 1.5). Blank until both dates are there and the last is after the start.
 */
const warrantyYears = (start, end) => {
  if (!start || !end || end <= start) return "";
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  // The day after the last date, so a period ending the day before an anniversary counts in full.
  const after = new Date(ey, em - 1, ed + 1);
  let months = (after.getFullYear() - sy) * 12 + (after.getMonth() + 1 - sm);
  if (after.getDate() < sd) months -= 1;
  if (months <= 0) return "";
  return String(Math.round((months / 12) * 100) / 100);
};

/** Each field as the form labels it — for the "update FROM → TO" confirmation, in form order. */
const SERVER_LABELS = [
  ["server_name", "Server Name"],
  ["server_type", "Type"],
  ["serial_no", "S/N"],
  ["processor", "Processor Ghz"],
  ["ram", "RAM"],
  ["hdd", "HDD (GB)"],
  ["system_type", "System Type"],
  ["os_name", "OS"],
  ["os_service_pack", "OS Service Pack"],
  ["other_software_1", "Other Software 1"],
  ["other_software_2", "Other Software 2"],
  ["ip_address", "IP Address"],
  ["plant", "Plant"],
  ["department", "Dept."],
  ["location", "Location"],
  ["warranty_status", "Warranty Status"],
  ["warranty_start_date", "Warranty Start Date"],
  ["last_date_of_warranty", "Last Date Of Warranty"],
  ["total_warranty_years", "Total Warranty (Years & Months)"],
  ["description", "Description"],
];

/**
 * Every field that differs between the saved server and the form, ONE BY ONE, shown as on the
 * form: dates DD/MM/YYYY, the total as years.months.
 */
function serverChanges(saved, form) {
  const show = (k, v) => {
    if (v === null || v === undefined || String(v).trim() === "") return "";
    if (k.includes("date")) return String(v).slice(0, 10).split("-").reverse().join("/");
    if (k === "total_warranty_years") return formatWarranty("", "", v);
    return String(v).trim();
  };
  const same = (k, a, b) => {
    if (k === "total_warranty_years") {
      const x = a === "" || a == null ? null : Number(a);
      const y = b === "" || b == null ? null : Number(b);
      return x === y || (x !== null && y !== null && Math.abs(x - y) < 0.005);
    }
    return String(a ?? "").trim() === String(b ?? "").trim();
  };
  return SERVER_LABELS.filter(([k]) => !same(k, saved?.[k], form[k])).map(([k, label]) => ({
    label,
    from: show(k, saved?.[k]),
    to: show(k, form[k]),
  }));
}

function Section({ title, children }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="mb-3 border-b pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

/**
 * With `format` (a key of FIELD_FORMATS) a refused character is dropped as typed and a warning
 * says so right then, fading after a few seconds — as on ADD DEVICE.
 */
function TextField({ label, value, onChange, disabled, placeholder, maxLength = 150, format }) {
  const [typed, setTyped] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const handleChange = (e) => {
    const warning = format ? typedWarning(format, e.target.value) : null;
    clearTimeout(timer.current);
    setTyped(warning ?? "");
    if (warning) timer.current = setTimeout(() => setTyped(""), 3000);
    onChange(e);
  };
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${FIELD_CLS}${typed ? " border-red-500!" : ""}`}
      />
      {typed && (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600 normal-case">
          {typed}
        </p>
      )}
    </div>
  );
}

/** A searchable dropdown over one master's values. See _AddDevice for the full reasoning. */
function MasterSelect({ label, options, value, onChange, disabled, master }) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <Select
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(opt) => onChange(opt ? opt.value : "")}
        isDisabled={disabled}
        isClearable
        placeholder={`Search ${label}...`}
        noOptionsMessage={() => `No ${label.toLowerCase()} matches that`}
        menuPlacement="bottom"
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        components={nativeSelectComponents}
        styles={nativeSelectStyles}
      />
      {!disabled && options.length === 0 && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600">
          No {label.toLowerCase()} has been added. Add one in {master} first.
        </p>
      )}
    </div>
  );
}

export default function AddServer({
  barColor,
  onSaved,
  editing = null,
  readOnly = false,
  onClose,
  onStartEdit,
}) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  // The USER LOG of the server open (none while adding), loaded from the backend.
  const [changeLog, setChangeLog] = useState([]);
  useEffect(() => {
    const id = editing?.id;
    if (!id) {
      setChangeLog([]);
      return undefined;
    }
    let cancelled = false;
    getServerChangeLog(id)
      .then((res) => {
        if (!cancelled) setChangeLog(res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
      })
      .catch(() => {
        if (!cancelled) setChangeLog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing?.id]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const [rams, setRams] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [hdds, setHdds] = useState([]);
  const [oses, setOses] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [ips, setIps] = useState([]);
  const [systemTypes, setSystemTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [plants, setPlants] = useState([]);
  // Location Master rows: { plant_code, location_name, … } — the same list ADD DEVICE uses.
  const [locations, setLocations] = useState([]);

  /** The servers the admin has registered in Server Master — what NAME offers. */
  const [masterServers, setMasterServers] = useState([]);

  /** Names already on the register, so they can be shown as taken rather than offered. */
  const [takenNames, setTakenNames] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
    const unwrap = (res) =>
      res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

    // Active only. A value switched off in its master is out of circulation.
    const active = (list) => (list ?? []).filter((r) => r.status === 1);

    const fail = () => {
      if (!cancelled) setLoadError("Some lists could not be loaded.");
    };
    const take = (setter, transform) => (res) => {
      if (!cancelled) setter(transform(unwrap(res)));
    };

    getRamList().then(take(setRams, active)).catch(fail);
    getProcessorList().then(take(setProcessors, active)).catch(fail);
    getHddList().then(take(setHdds, active)).catch(fail);
    getOsList().then(take(setOses, active)).catch(fail);
    getWarrantyList().then(take(setWarranties, active)).catch(fail);
    getIpAddressList().then(take(setIps, active)).catch(fail);
    getSystemTypeList().then(take(setSystemTypes, active)).catch(fail);
    // Read-only, no status column to filter on.
    getDepartmentList().then(take(setDepartments, (l) => l ?? [])).catch(fail);
    // Company rows are read-only reference data with no status column of their own.
    getCompanyList().then(take(setPlants, (l) => l ?? [])).catch(fail);
    // Read-only reference data, as on ADD DEVICE.
    getLocationList().then(take(setLocations, (l) => l ?? [])).catch(fail);

    getServerList().then(take(setMasterServers, active)).catch(fail);

    /*
     * The register itself, only to know which names are spoken for. Each is still offered in
     * the dropdown but marked and unselectable, rather than hidden — hidden, a server that
     * exists would look as though it had gone missing.
     */
    getServerAssetList()
      .then((res) => {
        if (cancelled) return;
        const list = unwrap(res) ?? [];
        setTakenNames(
          new Set(list.map((r) => (r.server_name ?? "").trim().toLowerCase()).filter(Boolean))
        );
      })
      .catch(fail);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editing) {
      setForm(BLANK);
      return;
    }
    const filled = { ...BLANK };
    Object.keys(BLANK).forEach((k) => {
      if (editing[k] !== undefined && editing[k] !== null) filled[k] = editing[k];
    });
    /*
     * A server saved BEFORE Warranty Start Date existed has none on record — only its last date
     * and total. The start is worked back from those two (deriveWarrantyStart), so the field is
     * filled in; UPDATE then saves it.
     */
    const derivedStart = !filled.warranty_start_date
      ? deriveWarrantyStart(filled.last_date_of_warranty, filled.total_warranty_years)
      : "";
    if (derivedStart) filled.warranty_start_date = derivedStart;
    setForm(filled);
    setError("");
  }, [editing]);

  // S/N keeps only the characters it may hold — see fieldFormats.
  const set = (key) => (e) => {
    const value = cleanField(key, e.target.value);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setValue = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  /*
   * Warranty Start / Last Date: set the date, and work TOTAL WARRANTY out from the two — never
   * typed. A server saved before Warranty Start Date existed keeps its recorded total until a
   * start date is given.
   */
  const onWarrantyDateChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (next.warranty_start_date) {
        next.total_warranty_years = warrantyYears(next.warranty_start_date, next.last_date_of_warranty);
      }
      return next;
    });
  };

  /** Case-insensitive de-duplicating collector, sorted. */
  const collect = (values) => {
    const seen = new Set();
    const out = [];
    values.forEach((v) => {
      const trimmed = (v ?? "").trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return;
      seen.add(key);
      out.push(trimmed);
    });
    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  };

  /*
   * A master's values as options, with whatever the record already holds pinned to the front
   * when the master no longer lists it — so opening an old server cannot blank a field.
   */
  const asOptions = (list) => list.map((v) => ({ value: v, label: v }));

  const masterOptions = (rows, pick, current) => {
    const list = rows.map((r) => (pick(r) ?? "").trim()).filter(Boolean);
    const held = (current ?? "").trim();
    if (held && !list.some((v) => v.toLowerCase() === held.toLowerCase())) {
      return [held, ...list];
    }
    return list;
  };

  const processorOptions = useMemo(
    () => asOptions(masterOptions(processors, (p) => p.name, form.processor)),
    [processors, form.processor]
  );
  const ramOptions = useMemo(
    () => asOptions(masterOptions(rams, (r) => r.name, form.ram)),
    [rams, form.ram]
  );
  const hddOptions = useMemo(
    () => asOptions(masterOptions(hdds, (h) => h.name, form.hdd)),
    [hdds, form.hdd]
  );
  const osOptions = useMemo(
    () => asOptions(masterOptions(oses, (o) => o.name, form.os_name)),
    [oses, form.os_name]
  );
  const systemTypeOptions = useMemo(
    () => asOptions(masterOptions(systemTypes, (s) => s.name, form.system_type)),
    [systemTypes, form.system_type]
  );
  const ipOptions = useMemo(
    () => asOptions(masterOptions(ips, (i) => i.ip_address, form.ip_address)),
    [ips, form.ip_address]
  );

  /*
   * NAME comes from Server Master. A server has to be registered there before its details
   * can be recorded here, the same way a device has to exist in Device Master first.
   *
   * Names already on the register are listed but marked and unselectable — except while
   * editing, when the row's own name is on the register by definition and greying it out
   * would grey out the very row being changed.
   *
   * An edited row whose name is no longer in the master is pinned, so opening it does not
   * show an empty box and blank the name on save.
   */
  const serverNameOptions = useMemo(() => {
    const editingName = (editing?.server_name ?? "").trim();
    const options = masterServers
      .map((s) => (s.name ?? "").trim())
      .filter(Boolean)
      .map((name) => {
        const taken = !editing?.id && takenNames.has(name.toLowerCase());
        return { value: name, label: taken ? `${name} — already added` : name, taken };
      });

    if (editingName && !options.some((o) => o.value.toLowerCase() === editingName.toLowerCase())) {
      options.unshift({ value: editingName, label: editingName, taken: false });
    }
    return options;
  }, [masterServers, takenNames, editing]);

  /*
   * Every server in the master is already on the register — so the dropdown has entries but
   * none of them can be chosen.
   *
   * Worth saying out loud. Without it the box opens onto a list where every line is greyed
   * out and nothing explains why, which reads as a broken screen rather than as "there is
   * nothing left to add". It is also the normal state here: 18 of the 19 servers in the
   * master are already recorded.
   */
  const allServersTaken =
    serverNameOptions.length > 0 && serverNameOptions.every((o) => o.taken);

  /* Departments come one row per plant, so the same name repeats — collect de-duplicates. */
  const departmentOptions = useMemo(() => {
    const names = collect(departments.map((d) => d.department));
    const held = (form.department ?? "").trim();
    if (held && !names.some((n) => n.toLowerCase() === held.toLowerCase())) {
      return asOptions([held, ...names]);
    }
    return asOptions(names);
  }, [departments, form.department]);

  /*
   * LOCATION — from Location Master, as on ADD DEVICE: only the chosen plant's locations, none
   * until a plant is picked. A location already on the record (older servers kept free text) is
   * kept in the list, so opening one cannot blank it.
   */
  const locationOptions = useMemo(() => {
    const plantCode = (form.plant ?? "").trim();
    const forPlant = plantCode
      ? locations.filter((l) => String(l.plant_code ?? "").trim() === plantCode)
      : [];
    const names = collect(forPlant.map((l) => l.location_name)).sort((a, b) => a.localeCompare(b));
    const held = (form.location ?? "").trim();
    if (held && !names.some((n) => n.toLowerCase() === held.toLowerCase())) {
      return asOptions([held, ...names]);
    }
    return asOptions(names);
  }, [locations, form.plant, form.location]);

  /* Plant CODE is shown and saved; the name and company are hidden search text. */
  const plantOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    plants.forEach((p) => {
      const code = (p.plant_code ?? "").trim();
      if (!code || seen.has(code.toLowerCase())) return;
      seen.add(code.toLowerCase());
      options.push({
        value: code,
        label: code,
        search: [code, p.plant_name, p.company_short_name, p.company_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    });
    if (form.plant && !seen.has(form.plant.trim().toLowerCase())) {
      options.unshift({ value: form.plant, label: form.plant, search: form.plant.toLowerCase() });
    }
    return options;
  }, [plants, form.plant]);

  const disabled = readOnly;
  const targetId = editing?.id ?? null;

  const reset = () => {
    setForm(BLANK);
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;

    if (!form.server_name.trim()) return setError("Server name is required.");
    if (form.total_warranty_years !== "" && Number(form.total_warranty_years) < 0) {
      return setError("Total warranty cannot be negative.");
    }
    if (
      form.warranty_start_date &&
      form.last_date_of_warranty &&
      form.last_date_of_warranty <= form.warranty_start_date
    ) {
      return setError("Last Date Of Warranty must be after the Warranty Start Date.");
    }

    /*
     * "DO YOU WANT TO UPDATE THIS?" — as on ADD DEVICE: before an UPDATE, every field that
     * changes is listed FROM its saved value TO the new one, and nothing is saved until the user
     * says yes. Nothing changed at all: said, and not saved.
     */
    if (targetId) {
      const changes = serverChanges(editing, form);
      if (!changes.length) {
        await warnAlert("Nothing to update", "You have not changed anything on this server.");
        return;
      }
      if (!(await confirmUpdate(changes, [], `server ${form.server_name || ""}`.trim()))) return;
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        server_name: form.server_name.trim(),
        // Empty date and number boxes are null, not "" — the columns are DATE and DECIMAL.
        warranty_start_date: form.warranty_start_date || null,
        last_date_of_warranty: form.last_date_of_warranty || null,
        total_warranty_years:
          form.total_warranty_years === "" ? null : Number(form.total_warranty_years),
        // No Status on the form any more: a server is always saved active (1).
        status: 1,
        // Who is saving — the backend writes it beside every field this update changes (USER LOG).
        changed_by_code: String(user?.emp_code ?? user?.user_id ?? ""),
        changed_by_name: [user?.userFname, user?.userLname].filter(Boolean).join(" ") || user?.displayName || "",
      };

      const res = targetId
        ? await updateServerAsset({ ...body, id: targetId })
        : await saveServerAsset(body);

      if (res?.status_code !== 200) {
        await warnAlert("Could not save", res?.message || "The server could not be saved.");
        setError(res?.message || "Could not save.");
        return;
      }

      // Awaited, so the confirmation is seen before the list replaces the form.
      await savedToast(targetId ? "Server updated successfully" : "Server added successfully");
      reset();
      if (onSaved) onSaved();
    } catch {
      await warnAlert("Could not reach the server", "Check the connection and try again.");
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          {readOnly ? "View Server" : targetId ? "Edit Server" : "Add Server"}
        </h3>
        {/* BACK on the right of the title bar while viewing or editing, as on every form. */}
        {(readOnly || targetId) && onClose && (
          <button type="button" onClick={onClose} className={FORM_BACK_CLS}>
            <ChevronLeft className="h-4 w-4" />
            BACK
          </button>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-b-[3px] shadow-sm p-6"
        style={{ "--ams-disabled-bg": readOnly ? VIEW_BG : NOT_READY_BG }}
      >
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

        <Section title="Server Details">
          <div>
            <label className={LABEL_CLS}>
              Name <span className="text-red-500">*</span>
            </label>
            {/* From Server Master, not typed: a server is registered there first, then its
                details are recorded here. */}
            <Select
              options={serverNameOptions}
              value={serverNameOptions.find((o) => o.value === form.server_name) ?? null}
              onChange={(opt) =>
                setForm((f) => ({ ...f, server_name: opt ? opt.value : "" }))
              }
              isOptionDisabled={(o) => o.taken}
              isDisabled={disabled}
              isClearable
              placeholder="Search Server..."
              noOptionsMessage={() => "No server matches that"}
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={nativeSelectStyles}
            />
            {!disabled && serverNameOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No server has been added. Add one in Server Master first.
              </p>
            )}
            {!disabled && allServersTaken && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                Every server in Server Master is already added here. Add a new server in
                Server Master first, or change an existing one from List Server.
              </p>
            )}
            {(disabled || (serverNameOptions.length > 0 && !allServersTaken)) && (
              <p className="mt-1 text-[11px] text-gray-500">
                {editing?.id
                  ? "From Server Master."
                  : "From Server Master. Already-added servers are greyed out."}
              </p>
            )}
          </div>
          <TextField
            label="Type"
            value={form.server_type}
            onChange={set("server_type")}
            disabled={disabled}
            placeholder="e.g. Rack / Tower / Blade"
            maxLength={255}
          />
          <TextField
            label="S/N"
            value={form.serial_no}
            onChange={set("serial_no")}
            disabled={disabled}
            placeholder="e.g. SGH910WPLN"
            maxLength={100}
            format="serial_no"
          />
        </Section>

        <Section title="Hardware Details">
          <MasterSelect
            label="Processor Ghz"
            options={processorOptions}
            value={form.processor}
            onChange={setValue("processor")}
            disabled={disabled}
            master="Processor Master"
          />
          <MasterSelect
            label="RAM"
            options={ramOptions}
            value={form.ram}
            onChange={setValue("ram")}
            disabled={disabled}
            master="RAM Master"
          />
          <MasterSelect
            label="HDD (GB)"
            options={hddOptions}
            value={form.hdd}
            onChange={setValue("hdd")}
            disabled={disabled}
            master="HDD Master"
          />
          <MasterSelect
            label="System Type"
            options={systemTypeOptions}
            value={form.system_type}
            onChange={setValue("system_type")}
            disabled={disabled}
            master="System Type Master"
          />
        </Section>

        <Section title="Software Details">
          <MasterSelect
            label="OS"
            options={osOptions}
            value={form.os_name}
            onChange={setValue("os_name")}
            disabled={disabled}
            master="Operating System Master"
          />
          <TextField
            label="OS Service Pack"
            value={form.os_service_pack}
            onChange={set("os_service_pack")}
            disabled={disabled}
            placeholder="Service pack"
            maxLength={100}
          />
          <TextField
            label="Other Software 1"
            value={form.other_software_1}
            onChange={set("other_software_1")}
            disabled={disabled}
            placeholder="Other software"
            maxLength={255}
          />
          <TextField
            label="Other Software 2"
            value={form.other_software_2}
            onChange={set("other_software_2")}
            disabled={disabled}
            placeholder="Other software"
            maxLength={255}
          />
        </Section>

        <Section title="Server Allocation Details">
          <MasterSelect
            label="IP Address"
            options={ipOptions}
            value={form.ip_address}
            onChange={setValue("ip_address")}
            disabled={disabled}
            master="IP Address Master"
          />
          <div>
            <label className={LABEL_CLS}>Plant</label>
            <Select
              options={plantOptions}
              value={plantOptions.find((o) => o.value === form.plant) ?? null}
              // A new plant clears the location — locations belong to a plant.
              onChange={(opt) =>
                setForm((f) => {
                  const plant = opt ? opt.value : "";
                  return plant === f.plant ? f : { ...f, plant, location: "" };
                })
              }
              isDisabled={disabled}
              isClearable
              placeholder="Search Plant..."
              noOptionsMessage={() => "No plant matches that"}
              /* Matches the hidden search text, not just the visible code. */
              filterOption={(option, input) =>
                !input || (option.data.search ?? "").includes(input.trim().toLowerCase())
              }
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={nativeSelectStyles}
            />
          </div>
          <MasterSelect
            label="Dept."
            options={departmentOptions}
            value={form.department}
            onChange={setValue("department")}
            disabled={disabled}
            master="Department Master"
          />
          {/* Location Master, narrowed to the chosen plant — the same list as ADD DEVICE. */}
          <div>
            <label className={LABEL_CLS}>Location</label>
            <Select
              options={locationOptions}
              value={locationOptions.find((o) => o.value === form.location) ?? null}
              onChange={(opt) => setForm((f) => ({ ...f, location: opt ? opt.value : "" }))}
              isDisabled={disabled || !form.plant}
              isClearable
              placeholder={form.plant ? "Search Location..." : "Select Plant first"}
              noOptionsMessage={() => "No location matches that"}
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={nativeSelectStyles}
            />
            {!disabled && form.plant && locationOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No location for plant {form.plant}. Add one in Location Master first.
              </p>
            )}
          </div>
        </Section>

        <Section title="Warranty Details">
          <div>
            <label className={LABEL_CLS}>Warranty Status</label>
            <SearchableSelect
              value={form.warranty_status}
              onChange={set("warranty_status")}
              disabled={disabled}
              className={SELECT_CLS}
            >
              <option value="">Select Warranty Status</option>
              {warranties.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className={LABEL_CLS}>Warranty Start Date</label>
            <input
              type="date"
              value={form.warranty_start_date}
              onChange={onWarrantyDateChange("warranty_start_date")}
              disabled={disabled}
              className={FIELD_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Last Date Of Warranty</label>
            <input
              type="date"
              value={form.last_date_of_warranty}
              min={form.warranty_start_date || undefined}
              onChange={onWarrantyDateChange("last_date_of_warranty")}
              disabled={disabled}
              className={FIELD_CLS}
            />
          </div>

          {/* Worked out from the two dates — never typed (read-only, in the calculated blue). */}
          <div>
            <label className={LABEL_CLS}>Total Warranty (Years &amp; Months)</label>
            {/* Shown as YEARS.MONTHS ("1.10" = 1 year 10 months); the number in years is what is saved. */}
            <input
              type="text"
              value={formatWarranty(form.warranty_start_date, form.last_date_of_warranty, form.total_warranty_years)}
              readOnly
              tabIndex={-1}
              placeholder="From the two dates"
              className={FIELD_CLS}
              style={{ backgroundColor: VIEW_BG, cursor: "default" }}
            />
          </div>
        </Section>

        <Section title="Other Details">
          <TextField
            label="Description"
            value={form.description}
            onChange={set("description")}
            disabled={disabled}
            placeholder="Optional note"
            maxLength={255}
          />
          {/* No Status (Active / Inactive) on the form: every server is saved active. */}
        </Section>

        {/*
          * USER LOG, whenever an existing server is open: every field earlier updates changed,
          * before → after, who and when, newest first (ams_server_user_log).
          */}
        {editing?.id && <UserLogTable rows={changeLog} emptyText="No changes recorded for this server yet." />}

        <div className="mt-6 flex justify-center gap-2">
          {readOnly ? (
            <>
              {/*
                * EDIT opens this same server to change; UPDATE then saves it.
                *
                * Its own key, and the click stopped here: otherwise React reuses this <button>
                * as the UPDATE submit button in the same render, and the browser finishes the
                * click on it — submitting the form unchanged before anything can be edited.
                */}
              {onStartEdit && (
                <button
                  key="edit"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onStartEdit();
                  }}
                  className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f]"
                >
                  EDIT
                </button>
              )}
            </>
          ) : (
            <>
              <button
                key="submit"
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f] disabled:opacity-50"
              >
                {saving ? (targetId ? "UPDATING..." : "SUBMITTING...") : targetId ? "UPDATE" : "SUBMIT"}
              </button>
              {/* Editing: BACK is in the title bar. Adding: CLEAR empties the form. */}
              {!targetId && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50"
                >
                  CLEAR
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
}
