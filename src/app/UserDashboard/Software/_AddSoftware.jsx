"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import Select from "react-select";
import {
  nativeSelectStyles,
  nativeSelectComponents,
} from "@/components/masters/nativeLikeSelect";
import { warnAlert, savedToast, confirmUpdate } from "@/lib/confirmDelete";
import {
  getSoftwareList,
  saveSoftware,
  updateSoftware,
  getSoftwareChangeLog,
} from "@/services/softwareService";
import { useAuth } from "@/context/AuthContext";
import UserLogTable from "@/components/ui/common/UserLogTable";
import { getProductList } from "@/services/productService";
import { getLicenseList } from "@/services/licenseService";
import { softwareErrors, LICENSE_DIGITS } from "@/lib/softwareRules";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * ADD SOFTWARE — one product's licence position.
 *
 * PRODUCT NAME comes from Product Master and LICENSE TYPE from License Master, both as
 * searchable dropdowns and neither typed: a product recorded here has to be one the admin
 * registered, or the register fills with spellings nobody agreed on.
 *
 * One row per product, so a product already recorded is shown in the list but greyed out —
 * change it from LIST SOFTWARE rather than adding it twice.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 * @param onSaved  called after a successful save, so the page can show the list
 * @param editing  a row handed over by the list view, or null to add
 * @param readOnly open to read: every field locked, no save button
 * @param onClose  back to the list
 */

const LABEL_CLS = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
/*
 * Every box 38px high and full width — the same as the dropdowns (nativeLikeSelect, 38px), so
 * text, number, date and dropdown fields line up in one even grid.
 */
const FIELD_CLS =
  "w-full h-[38px] border rounded px-3 py-2 text-sm disabled:bg-[var(--ams-disabled-bg,#f3f4f6)]";
const SELECT_CLS = FIELD_CLS + " ams-select";

/** BACK in a form's title bar: white on the bar's blue, right-hand side. */
const FORM_BACK_CLS =
  "flex items-center gap-1 rounded-[3px] bg-white px-3 py-1 text-[11px] font-semibold uppercase text-[#3482AE] hover:bg-white/90";

/** Fields on a record opened to read: filled in, not editable. */
const VIEW_BG = "#E6F2FF";
const NOT_READY_BG = "#f3f4f6";

const BLANK = {
  product_name: "",
  total_licenses_acquired: "",
  license_excess_deficiency: "",
  license_type: "",
  renewal_date: "",
  description: "",
  status: 1,
};

/** Each field as the form labels it — for the "update FROM → TO" confirmation, in form order. */
const SOFTWARE_LABELS = [
  ["product_name", "Product Name"],
  ["total_licenses_acquired", "Total Licenses Acquired"],
  ["license_excess_deficiency", "License Excess or Deficiency"],
  ["license_type", "License Type"],
  ["renewal_date", "Renewal Date"],
  ["description", "Description"],
  ["status", "Status"],
];

/**
 * Every field that differs between the saved software entry and the form, ONE BY ONE, shown as
 * on the form: the date DD/MM/YYYY, Status Active / Inactive.
 */
function softwareChanges(saved, form) {
  const numeric = ["total_licenses_acquired", "license_excess_deficiency", "status"];
  const show = (k, v) => {
    if (v === null || v === undefined || String(v).trim() === "") return "";
    if (k === "status") return Number(v) === 0 ? "Inactive" : "Active";
    if (k === "renewal_date") return String(v).slice(0, 10).split("-").reverse().join("/");
    return String(v).trim();
  };
  const same = (k, a, b) => {
    if (numeric.includes(k)) {
      const x = a === "" || a == null ? null : Number(a);
      const y = b === "" || b == null ? null : Number(b);
      return x === y;
    }
    return String(a ?? "").trim().slice(0, k === "renewal_date" ? 10 : undefined) ===
      String(b ?? "").trim().slice(0, k === "renewal_date" ? 10 : undefined);
  };
  return SOFTWARE_LABELS.filter(([k]) => !same(k, saved?.[k], form[k])).map(([k, label]) => ({
    label,
    from: show(k, saved?.[k]),
    to: show(k, form[k]),
  }));
}

