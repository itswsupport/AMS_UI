"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import Select from "react-select";
import {nativeSelectStyles,nativeSelectComponents,
} from "@/components/masters/nativeLikeSelect";
import { warnAlert, savedToast, confirmDiscard, confirmUpdate } from "@/lib/confirmDelete";
import { formatWarranty, deviceAge } from "@/lib/warranty";
import {
  getAssetList,
  saveAsset,
  updateAsset,
  getNextReference,
  getAssetChangeLog,
} from "@/services/assetService";
import { useAuth } from "@/context/AuthContext";
import { getUserScope } from "@/lib/userScope";
import { FIELDS_BY_DEVICE, deviceFieldRules } from "./_deviceFields";
import { getDeviceList } from "@/services/deviceService";
import { getDeviceNameList } from "@/services/deviceNameService";
import { getModelList } from "@/services/modelService";
import { getRamList } from "@/services/ramService";
import { getProcessorList } from "@/services/processorService";
import { getHddList } from "@/services/hddService";
import { getOsList } from "@/services/osService";
import { getWarrantyList } from "@/services/warrantyService";
import { getIpAddressList } from "@/services/ipAddressService";
import { getSystemTypeList } from "@/services/systemTypeService";
import {
  getAssetActionHistory,
  saveAssetActionHistory,
  updateAssetActionHistory,
} from "@/services/assetActionHistoryService";
// Departments come from db_all_master.plant_dept_mst, the same list as Department Master.
import {
  getCompanyList,
  getEmployeeList,
  getDepartmentList,
  getDeviceStatusList,
  getLocationList,
} from "@/services/masterService";


import SearchableSelect from "@/components/ui/common/SearchableSelect";
import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";
const DEVICE_STATUS_VALUES = ["In Use", "In Spare"];

/*
 * Action History's STATUS — what happened to the machine. Saved as these exact words, not a
 * number; the backend (AssetActionHistoryService.ACTION_STATUSES) refuses anything else, so the
 * two lists must match.
 */
const ACTION_STATUS_VALUES = [
  "Assigned",
  "User Left",
  "Asset Transferred",
  "Laptop Replaced",
  "User Transferred To Another Plant",
  "Asset Transfer Internally",
];

/** Why a holder gave the machine up — every status except "Assigned". */
const RELEASE_REASONS = ACTION_STATUS_VALUES.filter((s) => s !== "Assigned");

/* One colour per Action History status, used in the dropdown and in the history table. */
const ACTION_STATUS_COLORS = {
  "Assigned": "bg-green-100 text-green-800 border-green-300",
  "User Left": "bg-red-100 text-red-800 border-red-300",
  "Asset Transferred": "bg-blue-100 text-blue-800 border-blue-300",
  "Laptop Replaced": "bg-amber-100 text-amber-800 border-amber-300",
  "User Transferred To Another Plant": "bg-purple-100 text-purple-800 border-purple-300",
  "Asset Transfer Internally": "bg-teal-100 text-teal-800 border-teal-300",
};

/** An Action History status as a coloured badge; "—" when there is none. */
function ActionStatusBadge({ status }) {
  if (!status) return <span>—</span>;
  const cls = ACTION_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  );
}
// Which fields each device type has — shared with BULK UPLOAD, so the form and the Excel
// sheet always ask for the same things (see _deviceFields.js).

const BLANK = {
  device_id: "",
  name: "",
  po_no: "",
  asset_code: "",
  asset_sn: "",
  service_tag: "",
  exp_service_code: "",
  device_status: "",
  department: "",
  location: "",
  plant: "",
  employee_code: "",
  employee_name: "",
  ip_address: "",
  model: "",
  processor: "",
  ram: "",
  rom: "",
  hdd: "",
  external_processor: "",
  external_ram: "",
  external_rom: "",
  external_hdd: "",
  system_type: "",
  os: "",
  os_service_pack: "",
  ms_office: "",
  software_1: "",
  software_2: "",
  charger: "",
  keyboard: "",
  mouse: "",
  warranty_status: "",
  warranty_start_date: "",
  last_date_of_warranty: "",
  total_warranty_years: "",
  classification: "",
  description: "",
  status: 1,
};

/** What each field is called on the form — for the "update FROM → TO" confirmation. */
const FIELD_LABELS = {
  device_id: "Device Type",
  name: "Device Name",
  po_no: "PO No.",
  asset_code: "Asset Code",
  asset_sn: "Asset S/N",
  service_tag: "Service Tag",
  exp_service_code: "Exp. Service Code",
  // The form's STATUS (In Use / In Spare). The record's own active flag is not on the form.
  device_status: "Status",
  department: "Department",
  location: "Location",
  plant: "Plant",
  ip_address: "IP Address",
  model: "Model",
  processor: "Processor",
  ram: "RAM",
  rom: "ROM",
  hdd: "HDD",
  external_processor: "External Processor",
  external_ram: "External RAM",
  external_rom: "External ROM",
  external_hdd: "External HDD",
  system_type: "System Type",
  os: "Operating System",
  os_service_pack: "OS Service Pack",
  ms_office: "MS Office",
  software_1: "Software 1",
  software_2: "Software 2",
  charger: "Charger Adaptor",
  keyboard: "Keyboard",
  mouse: "Mouse",
  warranty_status: "Warranty Status",
  warranty_start_date: "Warranty Start Date",
  last_date_of_warranty: "Warranty End Date",
  total_warranty_years: "Total Warranty (In Years)",
  classification: "Classification",
  description: "Description",
};

/*
 * ACTION HISTORY works like CHECK-IN / CHECK-OUT in asset-management tools:
 *
 *   RELEASE — closes the CURRENT holder's row: their end date, the REASON they gave it up
 *             (User Left, Asset Transferred, …). The reason belongs on THEIR row,
 *             because it describes why THEY no longer have it.
 *   ASSIGN  — opens a NEW row for the next holder, with status "Assigned" set automatically.
 *
 * One employee per row, always.
 */
const BLANK_RELEASE = { end_date: "", action_status: "" };
const BLANK_ASSIGN = { assigned_emp_code: "", assigned_emp_name: "", start_date: "" };

const LABEL_CLS = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";

/*
 * Every box 38px high and full width — the same as the dropdowns (nativeLikeSelect, 38px), so
 * text, number, date and dropdown fields line up in one even grid in every section.
 */
const FIELD_CLS =
  "w-full h-[38px] border rounded px-3 py-2 text-sm disabled:bg-[var(--ams-disabled-bg,#f3f4f6)]";

const SELECT_CLS = FIELD_CLS + " ams-select";

const VIEW_BG = "#E6F2FF";

/**
 * Years of warranty from a start and an end date (yyyy-mm-dd), counted in whole months and
 * rounded to two decimals — 3, 1.5, 2.25. "" when either date is missing or End is not after
 * Start. Cover is inclusive of the end day, so 01/10/2026 → 30/09/2029 is exactly 3 years.
 */
const warrantyYears = (start, end) => {
  if (!start || !end || end <= start) return "";
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  // The day after the end date, so a period ending the day before an anniversary counts in full.
  const after = new Date(ey, em - 1, ed + 1);
  let months = (after.getFullYear() - sy) * 12 + (after.getMonth() + 1 - sm);
  if (after.getDate() < sd) months -= 1;
  if (months <= 0) return "";
  return String(Math.round((months / 12) * 100) / 100);
};

/** BACK in a form's title bar: white on the bar's blue, right-hand side. */
const FORM_BACK_CLS =
  "flex items-center gap-1 rounded-[3px] bg-white px-3 py-1 text-[11px] font-semibold uppercase text-[#3482AE] hover:bg-white/90";

const NOT_READY_BG = "#f3f4f6";


/**
 * A titled block of fields.
 *
 * @param cols how many fields sit on one row at desktop width. Four throughout this form —
 *             it is a long one, and four across takes a section from three rows to two.
 *
 * The grid class is written out in full rather than assembled from `cols`. Tailwind scans
 * the source for complete class names, so one built at runtime is never emitted into the
 * stylesheet and the grid would silently fall back to a single column.
 */
function Section({ title, children, cols = 4, locked = false }) {
  const grid = cols === 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  return (
    // locked: its fields are read-only while editing, so they take the read-only blue
    // (#E6F2FF) through the same CSS variable every field's disabled background reads.
    <div
      className="mt-6 first:mt-0"
      style={locked ? { "--ams-disabled-bg": VIEW_BG } : undefined}
    >
      {/* The heading keeps its rule to itself. Action History's ADD button sits BELOW the
          rule on a row of its own, not up here beside the title. */}
      <div className="mb-3 border-b pb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</p>
      </div>
      <div className={`grid grid-cols-1 ${grid} gap-4`}>{children}</div>
    </div>
  );
}

/** The red star after a mandatory field's label. */
const Req = () => <span className="text-red-500">*</span>;

/**
 * The red "… is required" line under a field left empty on SUBMIT. Renders nothing when there
 * is no message. data-field-error is what SUBMIT scrolls to.
 */
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p data-field-error className="mt-1 text-[11px] font-semibold text-red-600">
      {msg}
    </p>
  );
}

/** A text box's border turns red while it has an error. */
const fieldCls = (error) => (error ? `${FIELD_CLS} border-red-500` : FIELD_CLS);

/** The same red border for a react-select. */
const selectStyles = (error) =>
  error
    ? {
        ...nativeSelectStyles,
        control: (base, state) => ({
          ...nativeSelectStyles.control(base, state),
          borderColor: "#ef4444",
          "&:hover": { borderColor: "#ef4444" },
        }),
      }
    : nativeSelectStyles;

