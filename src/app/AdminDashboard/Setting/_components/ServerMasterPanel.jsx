"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
import { confirmDelete, deletedToast, confirmMasterUpdate } from "@/lib/confirmDelete";
import { getServerList, saveServer, updateServer, deleteServer } from "@/services/serverService";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * Server Master — its own screen over its own table, db_asset.ams_server_master.
 *
 * Talks only to its own endpoints: /server/list, /server/save, /server/update,
 * /server/delete.
 *
 * The table shows PRODUCT NAME, DESCRIPTION and STATUS. create_date and create_time are
 * stored on every row but deliberately not shown, the same as every other master here.
 *
 * Laid out to match Category / Sub Category / Reporting Person — coloured title bar in the
 * card's own colour, ADD on its right, the form flush beneath it, and the list hidden while
 * the form is open.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function ServerMasterPanel({ barColor }) {
  const title = "Server Master";
  const nameLabel = "Server Name";
  const placeholder = "e.g. ESXI01";
  const [showForm, setShowForm] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  // null while adding; holds the row id while editing.
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 1 = active, 0 = inactive. -1 (deleted) is never set from this form.
  const [status, setStatus] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
  const unwrap = (res) =>
    res?.status_code === 200 && Array.isArray(res.response) ? res.response : null;

  // Re-read from the server rather than pushing the saved row into local state: the server
  // owns the real id and create_date, and a reload is the only way the list matches what
  // another admin would see.
  const loadRows = useCallback(() => {
    setLoadingRows(true);
    return getServerList()
      .then((res) => setRows(unwrap(res) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const clearFields = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setStatus(1);
    setError("");
  };

  const openAdd = () => {
    clearFields();
    setShowForm(true);
  };

  const closeForm = () => {
    clearFields();
    setShowForm(false);
  };

  const onEdit = (row) => {
    setEditingId(row.id);
    setName(row.name ?? "");
    setDescription(row.description ?? "");
    setStatus(row.status ?? 1);
    setError("");
    setShowForm(true);
  };

  const onDelete = async (row) => {
    const confirmed = await confirmDelete(
      `Delete ${nameLabel.toLowerCase()}?`,
      `"${row.name}" will be removed from the ${title.toLowerCase()}.`
    );
    if (!confirmed) return;
    try {
      const res = await deleteServer(row.id);
      if (res?.status_code !== 200) {
        setError(res?.message || "Could not delete.");
        return;
      }
      // Editing the row that was just deleted would leave the form pointing at nothing.
      if (editingId === row.id) closeForm();
      await loadRows();
      deletedToast(`${nameLabel} deleted`);
    } catch {
      setError("Could not reach the server.");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError(`${nameLabel} is required.`);

    setSaving(true);
    setError("");
    try {
      const body = { name: value, description: description.trim() || null, status };
      // UPDATE asks first, listing each changed field FROM → TO; Cancel sends nothing.
      if (editingId) {
        const original = rows.find((r) => r.id === editingId);
        const ok = await confirmMasterUpdate(original, body, {
          labels: { name: nameLabel, description: "Description", status: "Status" },
          what: `${nameLabel} "${original?.name ?? value}"`,
        });
        if (!ok) return;
      }
      // Same form for both; the id is what turns a save into an update.
      const res = editingId
        ? await updateServer({ ...body, id: editingId })
        : await saveServer(body);

      if (res?.status_code !== 200) {
        // The duplicate guard lands here, case-insensitively within this master.
        setError(res?.message || "Could not save.");
        return;
      }
      closeForm();
      await loadRows();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position, so it renumbers
    // itself after sorting or filtering.
    { label: "SR. NO", width: 80 },
    { key: "name", label: nameLabel.toUpperCase() },
    { key: "description", label: "DESCRIPTION", render: (row) => <span>{row.description || "-"}</span> },
    {
      key: "status",
      label: "STATUS",
      width: 110,
      render: (row) => <span>{row.status === 1 ? "Active" : "Inactive"}</span>,
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

  return (
    <div>
      {/* Coloured title bar taking the card's own colour, so the open section reads as
          attached to the card above it. */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          {title}
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
        title={editingId ? `Edit ${nameLabel}` : `Add ${nameLabel}`}
        barColor={barColor}
        onClose={closeForm}
      >
        <form onSubmit={onSubmit} className="p-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                {nameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
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

      {/* Always rendered now: the form floats above it rather than replacing it. */}
      <div className="mt-2">
        <DataTable
          data={rows}
          columns={columns}
          loading={loadingRows}
          reportTitle={title}
        />
      </div>
    </div>
  );
}
