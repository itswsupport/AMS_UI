"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil } from "lucide-react";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
import { confirmMasterUpdate, savedToast } from "@/lib/confirmDelete";
import { getRoleList, saveRole, updateRole } from "@/services/roleService";
import SearchableSelect from "@/components/ui/common/SearchableSelect";

/**
 * Role Master — db_asset.ams_role_master. The roles Login Access gives, by id.
 *
 * Admin, User and Viewer are built in; ADD makes more ("Super Admin", "Approval") with just a
 * name and a description — always Active. EDIT can make a role Inactive; only Active roles are
 * offered in Login Access.
 *
 * There is no delete here: a role no longer wanted is made Inactive.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function RoleMasterPanel({ barColor }) {
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  // null while adding; the row while editing.
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRows = useCallback(() => {
    setLoadingRows(true);
    return getRoleList()
      // BaseResponseBO always answers HTTP 200, so status_code in the body is the real outcome.
      .then((res) => setRows(res?.status_code === 200 && Array.isArray(res.response) ? res.response : []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const clearFields = () => {
    setEditing(null);
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
    setEditing(row);
    setName(row.role_name ?? "");
    setDescription(row.description ?? "");
    setStatus(row.status ?? 1);
    setError("");
    setShowForm(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError("Role name is required.");

    setSaving(true);
    setError("");
    try {
      // A new role is always saved Active; only EDIT changes the status.
      const body = { role_name: value, description: description.trim() || null, status: editing ? status : 1 };
      if (editing) {
        // UPDATE asks first, listing each changed field FROM → TO; Cancel sends nothing.
        const ok = await confirmMasterUpdate(editing, body, {
          labels: { role_name: "Role Name", description: "Description", status: "Status" },
          what: `role "${editing.role_name}"`,
        });
        if (!ok) return;
      }
      const res = editing
        ? await updateRole({ ...body, id: editing.id })
        : await saveRole(body);
      if (res?.status_code !== 200) {
        setError(res?.message || "Could not save.");
        return;
      }
      closeForm();
      await loadRows();
      savedToast(`Role ${editing ? "updated" : "added"} successfully`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    // No key: DataTable numbers a "SR. NO" column from the row's position.
    { label: "SR. NO", width: 80 },
    // The role name only — code and access type are kept in the table behind it, not shown.
    { key: "role_name", label: "ROLE NAME" },
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
          {/* Edit only — no delete: a role no longer wanted is made Inactive instead. */}
          <button onClick={() => onEdit(row)} title="Edit" className="text-[#3482AE] hover:text-[#2a6d8f]">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const labelCls = "text-sm font-semibold text-[#3482AE] uppercase block mb-1";
  // Same box as the Status select (SearchableSelect): 38px high, 14px text, #d1d5db border.
  const inputCls =
    "block w-full h-[38px] rounded-[4px] border border-[#d1d5db] bg-white px-3 text-[14px] outline-none focus:border-[#3482AE]";

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
        style={{ backgroundColor: barColor }}
      >
        <h3 className="font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
          Role Master
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

      <Modal open={showForm} title={editing ? "Edit Role" : "Add Role"} barColor={barColor} onClose={closeForm}>
        <form onSubmit={onSubmit} className="p-4 sm:p-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          {/* ADD has no Status — a new role is always Active. EDIT can make it Inactive. */}
          <div className={`grid grid-cols-1 ${editing ? "md:grid-cols-3" : "md:grid-cols-2"} gap-x-4 gap-y-5`}>
            <div>
              <label className={labelCls}>Role Name <span className="text-red-500">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
                placeholder="e.g. IT Support" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note" maxLength={255} className={inputCls} />
            </div>

            {/* relative: the hint hangs below the box, so it does not push the row out of line. */}
            {editing && (
            <div className="relative">
              <label className={labelCls}>Status</label>
              <SearchableSelect
                value={status}
                onChange={(e) => setStatus(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </SearchableSelect>
              <p className="mt-1 text-[11px] text-gray-500 normal-case md:absolute md:left-0 md:top-full md:mt-0.5">
                Inactive roles are not shown in Login Access.
              </p>
            </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded-sm hover:bg-[#2a6d8f] disabled:opacity-50">
              {saving ? "SAVING..." : editing ? "UPDATE" : "SAVE"}
            </button>
            <button type="button" onClick={closeForm}
              className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50">
              CANCEL
            </button>
          </div>
        </form>
      </Modal>

      <div className="mt-2">
        <DataTable data={rows} columns={columns} loading={loadingRows} reportTitle="Role Master" />
      </div>
    </div>
  );
}
