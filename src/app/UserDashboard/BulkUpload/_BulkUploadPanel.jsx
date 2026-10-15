"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { Download, Upload, FileSpreadsheet, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserScope } from "@/lib/userScope";
import { isViewer } from "@/lib/permissions";
import { getDeviceList } from "@/services/deviceService";
import { getModelList } from "@/services/modelService";
import { getDeviceStatus, getAssetList } from "@/services/assetService";
/*
 * The three record forms are large and needed only when a Reference No / name in the table is
 * clicked — so they are loaded THEN, not with the page. The page opens without them.
 */
const formLoading = () => <p className="p-6 text-sm text-gray-500">Loading…</p>;
const AddDevice = dynamic(() => import("../LaptopDesktop/_AddDevice"), { ssr: false, loading: formLoading });
const AddServer = dynamic(() => import("../Server/_AddServer"), { ssr: false, loading: formLoading });
const AddSoftware = dynamic(() => import("../Software/_AddSoftware"), { ssr: false, loading: formLoading });
import { getProcessorList } from "@/services/processorService";
import { getRamList } from "@/services/ramService";
import { getHddList } from "@/services/hddService";
import { getOsList } from "@/services/osService";
import { getSystemTypeList } from "@/services/systemTypeService";
import { getWarrantyList } from "@/services/warrantyService";
import { getIpAddressList } from "@/services/ipAddressService";
import {
  getCompanyList,
  getDepartmentList,
  getLocationList,
  getDeviceStatusList,
  getEmployeeList,
} from "@/services/masterService";
import { BULK_TYPES, softwareKey } from "./_bulkConfigs";
import { getServerList } from "@/services/serverService";
import { getServerAssetList } from "@/services/serverAssetService";
import { getProductList } from "@/services/productService";
import { getLicenseList } from "@/services/licenseService";
import { getSoftwareList } from "@/services/softwareService";
import { parseSheet, showDate, sheetFingerprint } from "./_parseSheet";
import { checkUploaded, logUpload, getUploadedRows } from "@/services/bulkUploadService";
import DataTable from "@/components/ui/common/DataTable";

/**
 * BULK UPLOAD for one register (Device, Server or Software):
 *
 *   1. DOWNLOAD TEMPLATE — an Excel sheet with this register's headings, plus an Instructions
 *      sheet listing each column, whether it is required, and an example.
 *   2. UPLOAD FILE — the sheet is read in the browser and every row checked: required cells,
 *      dates, numbers, and for devices the Device Type / Model and a USER's own scope.
 *   3. PREVIEW — every row with ✓ Ready or ✗ and why.
 *   4. IMPORT — only the ready rows go to the server, which saves each through the same save
 *      as the form and reports back per row. Failed rows can be downloaded with the reason,
 *      corrected and uploaded again.
 */


/** The most rows one upload takes — the server refuses more in one request. */
const MAX_ROWS = 1000;

/**
 * Any failure, said plainly: the server could not be reached at all (a network error), or it
 * answered with an error (the API helpers throw "API Error: <status>"), or something else —
 * with the detail, so a problem can be reported precisely.
 */