/** A red message under a field, marked so SUBMIT can scroll to the first one. */
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p role="alert" data-field-error="" className="mt-1 text-[11px] font-semibold text-red-600 normal-case">
      {msg}
    </p>
  );
}

const Req = () => <span className="text-red-500">*</span>;

/** The shared dropdown look with a red border, for a dropdown SUBMIT found wrong. */
const redSelectStyles = {
  ...nativeSelectStyles,
  control: (base, state) => ({
    ...(nativeSelectStyles.control ? nativeSelectStyles.control(base, state) : base),
    borderColor: "#ef4444",
  }),
};

/**
 * A number box that takes WHOLE numbers only: "e", "+", "." and "," are refused as typed (a
 * browser's number box lets them in), and "-" only where a negative is allowed.
 */
const blockKeys = (allowNegative) => (e) => {
  if (["e", "E", "+", ".", ","].includes(e.key) || (!allowNegative && e.key === "-")) e.preventDefault();
};

export default function AddSoftware({
  barColor,
  onSaved,
  editing = null,
  readOnly = false,
  onClose,
  onStartEdit,
}) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** True after SUBMIT is pressed: from then on each field's red message follows what is typed. */
  const [attempted, setAttempted] = useState(false);
  const [loadError, setLoadError] = useState("");
  const { user } = useAuth();

  // The USER LOG of the software entry open (none while adding), loaded from the backend.
  const [changeLog, setChangeLog] = useState([]);
  useEffect(() => {
    const id = editing?.id;
    if (!id) {
      setChangeLog([]);
      return undefined;
    }
    let cancelled = false;
    getSoftwareChangeLog(id)
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

  const [products, setProducts] = useState([]);
  const [licenseTypes, setLicenseTypes] = useState([]);
  const [takenProducts, setTakenProducts] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
    const unwrap = (res) =>
      res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

    // Active only. A product or licence type switched off is out of circulation.
    const active = (list) => (list ?? []).filter((r) => r.status === 1);

    const fail = () => {
      if (!cancelled) setLoadError("Some lists could not be loaded.");
    };

    getProductList()
      .then((res) => !cancelled && setProducts(active(unwrap(res))))
      .catch(fail);
    getLicenseList()
      .then((res) => !cancelled && setLicenseTypes(active(unwrap(res))))
      .catch(fail);

    /*
     * The register itself, only to know which products are already added. Each is still
     * selectable — the same product may be added more than once — and only marked, so the
     * user sees it is already there.
     */
    getSoftwareList()
      .then((res) => {
        if (cancelled) return;
        const list = unwrap(res) ?? [];
        setTakenProducts(
          new Set(list.map((r) => (r.product_name ?? "").trim().toLowerCase()).filter(Boolean))
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
    setForm(filled);
    setError("");
    setAttempted(false);
  }, [editing]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  /**
   * The two licence counts: whole numbers of at most 2 digits (and a leading "-" for Excess /
   * Deficiency). Anything else typed or pasted is dropped, and a third digit is not taken.
   */
  const setCount = (key, allowNegative) => (e) => {
    const raw = String(e.target.value ?? "");
    const minus = allowNegative && raw.trim().startsWith("-") ? "-" : "";
    const digits = raw.replace(/\D/g, "").slice(0, LICENSE_DIGITS);
    setForm((f) => ({ ...f, [key]: minus + digits }));
  };

  /*
   * PRODUCT NAME, from Product Master. Products already on the register are marked "already
   * added" but can still be chosen (a product may be added more than once) — not marked while
   * editing, when the row's own product is on the register by definition.
   *
   * A product no longer in the master is pinned, so opening an old record does not show an
   * empty box and blank it on save.
   */
  const productOptions = useMemo(() => {
    const held = (editing?.product_name ?? "").trim();
    const options = products
      .map((p) => (p.name ?? "").trim())
      .filter(Boolean)
      .map((name) => {
        const taken = !editing?.id && takenProducts.has(name.toLowerCase());
        return { value: name, label: taken ? `${name} — already added` : name, taken };
      });

    if (held && !options.some((o) => o.value.toLowerCase() === held.toLowerCase())) {
      options.unshift({ value: held, label: held, taken: false });
    }
    return options;
  }, [products, takenProducts, editing]);

  const licenseTypeOptions = useMemo(() => {
    const held = (form.license_type ?? "").trim();
    const list = licenseTypes.map((l) => (l.name ?? "").trim()).filter(Boolean);
    if (held && !list.some((v) => v.toLowerCase() === held.toLowerCase())) {
      return [held, ...list].map((v) => ({ value: v, label: v }));
    }
    return list.map((v) => ({ value: v, label: v }));
  }, [licenseTypes, form.license_type]);

  const disabled = readOnly;
  const targetId = editing?.id ?? null;

  const reset = () => {
    setForm(BLANK);
    setError("");
    setAttempted(false);
  };

  /**
   * EVERY CHECK, by field: Product Name required, then the register's rules (lib/softwareRules):
   * both counts whole numbers and filled, Excess not above Total, Renewal Date needed for a
   * Subscription and empty for a Perpetual licence.
   */
  const collectErrors = () => {
    const out = {};
    if (!String(form.product_name ?? "").trim()) out.product_name = "Product Name is required.";
    return { ...out, ...softwareErrors(form) };
  };

  // Shown only once SUBMIT has been pressed, then kept in step with every change.
  const errors = attempted ? collectErrors() : {};

  const onSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;

    setAttempted(true);
    if (Object.keys(collectErrors()).length) {
      setError("");
      setTimeout(() => {
        document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }

    /*
     * "DO YOU WANT TO UPDATE THIS?" — as on ADD DEVICE: before an UPDATE, every field that
     * changes is listed FROM its saved value TO the new one, and nothing is saved until the user
     * says yes. Nothing changed at all: said, and not saved.
     */
    if (targetId) {
      const changes = softwareChanges(editing, form);
      if (!changes.length) {
        await warnAlert("Nothing to update", "You have not changed anything on this software.");
        return;
      }
      if (!(await confirmUpdate(changes, [], `software ${form.product_name || ""}`.trim()))) return;
    }

    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        product_name: form.product_name.trim(),
        // Empty number and date boxes are null, not "" — the columns are INT and DATE.
        total_licenses_acquired:
          form.total_licenses_acquired === "" ? null : Number(form.total_licenses_acquired),
        /*
         * Left signed. A negative figure is a DEFICIENCY, which is the number worth acting
         * on, so unlike the count above there is nothing to refuse.
         */
        license_excess_deficiency:
          form.license_excess_deficiency === "" ? null : Number(form.license_excess_deficiency),
        renewal_date: form.renewal_date || null,
        status: Number(form.status),
        // Who is saving — the backend writes it beside every field this update changes (USER LOG).
        changed_by_code: String(user?.emp_code ?? user?.user_id ?? ""),
        changed_by_name: [user?.userFname, user?.userLname].filter(Boolean).join(" ") || user?.displayName || "",
      };

      const res = targetId
        ? await updateSoftware({ ...body, id: targetId })
        : await saveSoftware(body);

      if (res?.status_code !== 200) {
        await warnAlert("Could not save", res?.message || "The software could not be saved.");
        setError(res?.message || "Could not save.");
        return;
      }

      // Awaited, so the confirmation is seen before the list replaces the form.
      await savedToast(targetId ? "Software updated successfully" : "Software added successfully", {
        "Software Name": res?.response?.product_name || form.product_name.trim(),
      });
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
          {readOnly ? "View Software" : targetId ? "Edit Software" : "Add Software"}
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
        className="bg-white rounded-b-[3px] shadow-sm p-4 sm:p-6"
        style={{ "--ams-disabled-bg": readOnly ? VIEW_BG : NOT_READY_BG }}
      >
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {/* Goes away by itself once every red field is put right. */}
        {Object.keys(errors).length > 0 && (
          <p className="mb-3 text-sm text-red-600">Please correct the fields marked in red.</p>
        )}
        {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL_CLS}>
              Product Name <span className="text-red-500">*</span>
            </label>
            <Select
              options={productOptions}
              value={productOptions.find((o) => o.value === form.product_name) ?? null}
              onChange={(opt) =>
                setForm((f) => ({ ...f, product_name: opt ? opt.value : "" }))
              }
              isDisabled={disabled}
              isClearable
              placeholder="Search Product Name..."
              noOptionsMessage={() => "No product matches that"}
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              styles={errors.product_name ? redSelectStyles : nativeSelectStyles}
            />
            <FieldError msg={errors.product_name} />
            {!disabled && productOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No product has been added. Add one in Product Master first.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>
              Total Licenses Acquired <Req />
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={LICENSE_DIGITS}
              value={form.total_licenses_acquired}
              onChange={setCount("total_licenses_acquired", false)}
              onKeyDown={blockKeys(false)}
              disabled={disabled}
              placeholder="0 to 99"
              className={`${FIELD_CLS}${errors.total_licenses_acquired ? " border-red-500!" : ""}`}
            />
            <FieldError msg={errors.total_licenses_acquired} />
          </div>

          <div>
            <label className={LABEL_CLS}>
              License Excess or Deficiency <Req />
            </label>
            {/* No min: a negative figure is a deficiency, which is the number worth acting
                on. Clamping it at zero would hide exactly the rows that need attention. */}
            <input
              type="text"
              inputMode="numeric"
              maxLength={LICENSE_DIGITS + 1}
              value={form.license_excess_deficiency}
              onChange={setCount("license_excess_deficiency", true)}
              onKeyDown={blockKeys(true)}
              disabled={disabled}
              placeholder="-99 to 99"
              className={`${FIELD_CLS}${errors.license_excess_deficiency ? " border-red-500!" : ""}`}
            />
            <FieldError msg={errors.license_excess_deficiency} />
          </div>

          <div>
            <label className={LABEL_CLS}>License Type</label>
            <Select
              options={licenseTypeOptions}
              value={licenseTypeOptions.find((o) => o.value === form.license_type) ?? null}
              onChange={(opt) =>
                setForm((f) => ({ ...f, license_type: opt ? opt.value : "" }))
              }
              isDisabled={disabled}
              isClearable
              placeholder="Search License Type..."
              noOptionsMessage={() => "No license type matches that"}
              menuPlacement="bottom"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              components={nativeSelectComponents}
              /*
               * A shorter list than the shared 168px (about 3 lines, then it scrolls): License
               * Type is on the form's last row, and the full height hung below the white card.
               * Typing still narrows the list to the one wanted.
               */
              styles={{
                ...nativeSelectStyles,
                menuList: (base, state) => ({
                  ...(nativeSelectStyles.menuList ? nativeSelectStyles.menuList(base, state) : base),
                  maxHeight: "110px",
                }),
              }}
            />
            {!disabled && licenseTypeOptions.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600">
                No license type has been added. Add one in License Master first.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>
              {/* Required only for a Subscription — a Perpetual licence never renews. */}
              Renewal Date {String(form.license_type ?? "").toLowerCase().includes("subscription") && <Req />}
            </label>
            <input
              type="date"
              min="1990-01-01"
              max="2100-12-31"
              value={form.renewal_date}
              onChange={set("renewal_date")}
              disabled={disabled}
              className={`${FIELD_CLS}${errors.renewal_date ? " border-red-500!" : ""}`}
            />
            <FieldError msg={errors.renewal_date} />
          </div>

          <div>
            <label className={LABEL_CLS}>Status</label>
            <SearchableSelect
              value={form.status}
              onChange={set("status")}
              disabled={disabled}
              className={SELECT_CLS}
              // The last field of the form — opens above when there is no room below.
              menuPlacement="auto"
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </SearchableSelect>
          </div>
        </div>

        {/*
          * USER LOG, whenever an existing software entry is open: every field earlier updates
          * changed, before → after, who and when, newest first (ams_software_user_log).
          */}
        {editing?.id && <UserLogTable rows={changeLog} emptyText="No changes recorded for this software yet." />}

        {/*
          * Well below the last row of fields (as on ADD DEVICE): License Type and Status sit on
          * that row, and their open lists (up to ~170px) must stay inside the white card, not
          * hang below it.
          */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 pb-4">
          {readOnly ? (
            <>
              {/* EDIT opens this same record to change; UPDATE then saves it. Own key + click
                  stopped here, so React cannot reuse this <button> as the UPDATE submit button
                  and submit the form unchanged on the same click. */}
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
