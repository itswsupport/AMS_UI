"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
/*
 * getPlantCategoryList, NOT getCategoryList.
 *
 * This is the whole reason the two screens used to disagree. getCategoryList returns every
 * row of ams_category_mst — IT, HR, OPERATIONS — whether or not it has ever been added on
 * the Category Master screen. So HR could be offered here and picked, while the Category
 * Master table showed no HR at all.
 *
 * Reading the exact rows that screen displays makes that impossible: the dropdown is built
 * from the same data, so it cannot list a category the screen does not show.
 */
import { getPlantCategoryList } from "@/services/categoryService";
import {
  getSubCategoryList,
  saveSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "@/services/subCategoryService";
import { confirmDelete, deletedToast, warnAlert, savedToast } from "@/lib/confirmDelete";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * Sub category master, rendered inline under the Setting cards.
 *
 *   Category      a dropdown of every active row in db_asset.ams_category_mst — the same
 *                 independent list the Category panel uses
 *   Sub category  typed by the admin, since the possible names are open-ended (Laptop,
 *                 Desktop, Printer, Chair …) in a way the three categories are not
 *
 * SAVE writes to db_asset.ams_sub_category_mst, storing category_id rather than the category
 * name, so renaming a category later carries through automatically.
 */
export default function SubCategoryMasterPanel({ barColor }) {
  // Hidden until ADD asks for it.
  const [showForm, setShowForm] = useState(false);

  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadError, setLoadError] = useState("");

  // null while adding; holds the row id while editing.
  const [editingId, setEditingId] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryName, setSubCategoryName] = useState("");
  const [description, setDescription] = useState("");
  // 1 = active, 0 = inactive. -1 (deleted) is never set from this form.
  const [status, setStatus] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /*
   * BaseResponseBO always answers HTTP 200, so fetch never throws on a rejected call —
   * status_code in the body is the real outcome and has to be checked.
   */
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  // Re-read from the server rather than pushing the saved row into local state: the server
  // owns the real id, and a reload is the only way the list matches what another admin sees.
  const loadRows = useCallback(() => {
    setLoadingRows(true);
    return getSubCategoryList()
      .then((res) => setRows(unwrap(res) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /*
   * The dropdown list, derived from the Category Master rows.
   *
   * That screen holds one row per company + plant + category, so the same category appears
   * several times — RUCHA 1003 → IT and RUCHA 1004 → IT are two rows, one category. They are
   * collapsed to distinct categories here, because a sub category belongs to the category
   * itself, not to a particular plant's copy of it.
   *
   * Active and inactive both count. An inactive category is switched off, not removed, and
   * its sub categories must survive so they come back with it — the backend's listing applies
   * the same rule, so the two agree.
   */
  useEffect(() => {
    getPlantCategoryList()
      .then((res) => {
        const list = unwrap(res);
        if (!list) {
          setLoadError("Could not load the category list.");
          return;
        }

        const seen = new Map();
        list.forEach((row) => {
          if (row.category_id != null && !seen.has(row.category_id)) {
            seen.set(row.category_id, {
              id: row.category_id,
              category_name: row.category_name,
            });
          }
        });
        setCategories([...seen.values()].sort((a, b) =>
          String(a.category_name).localeCompare(String(b.category_name))
        ));
      })
      .catch(() => setLoadError("Could not reach the server."));
  }, []);

  const clearFields = () => {
    setEditingId(null);
    setCategoryId("");
    setSubCategoryName("");
    setDescription("");
    setStatus(1);
    setError("");
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    setCategoryId(String(row.category_id));
    setSubCategoryName(row.sub_category_name);
    setDescription(row.description ?? "");
    setStatus(row.status ?? 1);
    setError("");
    setShowForm(true);
  };

  const onDelete = async (row) => {
    const confirmed = await confirmDelete(
      "Delete sub category?",
      `"${row.sub_category_name}" under ${row.category_name} will be removed.`
    );
    if (!confirmed) return;
    try {
      const res = await deleteSubCategory(row.id);
      if (res?.status_code !== 200) {
        setError(res?.message || "Could not delete.");
        return;
      }
      // Editing the row that was just deleted would leave the form pointing at nothing.
      if (editingId === row.id) closeForm();
      await loadRows();
      deletedToast("Sub category deleted");
    } catch {
      setError("Could not reach the server.");
    }
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
    const name = subCategoryName.trim();

    if (!categoryId) return setError("Select a category.");
    if (!name) return setError("Sub category name is required.");

    /*
     * Duplicate check before the round trip, scoped to the chosen category.
     *
     * Scoped, not global: the same sub category name under a DIFFERENT category is perfectly
     * valid — "Chair" can exist under both HR and OPERATIONS — so only a clash within the one
     * category is a duplicate. That matches uk_sub_category, which is UNIQUE on
     * (category_id, sub_category_name) rather than on the name alone.
     *
     * Case-insensitive and trimmed, the same way the backend matches, so "chair", "Chair" and
     * " CHAIR " are one name. The row being edited is skipped so it cannot clash with itself.
     */
    const clash = rows.find(
      (r) =>
        r.id !== editingId &&
        String(r.category_id) === String(categoryId) &&
        String(r.sub_category_name || "").trim().toLowerCase() === name.toLowerCase()
    );

    if (clash) {
      await warnAlert(
        `"${clash.sub_category_name}" is already added`,
        `${clash.category_name} already has a sub category called "${clash.sub_category_name}", ` +
          `added on ${clash.create_date}. Use a different name, or edit the existing row.`
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = { category_id: Number(categoryId), sub_category_name: name, description: description.trim() || null, status };
      // Same form for both; the id is what turns a save into an update.
      const res = editingId
        ? await updateSubCategory({ ...body, id: editingId })
        : await saveSubCategory(body);

      if (res?.status_code !== 200) {
        // The server's own guard — reached when the check above could not see the clash, for
        // instance a row added by another admin since this page loaded.
        await warnAlert("Could not save", res?.message || "The sub category could not be saved.");
        setError(res?.message || "Could not save.");
        return;
      }
      closeForm();
      await loadRows();
      savedToast(editingId ? "Sub category updated" : "Sub category added");
    } catch {
      await warnAlert("Could not reach the server", "Check the connection and try again.");
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position, so it renumbers
    // itself after sorting or filtering.
    { label: "SR. NO", width: 80 },
    /*
     * Widths on the text columns too: DataTable shares the spare room in proportion to each
     * column's width, so with none here STATUS (110) took nearly all of it and left a wide gap
     * before ACTION. Now the room goes mostly to these, and STATUS stays narrow.
     */
    { key: "category_name", label: "CATEGORY NAME", width: 220 },
    { key: "sub_category_name", label: "SUB CATEGORY NAME", width: 240 },
    {
      key: "description",
      label: "DESCRIPTION",
      width: 320,
      render: (row) => <span>{row.description || "-"}</span>,
    },
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
    /*
     * DataTable treats a column labelled ACTION specially — fixed 90px, no sorting, no
     * filtering, no column menu, and left out of the Excel/PDF/Print exports. No key, so
     * the cell comes entirely from render.
     */
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

  return (
    <div>
      {/* Coloured title bar taking the card's own colour — see the Category panel. */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Sub Category Master
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

      {/* No top margin and no top rounding on the form below: it sits flush under the title
          bar so the two read as one block rather than two floating panels. */}
      <Modal
        open={showForm}
        title={editingId ? "Edit Sub Category" : "Add Sub Category"}
        barColor={barColor}
        onClose={closeForm}
      >
        <form onSubmit={onSubmit} className="p-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loadError && <p className="mb-3 text-sm text-amber-600">{loadError}</p>}

          {/* Without a category there is nothing to attach a sub category to, so say so
              rather than leaving an empty dropdown with no explanation. */}
          {categories.length === 0 && !loadError && (
            <p className="mb-3 text-sm text-amber-600">
              No categories found — add one in Category Master first.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categories.length === 0}
                className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                Sub Category Name <span className="text-red-500">*</span>
              </label>
              <input
                value={subCategoryName}
                onChange={(e) => setSubCategoryName(e.target.value)}
                placeholder="e.g. Laptop"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                maxLength={255}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                Status
              </label>
              <SearchableSelect
                value={status}
                onChange={(e) => setStatus(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </SearchableSelect>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2">
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
            reportTitle="Sub Category Master"
          />
        </div>
    </div>
  );
}