function explain(err) {
  const msg = String(err?.message ?? "");
  const status = msg.match(/API Error:\s*(\d+)/)?.[1];
  if (status) return `The server had a problem (error ${status}). Please try again; if it keeps happening, tell IT.`;
  if (err instanceof TypeError || /fetch|network/i.test(msg)) {
    return "Could not reach the server. Check your connection, or that the AMS server is running, and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}

/** One error popup, used everywhere in this panel. */
const showError = (title, err) =>
  Swal.fire({ icon: "error", title, text: typeof err === "string" ? err : explain(err), confirmButtonColor: "#3482AE" });

export default function BulkUploadPanel({ type }) {
  const config = BULK_TYPES[type];
  const { user } = useAuth();
  const scope = getUserScope(user);
  const fileInput = useRef(null);

  // Lookups for the device checks: Device Type and Model as they are in the masters.
  const [devices, setDevices] = useState([]);
  const [models, setModels] = useState([]);
  // Active employees, for Assign To Employee (the same list as the form's Action History).
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (type !== "device") return;
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
    getDeviceList()
      .then((r) => setDevices(ok(r).filter((d) => d.status === 1 && scope.allowsDevice(d.id))))
      .catch(() => setDevices([]));
    getModelList()
      .then((r) => setModels(ok(r).filter((m) => m.status === 1)))
      .catch(() => setModels([]));
    getEmployeeList()
      .then((r) => setEmployees(ok(r)))
      .catch(() => setEmployees([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /*
   * THE UPLOADED FILE STAYS until the user clears it (× beside its name): kept in this
   * browser per register and per user, so switching cards, leaving the page or refreshing
   * brings the same rows back — before or after IMPORT. Storage that is unavailable (a
   * private window) just means it is not kept; nothing else changes.
   */
  const storeKey = `ams_bulk_upload_${type}`;

  const [fileName, setFileName] = useState("");
  // Its size in bytes, shown under the name (only for a file chosen in this visit).
  const [fileSize, setFileSize] = useState(null);
  // The sheet's data fingerprint — the server refuses one already imported.
  const [fileHash, setFileHash] = useState("");
  /* Each: { rowNo, values, payload, errors, result } — result is set after IMPORT. */
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  /*
   * An earlier upload of the same sheet, opened from the "Already uploaded" message: its
   * rows as they were, with their results (ams_bulk_upload_log).
   */

  /*
   * EVERY ROW UPLOADED SO FAR for this register — from all its earlier sheets — shown in the
   * same table under the file being uploaded now: 50 from before and 10 from today's sheet
   * are all 60 there once imported.
   */
  const [uploaded, setUploaded] = useState([]);
  const [uploadedLoading, setUploadedLoading] = useState(true);
  // Why the uploaded list could not be loaded — shown above the table, with RETRY.
  const [uploadedError, setUploadedError] = useState("");
  const loadUploaded = async () => {
    setUploadedLoading(true);
    setUploadedError("");
    try {
      const res = await getUploadedRows(type);
      if (res?.status_code === 200 && Array.isArray(res.response)) {
        setUploaded(res.response);
      } else {
        setUploadedError(res?.message || "The devices uploaded earlier could not be loaded.");
      }
    } catch (err) {
      setUploadedError(explain(err));
    } finally {
      setUploadedLoading(false);
    }
  };
  useEffect(() => {
    loadUploaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /*
   * AN UPLOADED ROW, OPENED IN ITS OWN FORM — the device's Reference No, the server's name or
   * the software's product name is a link. It opens the saved record in the same form as the
   * Add pages, to VIEW first; EDIT opens it to change and UPDATE saves it. BACK (or a save)
   * returns to the upload page.
   *
   * { record, readOnly } while a form is open, null otherwise.
   */
  const [opened, setOpened] = useState(null);
  const [opening, setOpening] = useState(false);
  const openRecord = async (row) => {
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
    const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
    setOpening(true);
    try {
      let record = null;
      if (type === "device") {
        const deviceType = devices.find((d) => same(d.device_name, row.device_type));
        if (deviceType) {
          const list = ok(await getAssetList(deviceType.id));
          record =
            list.find((a) => row.reference_no && same(a.reference_no, row.reference_no)) ??
            list.find((a) => same(a.name, row.name)) ??
            null;
        }
      } else if (type === "server") {
        record = ok(await getServerAssetList()).find((s) => same(s.server_name, row.server_name)) ?? null;
      } else {
        /*
         * The same product may be on the register more than once, so the entry is found by ALL
         * its values (the table shows dates as DD/MM/YYYY and Status as Active / Inactive).
         */
        const iso = (d) => {
          const m = String(d ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          return m ? `${m[3]}-${m[2]}-${m[1]}` : String(d ?? "");
        };
        const want = softwareKey({
          ...row,
          renewal_date: iso(row.renewal_date),
          status: String(row.status ?? "").trim().toLowerCase() === "inactive" ? 0 : 1,
        });
        const list = ok(await getSoftwareList());
        record =
          list.find((s) => softwareKey(s) === want) ??
          list.find((s) => same(s.product_name, row.product_name)) ??
          null;
      }
      if (!record) {
        Swal.fire({
          icon: "info",
          title: "Not found",
          text: "This record is no longer in the register — it may have been deleted or renamed since it was uploaded.",
          confirmButtonColor: "#3482AE",
        });
        return;
      }
      /*
       * EDIT only for what this person may change: never for a VIEWER, and for a USER only a
       * device in one of THEIR plants and device types (Reporting Person). Anything else opens
       * to view only — no EDIT button.
       */
      const canEdit =
        !isViewer(user) &&
        (type !== "device" ||
          (scope.allowsPlant(record.plant) && scope.allowsDevice(record.device_id)));
      setOpened({ record, readOnly: true, canEdit });
    } catch (err) {
      showError("Could not open the record", err);
    } finally {
      setOpening(false);
    }
  };
  const closeRecord = () => setOpened(null);

  /*
   * Restored just after the panel opens (not while the page is first drawn, which happens
   * on the server too), and only then kept up to date — so the empty first state can never
   * overwrite what was saved.
   */
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storeKey) || "null");
      if (saved && Array.isArray(saved.rows) && saved.rows.length) {
        setFileName(saved.fileName ?? "");
        setFileHash(saved.fileHash ?? "");
        setRows(saved.rows);
        setImported(Boolean(saved.imported));
      }
    } catch {
      /* nothing usable saved */
    }
    setRestored(true);
  }, [storeKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      if (rows.length) {
        window.localStorage.setItem(storeKey, JSON.stringify({ fileName, fileHash, rows, imported }));
      } else {
        window.localStorage.removeItem(storeKey);
      }
    } catch {
      /* not kept — the page still works */
    }
  }, [restored, storeKey, fileName, fileHash, rows, imported]);

  /*
   * A KEPT FILE THAT IS ALREADY IMPORTED IS CLEARED. A preview saved in the browser may belong
   * to a sheet imported since (here, or by someone else): it is checked once against the
   * server's record of uploaded sheets when the panel opens, and removed if it is there — its
   * rows are already in the list of every row uploaded, so there is nothing left to import.
   */
  const [revalidated, setRevalidated] = useState(false);
  useEffect(() => {
    if (!restored || revalidated) return;
    setRevalidated(true);
    if (!rows.length) return;
    (async () => {
      try {
        const hash = fileHash || (await sheetFingerprint(rows, config));
        const check = await checkUploaded(type, hash);
        if (check?.status_code === 200 && check.response) reset();
      } catch {
        /* cannot check now — the preview stays; IMPORT is still checked by the server */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  // Names already in the list of uploaded rows — imported before, so never imported again.
  const nameField = type === "device" ? "name" : type === "server" ? "server_name" : "product_name";
  // (Empty where the same name may be added again — Software — or a new row would be hidden.)
  const uploadedNames = useMemo(
    () =>
      config.allowDuplicates
        ? new Set()
        : new Set(uploaded.map((u) => String(u[nameField] ?? "").trim().toLowerCase()).filter(Boolean)),
    [uploaded, nameField, config.allowDuplicates]
  );

  // Sent on IMPORT: no errors, not already in the system (skipped), not already uploaded.
  const ready = rows.filter(
    (r) =>
      r.errors.length === 0 &&
      !r.skip &&
      !uploadedNames.has(String(r.values[nameField] ?? "").trim().toLowerCase())
  );
  const summary = useMemo(() => {
    const done = rows.filter((r) => r.result);
    const invalid = rows.filter((r) => r.errors.length).length;
    return {
      total: rows.length,
      ready: ready.length,
      invalid,
      skipped: rows.filter((r) => r.skip).length,
      saved: done.filter((r) => r.result.success).length,
      failed: done.filter((r) => !r.result.success).length + (imported ? invalid : 0),
    };
  }, [rows, ready.length, imported]);

  /** Lets the same file be chosen again; what is on screen stays. */
  const clearPicker = () => {
    if (fileInput.current) fileInput.current.value = "";
  };

  /** × beside the file name — the only thing that takes the uploaded rows off the screen. */
  const reset = () => {
    setRows([]);
    setFileName("");
    setFileSize(null);
    setFileHash("");
    setImported(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  /**
   * THE DEVICE TEMPLATE, with dropdowns (exceljs — the other library cannot write them). This
   * fetches the live lists; _deviceTemplate.js builds the workbook from them.
   */
  const downloadDeviceTemplate = async () => {
    /*
     * WHICH DEVICE TYPE — a sheet for one type (Desktop) shows only that type's columns, with its
     * mandatory ones marked *; "All device types" keeps one sheet for every type, as before.
     */
    const { value: picked, isConfirmed } = await Swal.fire({
      title: "Download template for",
      input: "select",
      inputOptions: {
        all: "All device types",
        ...Object.fromEntries(devices.map((d) => [String(d.id), d.device_name])),
      },
      inputValue: devices.length === 1 ? String(devices[0].id) : "all",
      showCancelButton: true,
      confirmButtonText: "Download",
      confirmButtonColor: "#3482AE",
    });
    if (!isConfirmed) return;
    const chosen = picked === "all" ? devices : devices.filter((d) => String(d.id) === picked);

    const ExcelJS = (await import("exceljs")).default;
    // The template builder too is loaded only now, when Download Template is clicked.
    const { buildDeviceWorkbook } = await import("./_deviceTemplate");
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);

    // Names not registered yet, per device type — the ones there is something to fill in for.
    const statusByType = await Promise.all(
      chosen.map((d) => getDeviceStatus(d.id).then(ok).catch(() => []))
    );

    /*
     * The same master lists the ADD DEVICE form offers — active rows only, as there — for the
     * other dropdown columns. A list that fails to load leaves that column free to type in.
     */
    const active = (list) => list.filter((r) => r.status === 1);
    const load = (fn, pick) => fn().then(ok).then(pick).catch(() => []);
    const [
      processors, rams, hdds, oses, systemTypes, warranties, ips, deviceStatuses,
      plantRows, departmentRows, locationRows,
    ] = await Promise.all([
      load(getProcessorList, (l) => active(l).map((r) => r.name)),
      load(getRamList, (l) => active(l).map((r) => r.name)),
      load(getHddList, (l) => active(l).map((r) => r.name)),
      load(getOsList, (l) => active(l).map((r) => r.name)),
      load(getSystemTypeList, (l) => active(l).map((r) => r.name)),
      load(getWarrantyList, (l) => active(l).map((r) => r.name)),
      load(getIpAddressList, (l) => active(l).map((r) => r.ip_address)),
      getDeviceStatusList()
        .then(ok)
        .then((l) => (l.length ? l : ["In Use", "In Spare"]))
        .catch(() => ["In Use", "In Spare"]),
      load(getCompanyList, (l) => l),
      load(getDepartmentList, (l) => l),
      load(getLocationList, (l) => l),
    ]);

    // The workbook itself: the same builder the template test runs against live data.
    const wb = buildDeviceWorkbook(ExcelJS, {
      title: config.title,
      columns: config.columns,
      example: config.example,
      devices: chosen,
      models,
      statusByType,
      scope,
      masters: {
        processors, rams, hdds, oses, systemTypes, warranties, ips, deviceStatuses,
        plantRows, departmentRows, locationRows, employees,
      },
    });

    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    );
    const a = document.createElement("a");
    a.href = url;
    const suffix = chosen.length === 1 ? `_${chosen[0].device_name.replace(/[^A-Za-z0-9]+/g, "_")}` : "";
    a.download = `${config.templateName}${suffix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [preparing, setPreparing] = useState(false);
  /** The browser download of a built workbook. */
  const saveWorkbook = async (wb) => {
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.templateName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Server Master names, and the servers already on the register (by name, lower case). */
  const loadServerNames = async () => {
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
    const [master, added] = await Promise.all([
      getServerList().then(ok).catch(() => []),
      getServerAssetList().then(ok).catch(() => []),
    ]);
    const names = master.filter((s) => s.status === 1).map((s) => String(s.name ?? "").trim()).filter(Boolean);
    const taken = new Set(added.map((s) => String(s.server_name ?? "").trim().toLowerCase()).filter(Boolean));
    return { names, taken };
  };

  /**
   * THE SERVER TEMPLATE — every field of ADD SERVER, with the same dropdowns from the same
   * APIs: Server Name (Server Master, only servers not added yet), Processor, RAM, HDD, System
   * Type, OS, IP Address, Plant, Dept., Warranty Status and Status.
   */
  const downloadServerTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
    // The template builder too is loaded only now, when Download Template is clicked.
    const { buildListWorkbook } = await import("./_listTemplate");
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
    const active = (list) => list.filter((r) => r.status === 1);
    const load = (fn, pick) => fn().then(ok).then(pick).catch(() => []);
    const tidy = (values) =>
      [...new Map(values.map((v) => String(v ?? "").trim()).filter(Boolean).map((v) => [v.toLowerCase(), v])).values()]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const [{ names, taken }, processors, rams, hdds, oses, systemTypes, ips, warranties, plantRows, departmentRows, locationRows] =
      await Promise.all([
        loadServerNames(),
        load(getProcessorList, (l) => active(l).map((r) => r.name)),
        load(getRamList, (l) => active(l).map((r) => r.name)),
        load(getHddList, (l) => active(l).map((r) => r.name)),
        load(getOsList, (l) => active(l).map((r) => r.name)),
        load(getSystemTypeList, (l) => active(l).map((r) => r.name)),
        load(getIpAddressList, (l) => active(l).map((r) => r.ip_address)),
        load(getWarrantyList, (l) => active(l).map((r) => r.name)),
        load(getCompanyList, (l) => l),
        load(getDepartmentList, (l) => l),
        load(getLocationList, (l) => l),
      ]);

    // Only servers not added yet — the form greys the others out.
    const free = tidy(names.filter((n) => !taken.has(n.toLowerCase())));
    const plantCodes = tidy(plantRows.map((p) => p.plant_code));
    // LOCATION by PLANT — Location Master, each plant's own locations, as on ADD SERVER / ADD DEVICE.
    const locationsByPlant = Object.fromEntries(
      plantCodes.map((code) => [
        code,
        tidy(locationRows.filter((l) => String(l.plant_code ?? "").trim() === code).map((l) => l.location_name)),
      ])
    );
    const wb = buildListWorkbook(ExcelJS, {
      title: config.title,
      columns: config.columns,
      example: config.example,
      linked: { location: { parent: "plant", groups: locationsByPlant } },
      // Total Warranty worked out from Warranty Start Date and Last Date Of Warranty, as on the form.
      warrantyTotal: { start: "warranty_start_date", end: "last_date_of_warranty", total: "total_warranty_years" },
      lists: {
        server_name: free,
        processor: tidy(processors),
        ram: tidy(rams),
        hdd: tidy(hdds),
        system_type: tidy(systemTypes),
        os_name: tidy(oses),
        ip_address: tidy(ips),
        plant: plantCodes,
        // The form's Dept. is every department, not narrowed by plant.
        department: tidy(departmentRows.map((d) => d.department)),
        warranty_status: tidy(warranties),
      },
      notes: [
        "Every field of the Add Server form, in the same order, with the same dropdowns.",
        "Server Name is MANDATORY and comes from Server Master — only servers not added yet are listed.",
        "Location comes from Location Master: pick the Plant first, then one of that plant's locations.",
        "Total Warranty (In Years) is worked out from Warranty Start Date and Last Date Of Warranty — leave it.",
        "A server already added is skipped on upload. Location and the rest are optional.",
        ...(free.length
          ? []
          : ["NOTE: every server in Server Master is already added — add new servers in Server Master first."]),
      ],
    });
    await saveWorkbook(wb);

    // Nothing left to add: said now, as the form says it, not discovered after filling the sheet.
    if (!free.length) {
      Swal.fire({
        icon: "info",
        title: "No servers left to add",
        text: `All ${names.length} servers in Server Master are already added. Add new servers in Server Master first, then download the template again.`,
        confirmButtonColor: "#3482AE",
      });
    }
  };

  /** Active products in Product Master and the active License Master types — what ADD SOFTWARE loads. */
  const loadSoftwareLists = async () => {
    const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
    const names = (list) => list.filter((r) => r.status === 1).map((r) => String(r.name ?? "").trim()).filter(Boolean);
    const [products, licenses] = await Promise.all([
      getProductList().then(ok).then(names).catch(() => []),
      getLicenseList().then(ok).then(names).catch(() => []),
    ]);
    return { products, licenses };
  };

  /**
   * THE SOFTWARE TEMPLATE — every field of ADD SOFTWARE, in its order, with its dropdowns:
   * Product Name (every active product in Product Master — the same product may be added more
   * than once), License Type (License Master) and Status.
   */
  const downloadSoftwareTemplate = async () => {
    const ExcelJS = (await import("exceljs")).default;
    // The template builder too is loaded only now, when Download Template is clicked.
    const { buildListWorkbook } = await import("./_listTemplate");
    const tidy = (values) =>
      [...new Map(values.map((v) => [v.toLowerCase(), v])).values()]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const { products, licenses } = await loadSoftwareLists();
    const wb = buildListWorkbook(ExcelJS, {
      title: config.title,
      columns: config.columns,
      example: config.example,
      lists: {
        product_name: tidy(products),
        license_type: tidy(licenses),
        status: ["Active", "Inactive"],
      },
      notes: [
        "Every field of the Add Software form, in the same order, with the same dropdowns.",
        "Product Name is MANDATORY and comes from Product Master (every active product).",
        "The same product may be added more than once — on several rows, or again if already added.",
        "License Type comes from License Master.",
        "Total Licenses Acquired cannot be negative; a negative License Excess or Deficiency is a deficiency.",
        ...(products.length ? [] : ["NOTE: no product in Product Master — add products there first."]),
      ],
    });
    await saveWorkbook(wb);

    if (!products.length) {
      Swal.fire({
        icon: "info",
        title: "No products",
        text: "No product has been added. Add one in Product Master first, then download the template again.",
        confirmButtonColor: "#3482AE",
      });
    }
  };

  const onDownloadTemplate = async () => {
    setPreparing(true);
    try {
      if (type === "device") await downloadDeviceTemplate();
      else if (type === "server") await downloadServerTemplate();
      else await downloadSoftwareTemplate();
    } catch (err) {
      console.error("Bulk upload: template", err);
      showError("Could not build the template", err);
    } finally {
      setPreparing(false);
    }
  };

  /** Read the chosen file and check every row. */
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Checked before anything is read: an Excel file, of a size a template can be.
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      showError("Not an Excel file", `"${file.name}" is not an Excel file. Upload the template (.xlsx).`);
      clearPicker();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError("File too large", "The file is over 10 MB. Upload at most 1000 rows at a time.");
      clearPicker();
      return;
    }
    // Device rows are checked against Device Master / Model Master; without them every row would fail.
    if (type === "device" && (!devices.length || !models.length)) {
      showError(
        "Lists not loaded yet",
        "The device types and models have not loaded. Wait a moment or refresh the page, then upload again."
      );
      clearPicker();
      return;
    }

    try {
      /*
       * Devices already added (name -> Reference No), so a row for one is marked in the preview
       * rather than refused after IMPORT. Device names are unique across every type.
       */
      const registered = new Map();
      if (type === "device") {
        const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
        const lists = await Promise.all(devices.map((d) => getDeviceStatus(d.id).then(ok).catch(() => [])));
        lists.flat().forEach((r) => {
          // Its Reference No and, when it is assigned, who has it — said in the row's message.
          if (r.registered && r.name) {
            registered.set(String(r.name).trim().toLowerCase(), {
              ref: r.reference_no ?? "",
              holderCode: r.state === "ASSIGNED" ? r.holder_code ?? "" : "",
              holderName: r.state === "ASSIGNED" ? r.holder_name ?? "" : "",
            });
          }
        });
      }

      // Servers: the names in Server Master, and those already on the register (skipped).
      let serverNames = null;
      let registeredServers = null;
      if (type === "server") {
        const { names, taken } = await loadServerNames();
        serverNames = new Set(names.map((n) => n.toLowerCase()));
        registeredServers = taken;
      }

      /*
       * Software: Product Master and License Master names, and every entry already saved —
       * a row identical in every value to one of them is skipped as already added (the same
       * product with any value changed is a new entry). Kept: entry -> the date it was added.
       */
      let productNames = null;
      let licenseTypes = null;
      let softwareEntries = null;
      if (type === "software") {
        const ok = (res) => (res?.status_code === 200 && Array.isArray(res.response) ? res.response : []);
        const [{ products, licenses }, saved] = await Promise.all([
          loadSoftwareLists(),
          getSoftwareList().then(ok).catch(() => []),
        ]);
        productNames = new Set(products.map((n) => n.toLowerCase()));
        licenseTypes = new Set(licenses.map((n) => n.toLowerCase()));
        softwareEntries = new Map();
        saved.forEach((s) => {
          const key = softwareKey(s);
          if (!softwareEntries.has(key)) softwareEntries.set(key, s.create_date ? showDate(s.create_date) : "");
        });
      }

      const ctx = {
        serverNames,
        registeredServers,
        productNames,
        licenseTypes,
        softwareEntries,
        employees,
        devices,
        models,
        registered,
        scope,
        changedBy: {
          // Text, as the backend holds it: the employee code arrives from login as a number.
          changed_by_code: String(user?.emp_code ?? user?.user_id ?? ""),
          changed_by_name: [user?.userFname, user?.userLname].filter(Boolean).join(" ") || user?.displayName || "",
        },
      };
      // The Excel reader is loaded only now, when a file is chosen — not when the page opens.
      const xlsxModule = await import("xlsx-js-style");
      // An older (CommonJS) package: its functions may sit on .default once loaded this way.
      const XLSX = xlsxModule.read ? xlsxModule : xlsxModule.default;
      const { missing, rows: parsed } = parseSheet(XLSX, await file.arrayBuffer(), config, ctx);
      if (missing) {
        Swal.fire({
          icon: "error",
          title: "Wrong template",
          text: `Missing column(s): ${missing.join(", ")}. Download the template and use its headings.`,
          confirmButtonColor: "#3482AE",
        });
        clearPicker();
        return;
      }

      if (parsed.length > MAX_ROWS) {
        showError("Too many rows", `The sheet has ${parsed.length} rows. Upload at most ${MAX_ROWS} at a time — split it into smaller sheets.`);
        clearPicker();
        return;
      }

      if (!parsed.length) {
        Swal.fire({ icon: "info", title: "No rows", text: "The sheet has headings but no data rows.", confirmButtonColor: "#3482AE" });
        clearPicker();
        return;
      }
      /*
       * THE SAME SHEET CANNOT BE UPLOADED TWICE. Its data fingerprint is checked against every
       * sheet already imported for this register — renamed or re-saved, it is still the same
       * sheet. Refused here, before anything is shown, with when and by whom it was uploaded.
       */
      const hash = await sheetFingerprint(parsed, config);
      const check = await checkUploaded(type, hash).catch(() => null);
      if (check?.status_code === 200 && check.response) {
        await Swal.fire({
          icon: "error",
          title: "Already uploaded",
          text: check.message,
          confirmButtonText: "Close",
          confirmButtonColor: "#6b7280",
        });
        clearPicker();
        return;
      }

      // Only a good file replaces what is on screen.
      setFileName(file.name);
      setFileSize(file.size);
      setFileHash(hash);
      setRows(parsed);
      setImported(false);
      clearPicker();
    } catch (err) {
      // The actual reason, so a problem can be told apart from a wrong kind of file.
      console.error("Bulk upload: could not read the file", err);
      Swal.fire({
        icon: "error",
        title: "Could not read the file",
        text: `Upload the Excel template (.xlsx). ${err?.message ? `(${err.message})` : ""}`,
        confirmButtonColor: "#3482AE",
      });
      clearPicker();
    }
  };

  /** Send the ready rows; put each result back on its row. */
  const onImport = async () => {
    if (!ready.length) return;
    const confirm = await Swal.fire({
      icon: "question",
      title: `Upload ${ready.length} ${config.title.toLowerCase()} row(s)?`,
      html: [
        summary.skipped ? `<p>${summary.skipped} row(s) already added will be skipped.</p>` : "",
        summary.invalid ? `<p>${summary.invalid} row(s) with errors will not be uploaded.</p>` : "",
      ].join(""),
      showCancelButton: true,
      confirmButtonText: "Yes, upload",
      confirmButtonColor: "#3482AE",
    });
    if (!confirm.isConfirmed) return;

    setImporting(true);
    try {
      // A preview kept from before fingerprints existed works its own out from its rows.
      const hash = fileHash || (await sheetFingerprint(rows, config));
      if (!fileHash) setFileHash(hash);
      const res = await config.upload(ready.map((r) => r.payload), hash);
      if (res?.status_code !== 200 || !Array.isArray(res.response)) {
        // Refused as a whole — e.g. this sheet was already uploaded (checked by the server too).
        Swal.fire({ icon: "error", title: "Upload refused", text: res?.message || "The server did not accept the file.", confirmButtonColor: "#3482AE" });
        return;
      }
      const byIndex = new Map(res.response.map((r) => [r.index, r]));
      let k = 0;
      // Results go back onto exactly the rows that were sent (the ready ones, in order).
      const sent = new Set(ready.map((r) => r.rowNo));
      const next = rows.map((r) =>
        !sent.has(r.rowNo)
          ? r
          : { ...r, result: byIndex.get(k++) ?? { success: false, message: "No answer from the server" } }
      );
      setRows(next);
      setImported(true);

      const added = next.filter((r) => r.result?.success).length;
      // Not sent and no errors: already added or already uploaded — skipped, not failed.
      const skipped = next.filter((r) => !r.errors.length && !sent.has(r.rowNo)).length;
      const failed = next.length - added - skipped;

      /*
       * Record the sheet: its name, fingerprint, counts, who uploaded it and every row as shown
       * with its result — so it appears under UPLOADED SHEETS and cannot be uploaded again.
       */
      const logged = await logUpload({
        upload_type: type,
        file_name: fileName,
        file_hash: hash,
        total_rows: next.length,
        imported: added,
        failed,
        // Only the rows saved, and only the sheet's own values (no row number / status / message).
        rows: toTableRows(next.filter((r) => r.result?.success)).map(({ id: _id, row_no: _rowNo, ...values }) => values),
        uploaded_by_code: String(user?.emp_code ?? user?.user_id ?? ""),
        uploaded_by_name: [user?.userFname, user?.userLname].filter(Boolean).join(" ") || user?.displayName || "",
      }).catch((err) => {
        console.error("Bulk upload: could not record the sheet", err);
        return null;
      });
      // The devices are saved either way; only the record of the sheet is missing — say so.
      const notRecorded = added > 0 && logged?.status_code !== 200;
      /*
       * Once recorded, this sheet's imported rows are part of EVERY ROW UPLOADED (reloaded
       * here), so they leave the "this file" part of the table — only rows that did not go in
       * stay there, to download, fix and upload again.
       */
      if (logged?.status_code === 200) {
        // What is left to fix: errors and failed rows. Imported and skipped rows are done.
        const left = next.filter((r) => r.errors.length || (r.result && !r.result.success));
        if (left.length) setRows(left);
        else {
          setRows([]);
          setFileName("");
          setFileSize(null);
          setFileHash("");
          setImported(false);
        }
      }
      await loadUploaded();

      // Saved, but with a warning (a device saved whose employee could not be assigned).
      const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
      const noted = next.filter((r) => r.result?.success && /^Saved, but/i.test(r.result.message ?? ""));
      const notes = noted.length
        ? `<div style="font-size:12px;color:#b45309;text-align:left;margin-top:8px">${noted
            .map((r) => `Excel row ${r.rowNo}: ${esc(r.result.message)}`)
            .join("<br/>")}</div>`
        : "";

      /*
       * WHAT WAS ADDED: for devices, only the Reference No each was saved with — one per line,
       * to note straight from here. Servers and software have no Reference No, so their names.
       */
      const savedRows = next.filter((r) => r.result?.success);
      const savedItems = savedRows
        .map((r) =>
          type === "device"
            ? r.result.reference_no
            : r.result.name ?? r.values.server_name ?? r.values.product_name
        )
        .filter(Boolean);
      const savedList = savedItems.length
        ? `<div style="max-height:200px;overflow-y:auto;margin-top:6px;font-size:13px">` +
          `<p style="font-weight:600;margin-bottom:4px">${type === "device" ? "Reference No" : "Added"}</p>` +
          savedItems
            .map((v) => `<div style="font-weight:600;color:#3482AE;padding:2px 0">${esc(v)}</div>`)
            .join("") +
          `</div>`
        : "";

      Swal.fire({
        icon: failed ? "warning" : "success",
        title: failed ? "Upload finished with errors" : "Upload complete",
        html:
          `<p><b>Uploaded:</b> ${added}</p>` +
          savedList +
          notes +
          (skipped ? `<p><b>Skipped (already added):</b> ${skipped}</p>` : "") +
          (failed
            ? `<p style="color:#dc3545"><b>Not uploaded:</b> ${failed}</p><p style="font-size:12px">Fix them in the sheet and upload them again.</p>`
            : "") +
          (notRecorded
            ? `<p style="color:#b45309;font-size:12px">The devices are saved, but this sheet could not be recorded${logged?.message ? ` (${logged.message})` : ""}. They will still show in Open Devices.</p>`
            : ""),
        confirmButtonColor: "#3482AE",
      });
    } catch (err) {
      /*
       * The request failed part-way (connection dropped, server error). Some rows may already
       * be saved — uploading the same file again is safe: those come back as Skipped.
       */
      console.error("Bulk upload: import", err);
      Swal.fire({
        icon: "error",
        title: "Upload did not finish",
        html: `<p>${explain(err)}</p><p style="font-size:12px;margin-top:8px">Some rows may already be saved. It is safe to upload the same file again — rows already added are skipped.</p>`,
        confirmButtonColor: "#3482AE",
      });
    } finally {
      setImporting(false);
    }
  };

  /*
   * THE TABLE'S ROWS — every column of the sheet as plain text (dates as DD/MM/YYYY), so the
   * table can search, filter and export it. Once imported, a device's Reference No is the one
   * the server saved. No row number, status or message: what needs fixing or was skipped is
   * listed above the table instead.
   */
  const toTableRows = (list) =>
    list.map((r) => {
      const out = { id: r.rowNo, row_no: r.rowNo };
      config.columns.forEach((c) => {
        const v = r.values[c.key];
        out[c.key] = c.type === "date" ? showDate(v) : v ?? "";
      });
      if (r.result?.reference_no) out.reference_no = r.result.reference_no;
      return out;
    });
  /*
   * THE TABLE: the file being uploaded now first (its own ids, so they never clash), then
   * EVERY ROW ALREADY UPLOADED from earlier sheets — so 50 before and 10 now are all 60.
   */
  const tableData = useMemo(() => {
    /*
     * A device is listed ONCE. This file's rows leave out any already imported — by this file
     * or one before (same name in the list of uploaded rows) — since that list shows them.
     */
    const key = (v) => String(v ?? "").trim().toLowerCase();
    const current = rows.filter((r) => !r.result?.success && !uploadedNames.has(key(r.values[nameField])));
    return [
      ...toTableRows(current).map((r) => ({
        ...r,
        id: `new-${r.row_no}`,
        file_name: fileName,
        uploaded_on: imported ? "-" : "Not uploaded yet",
        uploaded_by: "",
      })),
      ...uploaded,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, uploaded, uploadedNames, nameField, fileName, imported, config]);

  /*
   * Arranged LIKE THE EXCEL SHEET: SR. NO, then every column of the sheet in the template's
   * order (Reference No, Device Type, Model, Device Name, … for devices), and only after them
   * where each row came from — file, when and by whom.
   */
  const tableColumns = [
    { label: "SR. NO", width: 80 },
    /*
     * Each value EXACTLY AS IT IS IN THE EXCEL SHEET — "Dell Optiplex 3020", "test", "16 GB" —
     * not in the capitals the rest of the app draws everything in (normal-case undoes that).
     * Dates are DD/MM/YYYY, as the template formats them.
     */
    ...config.columns.map((c) => ({
      key: c.key,
      label: c.header.toUpperCase(),
      width: Math.max(120, c.header.length * 9 + 40),
      render: (row) => {
        const value = row[c.key];
        if (value === "" || value === null || value === undefined) return <span>-</span>;
        /*
         * THE LINK that opens the saved record: Reference No for a device, Server Name for a
         * server, Product Name for software — only on rows already uploaded (the shaded rows
         * of the file just chosen are not saved yet, so there is nothing to open).
         */
        const linkKey = type === "device" ? "reference_no" : type === "server" ? "server_name" : "product_name";
        if (c.key === linkKey && !String(row.id).startsWith("new-")) {
          return (
            <button
              type="button"
              onClick={() => openRecord(row)}
              disabled={opening}
              title="Open this record"
              className="normal-case text-left font-semibold text-[#3482AE] hover:underline disabled:opacity-50"
            >
              {String(value)}
            </button>
          );
        }
        return <span className="normal-case">{String(value)}</span>;
      },
    })),
    // Which sheet each row came from — the table holds every sheet uploaded.
    {
      key: "file_name",
      label: "FILE NAME",
      width: 200,
      render: (row) => <span className="normal-case">{row.file_name || "-"}</span>,
    },
    { key: "uploaded_on", label: "UPLOADED ON", width: 150, render: (row) => <span>{row.uploaded_on || "-"}</span> },
    { key: "uploaded_by", label: "UPLOADED BY", width: 180, render: (row) => <span>{row.uploaded_by || "-"}</span> },
  ];


  /*
   * A RECORD OPENED from the table: its own form (the same as on ADD DEVICE / ADD SERVER /
   * ADD SOFTWARE), to VIEW first — EDIT opens it to change, UPDATE saves. BACK, or a save,
   * returns here, to the upload card and the table.
   */
  if (opened) {
    const formProps = {
      barColor: "#3482AE",
      editing: opened.record,
      readOnly: opened.readOnly,
      // No EDIT button at all when this person may not change the record (see openRecord).
      onStartEdit: opened.canEdit ? () => setOpened((o) => (o ? { ...o, readOnly: false } : o)) : undefined,
      onClose: closeRecord,
      onSaved: () => {
        closeRecord();
        loadUploaded();
      },
    };
    return (
      <div className="rounded-lg bg-white shadow-md">
        {type === "device" ? (
          <AddDevice {...formProps} />
        ) : type === "server" ? (
          <AddServer {...formProps} />
        ) : (
          <AddSoftware {...formProps} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* The upload card — white, as in Payroll (no title bar: the chosen tab says which register). */}
      <div className="rounded-lg bg-white p-8 shadow-md">
        {/*
          * THE PAYROLL BULK UPLOAD LAYOUT, in one centred card:
          *   1. DOWNLOAD … TEMPLATE — a full-width green button;
          *   2. a dashed drop area: the Excel icon and SELECT FILE, then the chosen file (name, size, ×);
          *   3. UPLOAD FILE — full width, once a file is chosen, with a spinner while it uploads.
          * The rows are still checked as soon as the file is chosen (the boxes and table below).
          */}
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={preparing}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-green-500 px-6 py-4 text-white shadow-md transition-all hover:bg-green-600 disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            <span className="text-[15px] font-semibold">
              {preparing ? "Preparing Template..." : `Download ${config.title} Template`}
            </span>
          </button>

          <div className="mt-6 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <FileSpreadsheet className="mx-auto mb-4 h-14 w-14 text-gray-400" strokeWidth={1.25} />
            <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={importing}
              className="rounded-lg bg-[#3482AE] px-6 py-3 text-[13px] font-semibold text-white shadow-md transition-all hover:brightness-95 disabled:opacity-60"
            >
              Select File
            </button>

            {fileName && (
              <div className="mx-auto mt-4 flex max-w-md items-start justify-between gap-3 rounded-lg bg-gray-50 p-4 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-700">
                    <span className="font-semibold">Selected file:</span>{" "}
                    <span className="normal-case">{fileName}</span>
                  </p>
                  {fileSize != null && (
                    <p className="mt-1 text-xs text-gray-500">Size: {(fileSize / 1024).toFixed(2)} KB</p>
                  )}
                </div>
                <button type="button" onClick={reset} title="Remove this file" className="text-gray-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Once a file is chosen: what it would upload (new rows with no errors). */}
          {fileName && !imported && (
            <button
              type="button"
              onClick={onImport}
              disabled={importing || ready.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-[#3482AE] px-6 py-4 text-white shadow-md transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span className="text-[15px] font-semibold">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span className="text-[15px] font-semibold">
                    {ready.length > 0
                      ? `Upload File (${ready.length} row${ready.length === 1 ? "" : "s"})`
                      : "Nothing to upload — fix the rows below"}
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/*
          * Every row — this file's and every one uploaded before — in the project's own table:
          * search, filters, column chooser, and EXCEL / PDF / PRINT of exactly what is shown.
          */}
        {/*
          * ROWS TO FIX, said up front — the table has no row number or message column, so
          * EVERY row to fix is listed here with its reason (scrolls when long).
          */}
        {(() => {
          const toFix = rows.filter((r) => r.errors.length || (r.result && !r.result.success));
          const nameOf = (r) => r.values.name ?? r.values.server_name ?? r.values.product_name ?? "";
          /*
           * ALREADY ADDED (devices, servers): never uploaded again — each named, with its
           * Reference No, so it is plain why that row is left out.
           */
          const skipped = rows.filter((r) => r.skip && !r.result);
          /*
           * One short line per row: "MAINT703 is already in Open Devices — you can't upload it
           * again. Reference No DE26MAINT703280" — the Reference No a link that opens the device
           * (the server's name for a server). The other rows upload as usual.
           */
          const linkCls = "normal-case font-semibold text-[#3482AE] underline hover:text-[#2a6d8f] disabled:opacity-50";
          const skippedLine = (r) => {
            const name = <span className="normal-case font-semibold">{nameOf(r) || `Excel row ${r.rowNo}`}</span>;
            if (type === "device") {
              const ref = r.skipInfo?.ref ?? r.skip.match(/Reference No ([^)\s]+)/)?.[1] ?? "";
              const holder = r.skipInfo?.holder ?? r.skip.match(/assigned to (.+?) \(/)?.[1] ?? "";
              return (
                <>
                  {name} is already {holder ? <>assigned to <span className="normal-case">{holder}</span></> : "in Open Devices"} —
                  you can&apos;t upload it again.
                  {ref && (
                    <>
                      {" "}Reference No{" "}
                      <button
                        type="button"
                        className={linkCls}
                        disabled={opening}
                        onClick={() =>
                          openRecord({ device_type: r.values.device_type, reference_no: ref, name: r.values.name })
                        }
                      >
                        {ref}
                      </button>
                    </>
                  )}
                </>
              );
            }
            if (type === "server") {
              return (
                <>
                  <button type="button" className={linkCls} disabled={opening} onClick={() => openRecord(r.values)}>
                    {nameOf(r)}
                  </button>{" "}
                  is already added — you can&apos;t upload it again.
                </>
              );
            }
            return <>{name} is already added — you can&apos;t upload it again.</>;
          };
          const skippedNote = skipped.length > 0 && (
            <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-[12px] text-gray-700">
              {skipped.map((r) => (
                <li key={r.rowNo}>{skippedLine(r)}</li>
              ))}
            </ul>
          );
          if (!toFix.length) return skippedNote || null;
          const why = (r) => (r.errors.length ? r.errors.join("; ") : r.result?.message ?? "Not uploaded");
          return (
            <>
            {skippedNote}
            <div className="mt-3 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {/* Said by its Excel row when there is one — a bare "1 row" read as "row 1". */}
              <p className="font-semibold">
                {toFix.length === 1
                  ? `Excel row ${toFix[0].rowNo} needs fixing before it can be uploaded:`
                  : `${toFix.length} rows need fixing before they can be uploaded (Excel rows ${toFix
                      .slice(0, 10)
                      .map((r) => r.rowNo)
                      .join(", ")}${toFix.length > 10 ? ", …" : ""}):`}
              </p>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
                {toFix.map((r) => (
                  <li key={r.rowNo}>
                    Excel row {r.rowNo}
                    {nameOf(r) ? <> (<span className="normal-case">{nameOf(r)}</span>)</> : ""}: {why(r)}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Fix them in the sheet, then upload the file again.</p>
            </div>
            </>
          );
        })()}

        {/* The earlier uploads could not be loaded: said, with a way to try again. */}
        {uploadedError && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <span>Devices uploaded earlier could not be loaded: {uploadedError}</span>
            <button
              type="button"
              onClick={loadUploaded}
              className="rounded-[3px] bg-[#3482AE] px-3 py-1 text-[11px] font-semibold uppercase text-white hover:bg-[#2a6d8f]"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* The table — its own white card below the upload card, as in Payroll. */}
      {(rows.length > 0 || uploaded.length > 0 || uploadedLoading) && (
        <div className="mt-6 rounded-lg bg-white p-4 shadow-md">
          {/*
            * The file just chosen is listed first, shaded light amber — NOT UPLOADED YET —
            * so it is never mistaken for a row uploaded before (those are white).
            */}
          {tableData.some((r) => String(r.id).startsWith("new-")) && (
            <p className="mb-2 flex items-center gap-2 text-[12px] text-gray-600">
              <span className="inline-block h-3 w-3 rounded-sm border border-amber-300 bg-[#fff7e0]" />
              Shaded rows are from the file you just chose — <b>not uploaded yet</b>. White rows were uploaded before.
            </p>
          )}
          <DataTable
            data={tableData}
            columns={tableColumns}
            loading={uploadedLoading && !rows.length}
            reportTitle={`${config.title} Bulk Upload`}
            exportsInToolbar
            getRowClassName={(row) => (String(row.id).startsWith("new-") ? "dt-row-pending" : "")}
          />
        </div>
      )}
    </div>
  );
}