/** A plain text box. */
function TextField({
  label, value, onChange, disabled, placeholder, maxLength = 150, hint, required = false, error,
}) {
  return (
    <div>
      <label className={LABEL_CLS}>
        {label} {required && <Req />}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={fieldCls(error)}
      />
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
      <FieldError msg={error} />
    </div>
  );
}
function MasterSelect({
  label, options, value, onChange, disabled, master, placeholder, required = false, error,
  // Optional px height for the open list (default: the shared 168px); it scrolls inside.
  maxMenuHeight,
}) {
  const base = selectStyles(error);
  const styles = maxMenuHeight
    ? {
        ...base,
        menuList: (b, s) => ({ ...base.menuList(b, s), maxHeight: `${maxMenuHeight}px` }),
      }
    : base;
  return (
    <div>
      <label className={LABEL_CLS}>
        {label} {required && <Req />}
      </label>
      <Select
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(opt) => onChange(opt ? opt.value : "")}
        isDisabled={disabled}
        isClearable
        placeholder={placeholder ?? `Search ${label}...`}
        noOptionsMessage={() => `No ${label.toLowerCase()} matches that`}
        menuPlacement="bottom"
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        components={nativeSelectComponents}
        styles={styles}
        maxMenuHeight={maxMenuHeight ?? 300}
      />
      {!disabled && options.length === 0 && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600">
          No {label.toLowerCase()} has been added. Add one in {master} first.
        </p>
      )}
      <FieldError msg={error} />
    </div>
  );
}



/**
 * @param barColor the card's colour, so the bar reads as attached to it
 * @param onSaved  called after a successful save, so the page can show the list
 * @param editing  a row handed over by the list view, or null to add
 * @param prefill  when adding: { device_id, model, name } to start from — DEVICE STATUS sends
 *                 an OPEN device-name here so it can be registered and assigned
 */
export default function AddDevice({
  barColor,
  onSaved,
  editing = null,
  prefill = null,
  readOnly = false,
  onClose,
  onStartEdit,
}) {
  // One object rather than thirty useStates — the fields are all the same kind of thing, and
  // thirty setters would be thirty chances to update the wrong one.
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  /*
   * Whether SUBMIT has been pressed. The red "is required" messages under each field appear
   * only after that — a fresh form covered in red before anything is typed reads as a
   * telling-off.
   */
  const [attempted, setAttempted] = useState(false);

  /*
   * The machines already recorded for the chosen device type.
   *
   * This is what the Model and Device Name dropdowns are built from — the fleet itself, not
   * only the masters. Reloaded whenever the device type changes, since the two types are
   * separate tables.
   */
  const [assets, setAssets] = useState([]);


  // Master lists feeding the dropdowns and suggestion lists.
  const [devices, setDevices] = useState([]);
  const [deviceNames, setDeviceNames] = useState([]);
  const [models, setModels] = useState([]);
  const [rams, setRams] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [hdds, setHdds] = useState([]);
  const [oses, setOses] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [ips, setIps] = useState([]);
  const [systemTypes, setSystemTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  // Device Status choices from /devicestatus/list; the built-in pair until it answers.
  const [deviceStatuses, setDeviceStatuses] = useState(DEVICE_STATUS_VALUES);
  const [employees, setEmployees] = useState([]);

  /*
   * The ACTION section: one history entry being written, kept apart from `form`.
   *
   * Separate because it goes to a different table through a different endpoint, and because
   * it is a log entry rather than a property of the machine — mixing it into `form` would
   * mean every ordinary edit carried a half-filled handover along with it.
   */
  // Closing the current holder's row, and opening the next holder's. See BLANK_RELEASE.
  const [release, setRelease] = useState(BLANK_RELEASE);
  const [assign, setAssign] = useState(BLANK_ASSIGN);

  /** The entries already recorded against this machine. */
  const [history, setHistory] = useState([]);

  /** What earlier edits changed on this machine — the CHANGE HISTORY table. */
  const [changeLog, setChangeLog] = useState([]);

  // Who is saving: recorded against every field an edit changes.
  const { user } = useAuth();

  /*
   * What this user may add (Reporting Person). A USER is offered only their device types, and
   * Plant is fixed to their plant when they have one, or limited to theirs when they have
   * several — the backend refuses anything else on save.
   */
  const scope = getUserScope(user);
  const plantFixed = scope.limited && Boolean(scope.plant);
  const changedBy = {
    changed_by_code: user?.emp_code ?? user?.user_id ?? "",
    changed_by_name:
      [user?.userFname, user?.userLname].filter(Boolean).join(" ") ||
      user?.displayName ||
      user?.name ||
      "",
  };

  /*
   * The id of a machine this form created, for as long as the form stays open on it.
   *
   * SAVE can write a brand-new device so that a handover typed beside it has something to
   * point at. From that moment the form is sitting on a real row, and every later press has
   * to update THAT row — without this the second press would insert a second machine with the
   * same name. Cleared by reset and whenever the form is handed a different row.
   */
  const [justSavedId, setJustSavedId] = useState(null);

  const [plants, setPlants] = useState([]);
  // Location Master rows: { plant_code, location_name, … }.
  const [locations, setLocations] = useState([]);


  useEffect(() => {
    let cancelled = false;

    // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
    const unwrap = (res) =>
      res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

    // Active only, everywhere. Each master screen needs its inactive rows visible to switch
    // them back on, so /list returns them and the filtering belongs to whoever is offering a
    // choice — a value switched off is deliberately out of circulation.
    const active = (list) => (list ?? []).filter((r) => r.status === 1);

    const fail = () => {
      if (!cancelled) setLoadError("Some lists could not be loaded. You can still type values.");
    };
    const take = (setter, transform) => (res) => {
      if (!cancelled) setter(transform(unwrap(res)));
    };

    getDeviceList().then(take(setDevices, active)).catch(fail);
    getDeviceNameList().then(take(setDeviceNames, active)).catch(fail);
    getModelList().then(take(setModels, active)).catch(fail);
    getRamList().then(take(setRams, active)).catch(fail);
    getProcessorList().then(take(setProcessors, active)).catch(fail);
    getHddList().then(take(setHdds, active)).catch(fail);
    getOsList().then(take(setOses, active)).catch(fail);
    getWarrantyList().then(take(setWarranties, active)).catch(fail);
    getIpAddressList().then(take(setIps, active)).catch(fail);
    getSystemTypeList().then(take(setSystemTypes, active)).catch(fail);
    // db_all_master.plant_dept_mst — read-only, no status column to filter on.
    getDepartmentList().then(take(setDepartments, (l) => l ?? [])).catch(fail);
    // Falls back to the built-in pair rather than an empty dropdown if the call fails.
    getDeviceStatusList()
      .then(take(setDeviceStatuses, (l) => (l?.length ? l : DEVICE_STATUS_VALUES)))
      .catch(() => {});
    // Read-only reference data from db_all_master, already filtered to active employees.
    getEmployeeList().then(take(setEmployees, (l) => l ?? [])).catch(fail);
    // Company rows are read-only reference data with no status column of their own.
    getCompanyList().then(take(setPlants, (l) => l ?? [])).catch(fail);
    getLocationList().then(take(setLocations, (l) => l ?? [])).catch(fail);

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * The fleet for the chosen device type, reloaded whenever that changes.
   *
   * Fetched in full rather than asking the server for distinct models: the two lists are
   * derived from these rows, and picking a known name also fills the rest of the form from
   * its record — which needs the whole row, not just its name.
   */
  useEffect(() => {
    if (!form.device_id) {
      setAssets([]);
      return undefined;
    }
    let cancelled = false;
    // The whole catalogue, workbook rows included — these feed the dropdowns.
    getAssetList(form.device_id, true)
      .then((res) => {
        if (cancelled) return;
        setAssets(
          res?.status_code === 200 && Array.isArray(res.response) ? res.response : []
        );
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.device_id]);

  /*
   * The values the form OPENED with — what BACK compares against to know whether anything was
   * changed and not saved (see onBack).
   */
  const startedWith = useRef(BLANK);

  // Fill the form when the list view hands over a row to edit.
  useEffect(() => {
    // A different row, or none: the machine SAVE wrote is no longer the one on screen.
    setJustSavedId(null);
    if (!editing) {
      // Adding: blank, or started from DEVICE STATUS's chosen type, model and device name.
      // A NEW device starts as In Use (its STATUS); an existing one keeps what it has.
      const initial = { ...BLANK, device_status: "In Use", ...(prefill ?? {}) };
      startedWith.current = initial;
      setForm(initial);
      return;
    }
    const filledForm = { ...BLANK };
    Object.keys(BLANK).forEach((k) => {
      if (editing[k] !== undefined && editing[k] !== null) filledForm[k] = editing[k];
    });
    startedWith.current = filledForm;
    setForm(filledForm);
    setError("");
  }, [editing, prefill]);


  useEffect(() => {
    const assetId = editing?.id;
    setRelease(BLANK_RELEASE);
    setAssign(BLANK_ASSIGN);
    if (!assetId) {
      setHistory([]);
      setChangeLog([]);
      return undefined;
    }

    // The current holder is worked out from this history — see currentHolder.

    let cancelled = false;
    getAssetActionHistory(assetId)
      .then((res) => {
        if (cancelled) return;
        setHistory(
          res?.status_code === 200 && Array.isArray(res.response) ? res.response : []
        );
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    getAssetChangeLog(assetId)
      .then((res) => {
        if (cancelled) return;
        setChangeLog(
          res?.status_code === 200 && Array.isArray(res.response) ? res.response : []
        );
      })
      .catch(() => {
        if (!cancelled) setChangeLog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing?.id]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  /*
   * Warranty Start / End Date: set the date, and work TOTAL WARRANTY (IN YEARS) out from the
   * two — never typed. Whole months between them, as years to two decimals: 01/10/2026 to
   * 30/09/2029 is 3, to 31/03/2028 is 1.5. Blank until both dates are there and End is after
   * Start.
   */
  const onWarrantyDateChange = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      next.total_warranty_years = warrantyYears(next.warranty_start_date, next.last_date_of_warranty);
      return next;
    });
  };

  const setReleaseField = (key) => (e) => {
    const value = e.target.value;
    setRelease((r) => ({ ...r, [key]: value }));
  };

  const setAssignField = (key) => (e) => {
    const value = e.target.value;
    setAssign((a) => ({ ...a, [key]: value }));
  };

  const onAssignEmployeeChange = (code) => {
    const picked = employees.find((e) => String(e.emp_code) === code);
    setAssign((a) => ({
      ...a,
      assigned_emp_code: code,
      assigned_emp_name: code ? picked?.emp_name ?? "" : "",
    }));
  };

  /*
   * The release date is also the earliest the next holder can start, so it is copied into
   * Assign's Start Date while that is still empty — one date typed, not two.
   */
  const onReleaseDateChange = (e) => {
    const value = e.target.value;
    setRelease((r) => ({ ...r, end_date: value }));
    setAssign((a) => (a.start_date ? a : { ...a, start_date: value }));
  };

  /*
   * Changing the device type clears the two fields it narrows. A model picked for a desktop
   * means nothing once the type is a laptop, and the names listed under it belong to that
   * model, so both have to go.
   */
  const onDeviceTypeChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, device_id: value, model: "", name: "" }));
  };

  /*
   * Every active device in the master, unfiltered.
   *
   * `devices` is already the active ones — the fetch above filters status === 1, because an
   * inactive device is deliberately out of circulation. Beyond that nothing is held back:
   * whatever the admin adds in Device Master is offered here.
   */
  // …except for a USER, who is offered only the device types set for them in Reporting Person.
  const typeOptions = devices.filter((d) => scope.allowsDevice(d.id));

  // What the form already stores, as a number for comparing against master rows.
  const chosenDeviceId = form.device_id ? Number(form.device_id) : null;

  /** The chosen device's name, for the messages and for the laptop-only charger field. */
  const deviceName = useMemo(() => {
    const match = devices.find((d) => String(d.id) === String(form.device_id));
    return match ? match.device_name ?? "" : "";
  }, [devices, form.device_id]);

  /*
   * The reference number this machine will get, e.g. PR26SOU646001, asked of the server
   * once a type and name are chosen (GET /asset/nextreference). A preview only: the server
   * assigns the real one on save, so a clash with someone saving at the same time is impossible.
   */
  const [nextReference, setNextReference] = useState("");
  useEffect(() => {
    if (editing?.reference_no || !form.device_id || !form.name) {
      setNextReference("");
      return undefined;
    }
    let cancelled = false;
    getNextReference(form.device_id, form.name)
      .then((res) => {
        if (!cancelled) setNextReference(res?.status_code === 200 ? res.response ?? "" : "");
      })
      .catch(() => {
        if (!cancelled) setNextReference("");
      });
    return () => {
      cancelled = true;
    };
  }, [editing?.reference_no, form.device_id, form.name]);

  /**
   * Case-insensitive de-duplicating collector, so a value written two ways on the sheet is
   * offered once. Keeps the first spelling it meets.
   */
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

 
  const modelOptions = useMemo(
    () =>
      collect([
        ...models
          .filter((m) => String(m.device_id) === String(chosenDeviceId))
          .map((m) => m.model_name),
        editing?.model,
      ]),
    [models, chosenDeviceId, editing]
  );

  const nameOptions = useMemo(() => {
    if (!form.model) return [];
    const key = form.model.trim().toLowerCase();

    // Device Name Master rows sit under a model_id, so the chosen model NAME has to be
    // resolved back to its master row before the names can be matched to it.
    const masterModel = models.find(
      (m) =>
        String(m.device_id) === String(chosenDeviceId) &&
        (m.model_name ?? "").trim().toLowerCase() === key
    );

    return collect([
      ...(masterModel
        ? deviceNames
            .filter(
              (n) =>
                String(n.device_id) === String(chosenDeviceId) &&
                String(n.model_id) === String(masterModel.id)
            )
            .map((n) => n.device_name)
        : []),
      editing?.name,
    ]);
  }, [deviceNames, models, chosenDeviceId, form.model, editing]);


  const onModelChange = (e) => {
    const picked = e.target.value;
    setForm((f) => ({ ...f, model: picked, name: "" }));
  };


  const onNameChange = (e) => {
    const picked = e.target.value;
    setForm((f) => ({ ...f, name: picked }));
  };


  const takenNames = useMemo(
    () =>
      new Set(
        assets
          .filter((a) => (a.source ?? "").toUpperCase() === "FORM")
          .map((a) => (a.name ?? "").trim().toLowerCase())
      ),
    [assets]
  );

  /*
   * The plant list from db_all_master.company_mst, as react-select options.
   *
   * SEARCHABLE, which is why it is react-select rather than a plain <select>: eighteen plants
   * across several companies is more than is comfortable to scan, and typing beats scrolling.
   *
   * The label carries the company short name as well as the plant, so typing "REPL" finds
   * every Rucha unit — react-select matches on the label text. The VALUE stays plant_name on
   * its own, because that is exactly what the asset row stores.
   *
   * A value already on the record that is no longer in the master is pinned, so opening an
   * old machine does not show an empty box and blank its plant on save.
   */
  /** The company the chosen plant belongs to, for the read-only COMPANY field beside Plant. */
  const plantCompany = useMemo(() => {
    const code = (form.plant ?? "").trim().toLowerCase();
    if (!code) return "";
    const p = plants.find((x) => (x.plant_code ?? "").trim().toLowerCase() === code);
    return p ? p.company_name || p.company_short_name || "" : "";
  }, [plants, form.plant]);

  const plantOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    plants.forEach((p) => {
      const code = (p.plant_code ?? "").trim();
      if (!code || seen.has(code.toLowerCase())) return;
      seen.add(code.toLowerCase());
      /*
       * THE PLANT CODE is what is shown and what is saved — 1003, 3001 — not the long name.
       *
       * `search` is the plant's full name and company, carried on the option but never
       * displayed. filterOption below matches against it, so typing "burlyfield" or "unit-3"
       * still finds the right code. Without that the box would be eighteen bare numbers and
       * the only way to find one would be to already know it.
       */
      options.push({
        value: code,
        label: code,
        search: [code, p.plant_name, p.company_short_name, p.company_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    });
    // A code already on the record but no longer in the master, so an edit cannot blank it.
    if (form.plant && !seen.has(form.plant.trim().toLowerCase())) {
      options.unshift({
        value: form.plant,
        label: form.plant,
        search: form.plant.toLowerCase(),
      });
    }
    // A USER with one plant has it fixed, so theirs is the only one offered.
    if (plantFixed) {
      return options.filter((o) => String(o.value).trim() === scope.plant);
    }
    // A USER with several plants picks one of THEIRS (the record's own value is kept, too).
    if (scope.limited && scope.plants.length > 1) {
      return options.filter((o) => scope.allowsPlant(o.value) || o.value === form.plant);
    }
    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, form.plant, plantFixed, scope.plant, scope.plants.join(",")]);

  /*
   * A USER's plant is filled in for them — on a new form, after CLEAR, and when a device is
   * opened from the list — and then locked (see the Plant field). Department and Location
   * follow it as usual.
   */
  useEffect(() => {
    /*
     * Only for a NEW device. An existing device keeps the plant it is in — never silently moved
     * to the user's plant when it is opened (a plant change happens only through a transfer).
     */
    if (!plantFixed || readOnly || editing?.id) return;
    setForm((f) => (f.plant === scope.plant ? f : { ...f, plant: scope.plant }));
  }, [plantFixed, scope.plant, form.plant, readOnly, editing?.id]);


  const masterOptions = (rows, pick, current) => {
    const list = rows.map((r) => (pick(r) ?? "").trim()).filter(Boolean);
    const held = (current ?? "").trim();
    if (held && !list.some((v) => v.toLowerCase() === held.toLowerCase())) {
      return [held, ...list];
    }
    return list;
  };

 
  
  const asOptions = (list) => list.map((v) => ({ value: v, label: v }));

  /*
   * LOCATION — from Location Master (db_all_master.location_master).
   *
   * Narrowed to the chosen plant: form.plant holds the plant code, the same code the location
   * master files each location under. Nothing is offered until a plant is picked (Plant ->
   * Department -> Location is a tree, filled top down). A location already
   * on the record is kept in the list, so opening an older machine cannot blank it.
   */
  const locationSelectOptions = useMemo(() => {
    const plantCode = (form.plant ?? "").trim();
    const forPlant = plantCode
      ? locations.filter((l) => String(l.plant_code ?? "").trim() === plantCode)
      : [];
    const names = collect(forPlant.map((l) => l.location_name)).sort((a, b) =>
      a.localeCompare(b)
    );
    const held = (form.location ?? "").trim();
    if (held && !names.some((n) => n.toLowerCase() === held.toLowerCase())) {
      return asOptions([held, ...names]);
    }
    return asOptions(names);
  }, [locations, form.plant, form.location]);

  const ipSelectOptions = useMemo(
    () => asOptions(masterOptions(ips, (i) => i.ip_address, form.ip_address)),
    [ips, form.ip_address]
  );

  const processorSelectOptions = useMemo(
    () => asOptions(masterOptions(processors, (p) => p.name, form.processor)),
    [processors, form.processor]
  );

  const ramSelectOptions = useMemo(
    () => asOptions(masterOptions(rams, (r) => r.name, form.ram)),
    [rams, form.ram]
  );

  const hddSelectOptions = useMemo(
    () => asOptions(masterOptions(hdds, (h) => h.name, form.hdd)),
    [hdds, form.hdd]
  );

  const systemTypeSelectOptions = useMemo(
    () => asOptions(masterOptions(systemTypes, (s) => s.name, form.system_type)),
    [systemTypes, form.system_type]
  );

  const osSelectOptions = useMemo(
    () => asOptions(masterOptions(oses, (o) => o.name, form.os)),
    [oses, form.os]
  );


  const employeeSelectOptions = useMemo(() => {
    
    const options = employees.map((e) => ({
      value: String(e.emp_code),
      label: e.emp_name ? `${e.emp_name} (${e.emp_code})` : String(e.emp_code),
    }));
    const held = (form.employee_code ?? "").trim();
    if (held && !options.some((o) => o.value === held)) {
      const known = (form.employee_name ?? "").trim();
      options.unshift({ value: held, label: known ? `${known} (${held})` : held });
    }
    return options;
  }, [employees, form.employee_code, form.employee_name]);

  
  const deviceStatusOptions = useMemo(() => {
    const held = (form.device_status ?? "").trim();
    // A value saved before In Use / In Spare (e.g. "Active") is still shown, so it is not lost.
    if (held && !deviceStatuses.some((v) => v.toLowerCase() === held.toLowerCase())) {
      return [held, ...deviceStatuses];
    }
    return deviceStatuses;
  }, [deviceStatuses, form.device_status]);

  /*
   * DEPARTMENT — the chosen plant's departments only. plant_dept_mst files every department
   * under a plant_code, the same code form.plant holds, so Plant -> Department reads as a tree.
   * Nothing is offered until a plant is picked; a department already on the record is kept.
   */
  const departmentSelectOptions = useMemo(() => {
    const plantCode = (form.plant ?? "").trim();
    const forPlant = plantCode
      ? departments.filter((d) => String(d.plant_code ?? "").trim() === plantCode)
      : [];
    const names = collect(forPlant.map((d) => d.department)).sort((a, b) =>
      a.localeCompare(b)
    );
    const held = (form.department ?? "").trim();
    if (held && !names.some((n) => n.toLowerCase() === held.toLowerCase())) {
      return asOptions([held, ...names]);
    }
    return asOptions(names);
  }, [departments, form.plant, form.department]);

  /*
   * Every field is locked when the row was opened to read.
   *
   * One flag rather than a readOnly prop on thirty inputs: they all already honour `disabled`
   * for the "no device chosen yet" case, so folding readOnly into it locks the lot and
   * cannot miss one. The greyed background that comes with it is also the right signal.
   */
  const disabled = !form.device_id || readOnly;

  /*
   * EDITING keeps DEVICE DETAILS, HARDWARE DETAILS and the OPERATING SYSTEM locked: what the
   * machine IS (type, model, name, codes, serials, processor, memory, disk, OS) does not change
   * once it is registered. They show in the read-only blue, as when viewing; everything else
   * stays open.
   */
  const specLocked = Boolean(editing?.id) && !readOnly;
  const specDisabled = disabled || specLocked;

  /*
   * OPENED FROM AN OPEN DEVICE (✏ on Open Devices): the device is already chosen — its type,
   * model and name come from Device Name Master — so that first row is locked too, in the same
   * read-only blue. Everything else is filled in as for any new device.
   */
  const identityLocked = Boolean(prefill) && !editing?.id;

  /*
   * ALLOCATION DETAILS (Plant, Department, Location, IP Address, Device Status) are locked
   * while editing too — where a device sits only changes when it MOVES. So they open only once
   * the current holder is being released with the reason "User Transferred To Another Plant".
   */
  const PLANT_TRANSFER = "User Transferred To Another Plant";
  /*
   * A device saved with NO plant yet (e.g. a tablet saved before its form had Allocation) is
   * not "moving" — it was never placed — so its Allocation stays open to fill in once.
   */
  const neverPlaced = Boolean(editing?.id) && !String(editing?.plant ?? "").trim();
  const allocLocked = specLocked && !neverPlaced && release.action_status !== PLANT_TRANSFER;
  const allocDisabled = disabled || allocLocked;

  /*
   * WHO HAS THE MACHINE NOW — the newest history row with an employee and no end date.
   * Null for a new device, or one whose last holder has been released (it is in stock).
   */
  const currentHolder = useMemo(() => {
    const open = history.filter(
      (h) => (h.assigned_emp_code || h.assigned_emp_name) && !h.end_date
    );
    if (!open.length) return null;
    return open.sort(
      (a, b) =>
        String(b.start_date ?? "").localeCompare(String(a.start_date ?? "")) ||
        (b.id ?? 0) - (a.id ?? 0)
    )[0];
  }, [history]);

  const filled = (obj) => Object.values(obj).some((v) => String(v ?? "").trim() !== "");

  /*
   * The history as ONE ROW PER EMPLOYEE — each entry is one person and their period.
   *
   * Sorted by start date, newest first, so the current holder is at the top; two starts on
   * the same day put the one recorded later first, and entries with no date fall to the bottom.
   * End Date "Present" means they still hold it.
   */
  const timeline = useMemo(() => {
    const rows = history
      .filter((h) => h.assigned_emp_code || h.assigned_emp_name)
      .map((h) => ({
        entryId: h.id,
        role: "assigned",
        code: h.assigned_emp_code ?? "",
        name: h.assigned_emp_name ?? "",
        start: h.start_date ?? "",
        end: h.end_date ?? "",
        actionStatus: h.action_status ?? "",
        recorded: h.create_date ?? "",
      }));

    return rows.sort((a, b) => {
      if (!a.start) return 1;
      if (!b.start) return -1;
      return b.start.localeCompare(a.start) || (b.entryId ?? 0) - (a.entryId ?? 0);
    });
  }, [history]);

  // The workbook records a charger for laptops only; every other device has none to track.
  const isLaptop = deviceName.toLowerCase() === "laptop";
  // Keyboard and Mouse are recorded for desktops only (the Desktop sheet).
  const isDesktop = deviceName.toLowerCase() === "desktop";

  /*
   * Whether a field belongs on the form for the device type that is chosen.
   *
   * A device type with no entry in FIELDS_BY_DEVICE shows everything, which is how desktop
   * and laptop get the full form without being listed. See that map for the reasoning.
   */
  const shows = (field) => {
    const allowed = FIELDS_BY_DEVICE[deviceName.toLowerCase()];
    return !allowed || allowed.has(field);
  };

  /** A section is worth a heading only when something inside it is visible. */
  const sectionShows = (...fields) => fields.some((f) => shows(f));

  /*
   * Anything changed and not saved? Every form field against what the form opened with, and
   * an Action History entry started (assign / release). The plant a USER's form fills in by
   * itself is not a change of theirs, so it does not count.
   */
  const hasUnsavedChanges = () => {
    if (readOnly) return false;
    const base = startedWith.current ?? BLANK;
    const changed = Object.keys(BLANK).some(
      // The plant filled in by itself on a NEW device is not a change; on an existing one it is.
      (k) => !(k === "plant" && plantFixed && !editing?.id) && String(form[k] ?? "") !== String(base[k] ?? "")
    );
    return (
      changed ||
      JSON.stringify(assign) !== JSON.stringify(BLANK_ASSIGN) ||
      JSON.stringify(release) !== JSON.stringify(BLANK_RELEASE)
    );
  };

  /** BACK: asks first when there are changes not saved; otherwise straight back to the list. */
  const onBack = async () => {
    if (hasUnsavedChanges() && !(await confirmDiscard())) return;
    onClose?.();
  };

  const reset = () => {
    // Opened from an Open device, the locked type / model / name stay — CLEAR empties the rest.
    setForm(
      prefill && !editing?.id
        ? { ...BLANK, device_status: "In Use", ...prefill }
        : { ...BLANK, device_status: editing?.id ? "" : "In Use" }
    );
    // Action History too: CLEAR means the whole form, not the top of it.
    setRelease(BLANK_RELEASE);
    setAssign(BLANK_ASSIGN);
    // An emptied form is a new machine again, not the one SAVE just wrote.
    setJustSavedId(null);
    setHistory([]);
    setError("");
    setAttempted(false);
  };

  
  const targetId = editing?.id ?? justSavedId;

  /*
   * What this SUBMIT will write.
   *
   * RELEASING: the current holder is being closed — because Release was filled in, or because
   * someone new is being assigned (a machine cannot be with two people at once).
   * ASSIGNING: a new holder. Always on a NEW device, so every machine starts with its first
   * holder; when editing, only once something in Assign is filled in, so fixing a serial
   * number does not force a made-up handover into the log.
   */
  /*
   * A PRINTER IS GIVEN TO A DEPARTMENT, NOT A PERSON — its Department / Location in
   * Allocation Details says where it is. So it has no Action History: the section is hidden
   * and nothing in it is required or written.
   */
  const hasActionHistory = deviceName.toLowerCase() !== "printer";

  const releasing =
    hasActionHistory &&
    Boolean(currentHolder) &&
    (filled(release) || Boolean(assign.assigned_emp_code));
  /*
   * ASSIGN IS OPTIONAL — a device can be added (or saved) with nobody assigned yet. It becomes
   * required only once something in it is filled in, or when the current holder is released
   * (no release on its own: the device then goes straight to someone new).
   */
  const assigning = hasActionHistory && (filled(assign) || releasing);

  /*
   * EVERY FIELD IS MANDATORY EXCEPT CLASSIFICATION — but only the ones on screen. A printer
   * has no processor or OS to give, so a field hidden for the chosen device type is skipped.
   * Listed in form order, so the message names the first empty box the user will come to.
   */
  const hardwareShown = sectionShows("processor", "ram", "rom", "hdd", "system_type");
  const softwareShown = sectionShows(
    "os", "os_service_pack", "ms_office", "software_1", "software_2", "charger"
  );
  const requiredFields = [
    ["asset_code", "Asset Code", shows("asset_code")],
    ["asset_sn", "Asset S/N", shows("asset_sn")],
    ["service_tag", "Service Tag", shows("service_tag")],
    ["po_no", "PO No.", shows("po_no")],
    ["processor", "Processor", hardwareShown],
    ["ram", "RAM", hardwareShown],
    ["rom", "ROM", hardwareShown && shows("rom")],
    ["hdd", "HDD", hardwareShown && shows("hdd")],
    ["system_type", "System Type", hardwareShown],
    ["os", "Operating System", softwareShown],
    ["os_service_pack", "OS Service Pack", softwareShown],
    ["ms_office", "MS Office", softwareShown],
    ["software_1", "Software 1", softwareShown],
    ["software_2", "Software 2", softwareShown],
    ["charger", "Charger Adaptor", softwareShown && isLaptop],
    ["plant", "Plant", shows("plant")],
    ["department", "Department", shows("department")],
    ["location", "Location", shows("location")],
    ["ip_address", "IP Address", shows("ip_address")],
    ["device_status", "Status", shows("device_status")],
    ["warranty_status", "Warranty Status", true],
    ["warranty_start_date", "Warranty Start Date", true],
    ["last_date_of_warranty", "Warranty End Date", true],
    ["total_warranty_years", "Total Warranty (In Years)", true],
    ["description", "Description", shows("description")],
  ];

  /*
   * EVERY PROBLEM ON THE FORM AT ONCE, keyed by field — shown in red under each field, not
   * one at a time at the top, so a single SUBMIT tells the user everything left to fill in.
   * Action History keys are "release.<field>" and "assign.<field>". Insertion order is form
   * order, so the first key is the first field the user will come to.
   */
  const collectErrors = () => {
    const errs = {};
    if (!form.device_id) errs.device_id = "Device Type is required.";
    if (!form.model) errs.model = "Model is required.";
    if (!form.name.trim()) errs.name = "Device Name is required.";
    // Fields depend on the device type, so they are only checked once one is chosen.
    if (form.device_id) {
      requiredFields.forEach(([key, label, visible]) => {
        if (visible && String(form[key] ?? "").trim() === "") errs[key] = `${label} is required.`;
      });
      if (
        !errs.last_date_of_warranty &&
        form.warranty_start_date &&
        form.last_date_of_warranty <= form.warranty_start_date
      ) {
        errs.last_date_of_warranty = "Warranty End Date must be after the Start Date.";
      }
    }

    // RELEASE — closing the current holder: date and reason required.
    if (releasing) {
      if (!release.end_date) {
        errs["release.end_date"] = "Release Date is required.";
      } else if (currentHolder.start_date && release.end_date < currentHolder.start_date) {
        errs["release.end_date"] = "Release Date cannot be before they got it.";
      }
      if (!release.action_status) errs["release.action_status"] = "Reason is required.";
    }

    // ASSIGN — the new holder: employee and start date required.
    if (assigning) {
      if (!assign.assigned_emp_code) {
        errs["assign.assigned_emp_code"] = "Assign To Employee is required.";
      } else if (
        currentHolder &&
        assign.assigned_emp_code === String(currentHolder.assigned_emp_code)
      ) {
        errs["assign.assigned_emp_code"] = "This employee already has the device.";
      }
      if (!assign.start_date) {
        errs["assign.start_date"] = "Start Date is required.";
      } else if (releasing && release.end_date && assign.start_date < release.end_date) {
        errs["assign.start_date"] = "Start Date cannot be before the Release Date.";
      }
    }
    return errs;
  };

  // Only after the first SUBMIT (see `attempted`); recomputed every render, so each message
  // disappears the moment its field is filled in.
  const errors = attempted ? collectErrors() : {};


  

  const persistDevice = async (report = setError) => {

    // The new holder if one is being assigned; nobody if the current one is only released.
    const holderCode = assigning
      ? assign.assigned_emp_code
      : releasing
        ? ""
        : form.employee_code || "";
    const holderName = assigning
      ? assign.assigned_emp_name
      : releasing
        ? ""
        : form.employee_name || "";

    const body = {
      ...form,
      device_id: Number(form.device_id),
      name: form.name.trim(),
      employee_code: holderCode,
      employee_name: holderName,
      
      warranty_start_date: form.warranty_start_date || null,
      last_date_of_warranty: form.last_date_of_warranty || null,
      total_warranty_years:
        form.total_warranty_years === "" ? null : Number(form.total_warranty_years),
      status: Number(form.status),
      // Who is saving — the backend writes it beside every field this edit changes.
      ...changedBy,
    };
    // Charger is a laptop column on the sheet; never send a value a desktop cannot have.
    if (!isLaptop) body.charger = "";
    // Keyboard and Mouse belong to desktops only — never a leftover value on another type.
    if (!isDesktop) {
      body.keyboard = "";
      body.mouse = "";
    }
    // Device Status is hidden for printers and tablets, so nothing left over from another type.
    if (!shows("device_status")) body.device_status = "";

    const res = targetId
      ? await updateAsset({ ...body, id: targetId })
      : await saveAsset(body);

    if (res?.status_code !== 200) {
      await warnAlert("Could not save", res?.message || "The device could not be saved.");
      report(res?.message || "Could not save.");
      return null;
    }

    const id = targetId ?? res?.response?.id ?? null;
    // The history is written against this id, so a save that returns none must not pass quietly.
    if (!id) {
      await warnAlert(
        "Device saved, history not recorded",
        "The server did not return the new device's id, so the action history could not be linked to it."
      );
      report("The action history could not be saved.");
      return null;
    }
    // Remembered, so the next press updates this machine instead of inserting another.
    if (!targetId && id) setJustSavedId(id);
    return id;
  };


  /*
   * RELEASE first, then ASSIGN — the order a handover happens in.
   *
   * Release UPDATES the current holder's own row (end date and reason), so the reason
   * sits on the row of the person it describes. Assign then SAVES a new row with status
   * "Assigned". If the assign fails after the release went through, the machine is simply
   * back in stock — a true state, not a broken one — and the message says so.
   *
   * Returns true when everything asked for was written.
   */
  const persistActions = async (assetId, report = setError) => {
    if (releasing) {
      const res = await updateAssetActionHistory({
        id: currentHolder.id,
        asset_id: assetId,
        assigned_emp_code: currentHolder.assigned_emp_code,
        assigned_emp_name: currentHolder.assigned_emp_name,
        start_date: currentHolder.start_date || null,
        end_date: release.end_date,
        action_status: release.action_status,
        status: currentHolder.status,
      });
      if (res?.status_code !== 200) {
        await warnAlert(
          "Device saved, release not recorded",
          res?.message || "The current holder could not be released."
        );
        report(res?.message || "Could not release the current holder.");
        return false;
      }
      setRelease(BLANK_RELEASE);
    }

    if (assigning) {
      const res = await saveAssetActionHistory({
        asset_id: assetId,
        assigned_emp_code: assign.assigned_emp_code,
        assigned_emp_name: assign.assigned_emp_name,
        start_date: assign.start_date,
        end_date: null,
        action_status: "Assigned",
      });
      if (res?.status_code !== 200) {
        await warnAlert(
          releasing ? "Released, new user not assigned" : "Device saved, assignment not recorded",
          res?.message || "The new holder could not be saved."
        );
        report(res?.message || "Could not assign the new holder.");
        return false;
      }
      setAssign(BLANK_ASSIGN);
    }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Belt and braces: there is no submit button when reading, but a stray Enter should not
    // find a way past that either.
    if (readOnly) return;

    // Turns the red messages on, then brings the first empty field into view.
    setAttempted(true);
    if (Object.keys(collectErrors()).length) {
      setError("");
      setTimeout(() => {
        document
          .querySelector("[data-field-error]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }

    const updating = Boolean(targetId);

    /*
     * "DO YOU WANT TO UPDATE THIS?" — before an UPDATE, every field that changes is listed
     * FROM its old value TO the new one, with any release / assign in Action History, and
     * nothing is saved until the user says yes. Nothing changed at all: said, and not saved.
     */
    if (updating) {
      const base = startedWith.current ?? BLANK;
      const show = (k, v) => {
        if (k === "status") return Number(v) === 0 ? "Inactive" : "Active";
        if (k.includes("date")) return v ? fmtDate(v) : "";
        if (k === "device_id") return devices.find((d) => String(d.id) === String(v))?.device_name ?? v;
        return v ?? "";
      };
      /*
       * Compared ONE BY ONE, and only the fields THIS device type has — the same rule that hides
       * them on the form and locks them in the Bulk Upload sheet (_deviceFields.js): a printer's
       * or tablet's missing fields are never listed. Type, model, name and status always are.
       */
      const typeRules = deviceFieldRules(deviceName);
      const changes = Object.keys(FIELD_LABELS)
        .filter((k) => ["device_id", "model", "name", "device_status"].includes(k) || typeRules.has(k))
        /*
         * Every field compared, Plant included: on an UPDATE a plant change is always shown
         * (only a NEW device's plant is filled in by itself, and this is never a new device).
         */
        .filter((k) => String(form[k] ?? "").trim() !== String(base[k] ?? "").trim())
        .map((k) => ({ label: FIELD_LABELS[k], from: show(k, base[k]), to: show(k, form[k]) }));

      const notes = [];
      if (releasing) {
        notes.push(
          `Release ${[currentHolder?.assigned_emp_code, currentHolder?.assigned_emp_name].filter(Boolean).join(" - ")}` +
            `${release.end_date ? ` on ${fmtDate(release.end_date)}` : ""}${release.action_status ? ` (${release.action_status})` : ""}`
        );
      }
      if (assigning) {
        notes.push(
          `Assign to ${[assign.assigned_emp_code, assign.assigned_emp_name].filter(Boolean).join(" - ")}` +
            `${assign.start_date ? ` from ${fmtDate(assign.start_date)}` : ""}`
        );
      }

      if (!changes.length && !notes.length) {
        await warnAlert("Nothing to update", "You have not changed anything on this device.");
        return;
      }
      if (!(await confirmUpdate(changes, notes, `device ${form.name || ""}`.trim()))) return;
    }

    setSaving(true);
    setError("");
    try {
   
      const savedId = await persistDevice();
      if (!savedId) return;

    
      if ((releasing || assigning) && !(await persistActions(savedId))) return;

      const historyNote =
        releasing && assigning
          ? `, ${currentHolder.assigned_emp_name || "previous user"} released and ${assign.assigned_emp_name} assigned`
          : releasing
            ? `, ${currentHolder.assigned_emp_name || "previous user"} released`
            : assigning
              ? `, assigned to ${assign.assigned_emp_name}`
              : "";
      await savedToast(
        `${updating ? "Device updated" : "Device added"} successfully${historyNote}`
      );

      const savedDeviceId = Number(form.device_id);
      reset();
      // Back to LIST DEVICE, on the same device, so the row just saved is there to see.
      if (onSaved) onSaved(savedDeviceId);
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
          {readOnly ? "View Device" : editing?.id ? "Edit Device" : "Add Device"}
        </h3>
        {/* BACK sits on the right of the title bar — the same place on every form — whenever
            the form was opened from a device list: viewing or editing an existing device, or
            an Open name opened from its Reference No (prefill). Only a blank form from the
            ADD DEVICE card has none; it has CLEAR at the bottom instead. */}
        {(readOnly || targetId || prefill) && onClose && (
          <button type="button" onClick={onBack} className={FORM_BACK_CLS}>
            <ChevronLeft className="h-4 w-4" />
            BACK
          </button>
        )}
      </div>

      {/* The variable is set once here and inherited by every field inside, native or not. */}
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-b-[3px] shadow-sm p-6"
        style={{ "--ams-disabled-bg": readOnly ? VIEW_BG : NOT_READY_BG }}
      >
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {/* Worked out from the field errors, so it goes away once the last one is filled. */}
        {Object.keys(errors).length > 0 && (
          <p className="mb-3 text-sm font-semibold text-red-600">
            Please fill in the required fields marked in red.
          </p>
        )}
        {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

        <Section title="Device Details" locked={specLocked || identityLocked}>
          <div>
            <label className={LABEL_CLS}>
              Device Type <span className="text-red-500">*</span>
            </label>
            {/* A real dropdown, and the only field enabled at the start: it decides which
                table the row goes into, so it cannot be free text. */}
            <SearchableSelect
              value={form.device_id}
              invalid={!!errors.device_id}
              onChange={onDeviceTypeChange}
              disabled={!!editing?.id || identityLocked}
              className={SELECT_CLS}
            >
              <option value="">Select Device Type</option>
              {typeOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_name}
                </option>
              ))}
            </SearchableSelect>
            <FieldError msg={errors.device_id} />
            {/* A note only when the box is locked and that needs explaining. Adding a device it
                says nothing: the field is the first one on the form and the only one enabled,
                which already says to start there. */}
            {(readOnly || editing?.id) && (
              <p className="mt-1 text-[11px] text-gray-500">
                {readOnly
                  ? "Read only — press EDIT below to change this device."
                  : "Fixed while editing — it decides the record."}
              </p>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>
              Model <span className="text-red-500">*</span>
            </label>
            {/* A real dropdown, not free text: the list is fetched from Model Master for the
                device type above, and choosing one is what narrows the names beside it. */}
            <SearchableSelect
              value={form.model}
              invalid={!!errors.model}
              onChange={onModelChange}
              disabled={specDisabled || identityLocked}
              className={SELECT_CLS}
            >
              <option value="">Select Model</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SearchableSelect>
            <FieldError msg={errors.model} />
            {!disabled && modelOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No model has been added for {deviceName.toUpperCase()}. Add it in Model Master
                first, then it will appear here.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>
              Device Name <span className="text-red-500">*</span>
            </label>
            {/* Fetched from Device Name Master for that device AND that model. Disabled until
                a model is chosen, because the list is empty before then and a dropdown that
                opens onto nothing reads as broken. */}
            <SearchableSelect
              value={form.name}
              invalid={!!errors.name}
              onChange={onNameChange}
              disabled={specDisabled || identityLocked || !form.model}
              className={SELECT_CLS}
            >
              <option value="">
                {!form.model ? "Select Model First" : "Select Device Name"}
              </option>
              {nameOptions.map((n) => {
                /*
                 * A name already on the register is still listed, marked and unselectable,
                 * rather than hidden. Hidden, it would look as if the machine had gone
                 * missing; this way it is plain that it exists and belongs to LIST DEVICE.
                 */
                // Never while editing: the row's own name is on the register by definition,
                // so greying it out would grey out the very row being changed.
                const taken = !editing?.id && takenNames.has(n.trim().toLowerCase());
                return (
                  <option key={n} value={n} disabled={taken}>
                    {taken ? `${n} — already added` : n}
                  </option>
                );
              })}
            </SearchableSelect>
            <FieldError msg={errors.name} />
            {!disabled && form.model && nameOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No device name for {form.model}. Please contact the IT team.
              </p>
            )}
          </div>

          {/*
            * REFERENCE NO — generated by the server on first save, never typed and never changed
            * afterwards, run together with no dashes: device type's first two letters, the
            * financial year (two digits, April to March, as in the TMS ticket number), the device
            * name, and the running number per device type in that year — e.g. DE26SOR1010005.
            * Before saving, the box shows the server's preview.
            */}
          <div>
            <label className={LABEL_CLS}>Reference No</label>
            <input
              type="text"
              value={editing?.reference_no || nextReference}
              disabled
              placeholder="Auto-generated on save"
              className={FIELD_CLS}
            />
          </div>

          {shows("asset_code") && (
            <TextField
              label="Asset Code"
              required
              error={errors.asset_code}
              value={form.asset_code}
              onChange={set("asset_code")}
              disabled={specDisabled}
              placeholder="Asset code on the case"
              maxLength={100}
            />
          )}
          {shows("asset_sn") && (
            <TextField
              label="Asset S/N"
              required
              error={errors.asset_sn}
              value={form.asset_sn}
              onChange={set("asset_sn")}
              disabled={specDisabled}
              placeholder="Manufacturer serial"
            />
          )}
          {shows("service_tag") && (
            <TextField
              label="Service Tag"
              required
              error={errors.service_tag}
              value={form.service_tag}
              onChange={set("service_tag")}
              disabled={specDisabled}
              placeholder="Service tag"
            />
          )}
          {/*
            * EXP. SERVICE CODE — the maker's Express Service Code (Dell), as on the asset sheet.
            * Optional, and open on EDIT too (not locked with the rest of Device Details), so a
            * device added before this field existed can have it filled in. Laptops and desktops.
            */}
          {shows("exp_service_code") && (
            <TextField
              label="Exp. Service Code"
              value={form.exp_service_code}
              onChange={set("exp_service_code")}
              disabled={disabled}
              placeholder="Express service code"
            />
          )}
          {shows("po_no") && (
            <TextField
              label="PO No."
              required
              error={errors.po_no}
              value={form.po_no}
              onChange={set("po_no")}
              disabled={specDisabled}
              placeholder="Purchase order"
              maxLength={100}
            />
          )}
        </Section>

        {/* A printer has no processor, memory or disk to record. */}
        {sectionShows("processor", "ram", "rom", "hdd", "system_type") && (
        <Section title="Hardware Details" locked={specLocked}>
          <MasterSelect
            label="Processor"
            required
            error={errors.processor}
            options={processorSelectOptions}
            value={form.processor}
            onChange={(v) => setForm((f) => ({ ...f, processor: v }))}
            disabled={specDisabled}
            master="Processor Master"
          />
          {/*
            * EXTERNAL fields — each right beside its own: anything fitted or attached beyond what
            * the machine came with. Optional, and still editable when editing (parts are often
            * added later), while the original hardware beside them stays locked.
            */}
          <TextField
            label="External Processor"
            value={form.external_processor}
            onChange={set("external_processor")}
            disabled={disabled}
            placeholder="If any"
            maxLength={200}
          />
          <MasterSelect
            label="RAM"
            required
            error={errors.ram}
            options={ramSelectOptions}
            value={form.ram}
            onChange={(v) => setForm((f) => ({ ...f, ram: v }))}
            disabled={specDisabled}
            master="RAM Master"
          />
          <TextField
            label="External RAM"
            value={form.external_ram}
            onChange={set("external_ram")}
            disabled={disabled}
            placeholder="e.g. 8 GB"
            maxLength={100}
          />
          {/* A tablet's storage is ROM, not a hard disk — one or the other, never both. */}
          {shows("rom") && (
            <TextField
              label="ROM"
              required
              error={errors.rom}
              value={form.rom}
              onChange={set("rom")}
              disabled={specDisabled}
              placeholder="e.g. 128 GB"
              maxLength={100}
            />
          )}
          {shows("rom") && (
            <TextField
              label="External ROM"
              value={form.external_rom}
              onChange={set("external_rom")}
              disabled={disabled}
              placeholder="e.g. 64 GB card"
              maxLength={100}
            />
          )}
          {shows("hdd") && (
            <MasterSelect
              label="HDD"
              required
              error={errors.hdd}
              options={hddSelectOptions}
              value={form.hdd}
              onChange={(v) => setForm((f) => ({ ...f, hdd: v }))}
              disabled={specDisabled}
              master="HDD Master"
            />
          )}
          {shows("hdd") && (
            <TextField
              label="External HDD"
              value={form.external_hdd}
              onChange={set("external_hdd")}
              disabled={disabled}
              placeholder="e.g. 1 TB"
              maxLength={100}
            />
          )}
          {/*
            * CHARGER ADAPTOR — laptops only (a desktop has none to track), just before System Type.
            * Editable on EDIT, as it was in Software Details.
            */}
          {isLaptop && (
            <TextField
              label="Charger Adaptor"
              required
              error={errors.charger}
              value={form.charger}
              onChange={set("charger")}
              disabled={disabled}
              placeholder="Charger adaptor detail"
              maxLength={100}
            />
          )}
          <MasterSelect
            label="System Type"
            required
            error={errors.system_type}
            options={systemTypeSelectOptions}
            value={form.system_type}
            onChange={(v) => setForm((f) => ({ ...f, system_type: v }))}
            disabled={specDisabled}
            master="System Type Master"
          />
        </Section>
        )}

        {/* Nor an operating system or installed software. */}
        {sectionShows("os", "os_service_pack", "ms_office", "software_1", "software_2", "charger") && (
        <Section title="Software Details">
          {/* Locked while editing, like Device / Hardware Details, in the same read-only blue. */}
          <div style={specLocked ? { "--ams-disabled-bg": VIEW_BG } : undefined}>
            <MasterSelect
              label="Operating System"
              required
              error={errors.os}
              options={osSelectOptions}
              value={form.os}
              onChange={(v) => setForm((f) => ({ ...f, os: v }))}
              disabled={specDisabled}
              master="Operating System Master"
            />
          </div>
          <TextField
            label="OS Service Pack"
            required
            error={errors.os_service_pack}
            value={form.os_service_pack}
            onChange={set("os_service_pack")}
            disabled={disabled}
            placeholder="Service pack"
            maxLength={100}
          />
          <TextField
            label="MS Office"
            required
            error={errors.ms_office}
            value={form.ms_office}
            onChange={set("ms_office")}
            disabled={disabled}
            placeholder="e.g. Office 2019"
          />
          <TextField
            label="Software 1"
            required
            error={errors.software_1}
            value={form.software_1}
            onChange={set("software_1")}
            disabled={disabled}
            placeholder="Other software"
            maxLength={200}
          />
          <TextField
            label="Software 2"
            required
            error={errors.software_2}
            value={form.software_2}
            onChange={set("software_2")}
            disabled={disabled}
            placeholder="Other software"
            maxLength={200}
          />
          {/*
            * KEYBOARD and MOUSE — their serial numbers, as on the Desktop sheet. Desktops only;
            * optional, and open on EDIT so a desktop added earlier can have them filled in.
            */}
          {isDesktop && (
            <TextField
              label="Keyboard"
              value={form.keyboard}
              onChange={set("keyboard")}
              disabled={disabled}
              placeholder="Keyboard serial no."
              maxLength={150}
            />
          )}
          {isDesktop && (
            <TextField
              label="Mouse"
              value={form.mouse}
              onChange={set("mouse")}
              disabled={disabled}
              placeholder="Mouse serial no."
              maxLength={150}
            />
          )}
        </Section>
        )}

        {/*
          * ALLOCATION is a tree, filled top down: Plant -> Department -> Location -> IP Address.
          * Department and Location are the chosen plant's own, so they stay locked until a plant
          * is picked, and changing the plant clears them rather than leave another plant's
          * department behind.
          */}
        <Section title="Allocation Details" locked={allocLocked}>
          {allocLocked && (
            <p className="text-[11px] text-gray-500 md:col-span-4">
              Locked while editing. To move this device, choose the reason <b>User Transferred
              To Another Plant</b> in Action History below — these fields then open.
            </p>
          )}
          {shows("plant") && (
          <div>
            <label className={LABEL_CLS}>
              Plant <Req />
            </label>
            {/* react-select, not a native <select>: it is searchable, and its menu can be
                forced to open BELOW the field, which a native dropdown's popup cannot be. */}
            <Select
              options={plantOptions}
              value={plantOptions.find((o) => o.value === form.plant) ?? null}
              onChange={(opt) =>
                setForm((f) => {
                  const plant = opt ? opt.value : "";
                  if (plant === f.plant) return f;
                  return { ...f, plant, department: "", location: "" };
                })
              }
              // A USER's plant is fixed to the one set for them in Reporting Person.
              isDisabled={allocDisabled || plantFixed}
              isClearable={!plantFixed}
              placeholder="Search Plant..."
              noOptionsMessage={() => "No plant matches that"}
              /* Matches the hidden `search` text, not just the visible code. */
              filterOption={(option, input) =>
                !input || (option.data.search ?? "").includes(input.trim().toLowerCase())
              }
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={selectStyles(errors.plant)}
            />
            <FieldError msg={errors.plant} />
          </div>
          )}
          {/* COMPANY — not typed or saved: the company the chosen plant belongs to (company
              master, by plant code), shown beside Plant so it is clear whose unit it is. */}
          {shows("plant") && (
            <div>
              <label className={LABEL_CLS}>Company</label>
              <input
                type="text"
                value={plantCompany}
                disabled
                placeholder={form.plant ? "" : "Select Plant first..."}
                className={FIELD_CLS}
              />
            </div>
          )}
          {shows("department") && (
            <MasterSelect
              label="Department"
              required
              error={errors.department}
              options={departmentSelectOptions}
              value={form.department}
              onChange={(v) => setForm((f) => ({ ...f, department: v }))}
              disabled={allocDisabled || !form.plant}
              placeholder={form.plant ? undefined : "Select Plant first..."}
              master="Department Master"
            />
          )}
          {shows("location") && (
            <MasterSelect
              label="Location"
              required
              error={errors.location}
              options={locationSelectOptions}
              value={form.location}
              onChange={(v) => setForm((f) => ({ ...f, location: v }))}
              disabled={allocDisabled || !form.plant}
              placeholder={form.plant ? undefined : "Select Plant first..."}
              master="Location Master"
            />
          )}
          {/*
            * EMPLOYEE CODE IS NOT A FIELD HERE ANY MORE.
            *
            * Who holds the machine is recorded in Action History, where it comes with the
            * dates and the reason. Asking for it twice invited the two to disagree, and the
            * allocation section's copy had no way of saying since when.
            *
            * The row still carries employee_code and employee_name — onSubmit sets them from
            * the newest person named in Action History, so the list view's EMPLOYEE NAME
            * column and the Action section's prefill both keep working.
            */}
          {/*
            * react-select, not a native <select>, for the same reason as Plant: a native
            * dropdown's popup is drawn by the browser, and with nineteen addresses and little
            * room beneath the field it opened UPWARD over the rest of the form. No CSS can
            * move it, because the popup is not part of the document. menuPlacement="bottom"
            * can. Searchable as a side effect, which suits a list of addresses well.
            */}
          {shows("ip_address") && (
            <MasterSelect
              label="IP Address"
              required
              error={errors.ip_address}
              options={ipSelectOptions}
              value={form.ip_address}
              onChange={(v) => setForm((f) => ({ ...f, ip_address: v }))}
              disabled={allocDisabled}
              master="IP Address Master"
            />
          )}
          {/* Device Status is no longer here: it is the STATUS field under Other Details. */}
        </Section>

        <Section title="Warranty Details">
          <div>
            <label className={LABEL_CLS}>
              Warranty Status <Req />
            </label>
            {/* A real dropdown: Warranty Master owns this list in full, so there is nothing
                legitimate to type that is not in it. */}
            <SearchableSelect
              value={form.warranty_status}
              invalid={!!errors.warranty_status}
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
            <FieldError msg={errors.warranty_status} />
          </div>

          {/* FROM and TO — the warranty's start and end dates. */}
          <div>
            <label className={LABEL_CLS}>
              Warranty Start Date <Req />
            </label>
            <input
              type="date"
              value={form.warranty_start_date}
              onChange={onWarrantyDateChange("warranty_start_date")}
              disabled={disabled}
              className={fieldCls(errors.warranty_start_date)}
            />
            <FieldError msg={errors.warranty_start_date} />
          </div>

          <div>
            <label className={LABEL_CLS}>
              Warranty End Date <Req />
            </label>
            <input
              type="date"
              value={form.last_date_of_warranty}
              min={form.warranty_start_date || undefined}
              onChange={onWarrantyDateChange("last_date_of_warranty")}
              disabled={disabled}
              className={fieldCls(errors.last_date_of_warranty)}
            />
            <FieldError msg={errors.last_date_of_warranty} />
          </div>

          {/* Worked out from the two dates above — never typed. */}
          <div>
            <label className={LABEL_CLS}>Total Warranty (Years &amp; Months)</label>
            {/* Shown as YEARS.MONTHS ("1.10" = 1 year 10 months); the number in years is what is saved. */}
            <input
              type="text"
              value={formatWarranty(form.warranty_start_date, form.last_date_of_warranty, form.total_warranty_years)}
              disabled
              placeholder="Calculated from the dates"
              className={FIELD_CLS}
            />
            <FieldError msg={errors.total_warranty_years} />
          </div>
          {/*
            * AGE (YEARS) — the asset sheet's formula, =(TODAY()-Last Date)/365+Total Warranty:
            * how old the device is today. Worked out every time the form opens; never stored.
            */}
          <div>
            <label className={LABEL_CLS}>Age (Years)</label>
            <input
              type="text"
              value={deviceAge(form.last_date_of_warranty, form.total_warranty_years)}
              disabled
              placeholder="From the warranty"
              className={FIELD_CLS}
            />
          </div>
        </Section>

        {/*
          * No Classification field: it is not asked for any more. A value an older device already
          * has stays on it (form.classification is still loaded and sent back unchanged), so the
          * register exports keep showing it.
          */}
        <Section title="Other Details">
          {shows("description") && (
            <TextField
              label="Description"
              required
              error={errors.description}
              value={form.description}
              onChange={set("description")}
              disabled={disabled}
              placeholder="Note"
              maxLength={255}
            />
          )}
          {/*
            * STATUS — whether the device is IN USE or IN SPARE (from /devicestatus/list), as the
            * asset sheet's STATUS column. Every device type has it. Stored as device_status; the
            * record's own active flag is no longer on the form (every device is saved active).
            */}
          <div>
            <label className={LABEL_CLS}>
              Status <Req />
            </label>
            <SearchableSelect
              value={form.device_status}
              invalid={!!errors.device_status}
              onChange={set("device_status")}
              disabled={disabled}
              className={SELECT_CLS}
            >
              <option value="">Select Status</option>
              {deviceStatusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SearchableSelect>
            <FieldError msg={errors.device_status} />
          </div>
        </Section>

        {/* Not for printers — see hasActionHistory. */}
        {hasActionHistory && (
        <Section title="Action History">
        
          {/*
            * CHECK-IN / CHECK-OUT. Viewing shows only the history table below.
            *
            * 1. CURRENT HOLDER — shown only when someone has the device. Filling it in closes
            *    THEIR row: release date and the reason they gave it up.
            * 2. ASSIGN — opens a new row for the next holder, status "Assigned" automatically.
            *
            * Editing a device without handing it over: leave both empty.
            */}
          {!readOnly && (
            <div className="space-y-4 md:col-span-4">
              {currentHolder && (
                <div className="rounded-[3px] border border-[#BFDDF5] bg-[#E6F2FF] p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-gray-700">
                      Current Holder:
                    </p>
                    <span className="text-[13px] font-semibold text-gray-800">
                      {[currentHolder.assigned_emp_code, currentHolder.assigned_emp_name]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                    {currentHolder.start_date && (
                      <span className="text-[12px] text-gray-500">
                        since {fmtDate(currentHolder.start_date)}
                      </span>
                    )}
                    <ActionStatusBadge status={currentHolder.action_status || "Assigned"} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                      <label className={LABEL_CLS}>
                        Release Date {releasing && <Req />}
                      </label>
                      <input
                        type="date"
                        value={release.end_date}
                        onChange={onReleaseDateChange}
                        disabled={disabled}
                        className={fieldCls(errors["release.end_date"])}
                      />
                      <FieldError msg={errors["release.end_date"]} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>
                        Reason {releasing && <Req />}
                      </label>
                      <SearchableSelect
                        value={release.action_status}
                        invalid={!!errors["release.action_status"]}
                        onChange={setReleaseField("action_status")}
                        disabled={disabled}
                        className={SELECT_CLS}
                        maxMenuHeight={120}
                      >
                        <option value="">Select Reason</option>
                        {RELEASE_REASONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </SearchableSelect>
                      <FieldError msg={errors["release.action_status"]} />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-gray-700">
                    {currentHolder ? "Assign To New Employee" : "Assign To Employee"}
                  </p>
                  <span className="text-[11px] text-gray-500">Status will be</span>
                  <ActionStatusBadge status="Assigned" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <MasterSelect
                    label="Assign To Employee"
                    options={employeeSelectOptions}
                    value={assign.assigned_emp_code}
                    onChange={onAssignEmployeeChange}
                    disabled={disabled}
                    master="the employee master"
                    required={assigning}
                    error={errors["assign.assigned_emp_code"]}
                    /* Near the bottom of the form: a short list that scrolls inside itself,
                       so it stays inside the card, the same as Status. */
                    maxMenuHeight={120}
                  />
                  <div>
                    <label className={LABEL_CLS}>
                      Start Date {assigning && <Req />}
                    </label>
                    <input
                      type="date"
                      value={assign.start_date}
                      onChange={setAssignField("start_date")}
                      disabled={disabled}
                      className={fieldCls(errors["assign.start_date"])}
                    />
                    <FieldError msg={errors["assign.start_date"]} />
                  </div>
                </div>
              </div>
            </div>
          )}
              {readOnly && timeline.length === 0 && (
                <p className="text-[12px] text-gray-500 md:col-span-4">
                  No action history recorded for this device.
                </p>
              )}

              {timeline.length > 0 && (
                <div className="md:col-span-4">
                  {/* While viewing, the section heading already says it — no second one. */}
                  {!readOnly && (
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      History
                    </p>
                  )}
                  <div className="overflow-x-auto rounded-[3px] border">
                    {/* A border round every cell, so the columns are divided by vertical lines. */}
                    <table
                      className="w-full border-collapse text-[12px]
                        [&_td]:border [&_td]:border-gray-200
                        [&_th]:border [&_th]:border-[#2a6d8f]"
                    >
                      <thead>
                        <tr className="bg-[#3482AE] text-left text-white">
                          <th className="whitespace-nowrap px-3 py-2 font-semibold">Sr No</th>
                          {/* Stored as two columns, shown as one: "code - name". */}
                          <th className="px-3 py-2 font-semibold">Employee Name &amp; Code</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold">Start Date</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold">End Date</th>
                          <th className="whitespace-nowrap px-3 py-2 font-semibold">Recorded</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((r, i) => (
                          <tr key={`${r.entryId}-${r.role}-${i}`} className="border-b border-gray-100">
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">{i + 1}</td>
                            <td className="px-3 py-2 text-gray-700">
                              {[r.code, r.name].filter(Boolean).join(" - ") || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                              {fmtDate(r.start) || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                              {/* Blank means they still hold it — worth saying, not a dash. */}
                              {fmtDate(r.end) || (r.start ? "Present" : "—")}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                              {fmtDate(r.recorded) || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              <ActionStatusBadge status={r.actionStatus} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
        </Section>
        )}

        {/*
          * USER LOG, right below Action History, whenever an existing device is open: every field
          * earlier edits changed, before → after, with who saved it and when, newest first.
          * Written by the backend on UPDATE (ams_asset_user_log).
          */}
        {editing?.id && (
          <Section title="User Log">
            <div className="md:col-span-4">
              {changeLog.length === 0 ? (
                <p className="text-[12px] text-gray-500">No changes recorded for this device yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-[3px] border">
                  <table
                    className="w-full border-collapse text-[12px]
                      [&_td]:border [&_td]:border-gray-200
                      [&_th]:border [&_th]:border-[#2a6d8f]"
                  >
                    <thead>
                      <tr className="bg-[#3482AE] text-left text-white">
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">Sr No</th>
                        <th className="px-3 py-2 font-semibold">Field</th>
                        <th className="px-3 py-2 font-semibold">Before</th>
                        <th className="px-3 py-2 font-semibold">After</th>
                        <th className="px-3 py-2 font-semibold">Changed By</th>
                        <th className="whitespace-nowrap px-3 py-2 font-semibold">Date &amp; Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeLog.map((c, i) => (
                        <tr key={c.id} className="border-b border-gray-100">
                          <td className="whitespace-nowrap px-3 py-2 text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-700">{c.field_name}</td>
                          <td className="px-3 py-2 text-gray-600">{c.old_value || "Not set"}</td>
                          <td className="px-3 py-2 text-gray-800">{c.new_value || "Removed"}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {[c.changed_by_code, c.changed_by_name].filter(Boolean).join(" - ") ||
                              "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                            {fmtDate(c.change_date)} {c.change_time || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* No save button at all when reading — not a disabled one. A greyed-out UPDATE
            invites a click and then explains itself; absent, there is nothing to explain. */}
        {/* Well below the last field, leaving room below Status for its list to open. */}
        <div className="mt-24 flex justify-center gap-2 pb-4">
          {readOnly ? (
            <>
              {/* EDIT opens this same device to change; UPDATE then saves it. */}
              {/* Own key + click stopped here, so React cannot reuse this <button> as the
                  UPDATE submit button and submit the form unchanged on the same click. */}
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
                disabled={saving || disabled}
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
