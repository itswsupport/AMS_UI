"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DataTable from "@/components/ui/common/DataTable";
import Modal from "@/components/ui/common/Modal";
import { confirmDelete, deletedToast, confirmMasterUpdate } from "@/lib/confirmDelete";
import {
  getDeviceNameList,
  saveDeviceName,
  updateDeviceName,
  deleteDeviceName,
} from "@/services/deviceNameService";
import { getDeviceList } from "@/services/deviceService";
import { getModelList } from "@/services/modelService";

import SearchableSelect from "@/components/ui/common/SearchableSelect";
/**
 * Device Name Master — its own screen over its own table, db_asset.ams_device_name_master.
 *
 * Talks only to its own endpoints: /devicename/list, /devicename/save, /devicename/update,
 * /devicename/delete. The two dropdowns it fills come from the masters above it.
 *
 * The last step of a three-level chain:
 *
 *   Device Master   desktop                       pick it here
 *   Model Master    desktop + "HP 39373"          pick it here, narrowed to that device
 *   this screen     + "101"                       type it here
 *
 * So a new machine that is a kind nobody has entered yet takes three stops: add the device in
 * Device Master, add its model in Model Master, then name it here. Both appear in these
 * dropdowns as soon as they are saved.
 *
 * The table shows DEVICE, MODEL NAME, DEVICE NAME, DESCRIPTION and STATUS. create_date and
 * create_time are stored on every row but deliberately not shown, the same as every other
 * master here.
 *
 * @param barColor the card's colour, so the bar reads as attached to it
 */
export default function DeviceNameMasterPanel({ barColor }) {
  const title = "Device Name Master";
  const nameLabel = "Device Name";
  const [showForm, setShowForm] = useState(false);

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);

  // null while adding; holds the row id while editing.
  const [editingId, setEditingId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [models, setModels] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [modelId, setModelId] = useState("");
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
    return getDeviceNameList()
      .then((res) => setRows(unwrap(res) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoadingRows(false));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  /*
   * Both dropdown sources, ACTIVE ONLY. /device/list and /model/list each return inactive rows
   * too, because those screens need them visible to switch back on, so the filter is here — a
   * device or model switched off should not be offered for a new machine.
   *
   * The whole model list is fetched once and narrowed in the browser rather than re-fetched
   * per device: it carries device_id on every row already, and these lists are small enough
   * that a round trip on each dropdown change would only add a pause.
   */
  useEffect(() => {
    getDeviceList()
      .then((res) => setDevices((unwrap(res) ?? []).filter((d) => d.status === 1)))
      .catch(() => setError("Could not load the device list."));

    getModelList()
      .then((res) => setModels((unwrap(res) ?? []).filter((m) => m.status === 1)))
      .catch(() => setError("Could not load the model list."));
  }, []);

  // The models of the chosen device, and nothing until one is chosen — offering every model in
  // the system would let a printer's model be picked for a laptop.
  const modelsForDevice = useMemo(
    () => (deviceId ? models.filter((m) => String(m.device_id) === String(deviceId)) : []),
    [models, deviceId]
  );

  /*
   * Changing the device clears the model. The previously chosen model almost certainly belongs
   * to the old device, and leaving it selected would show a name in the box that is no longer
   * in the list below it — the backend would refuse the save, but far better not to offer it.
   */
  const onDeviceChange = (value) => {
    setDeviceId(value);
    setModelId("");
  };

  const clearFields = () => {
    setEditingId(null);
    setDeviceId("");
    setModelId("");
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
    // Set directly rather than through onDeviceChange, which would blank the model.
    setDeviceId(row.device_id != null ? String(row.device_id) : "");
    setModelId(row.model_id != null ? String(row.model_id) : "");
    setName(row.device_name ?? "");
    setDescription(row.description ?? "");
    setStatus(row.status ?? 1);
    setError("");
    setShowForm(true);
  };

  const onDelete = async (row) => {
    const confirmed = await confirmDelete(
      `Delete ${nameLabel.toLowerCase()}?`,
      `"${row.device_name}" will be removed from the ${title.toLowerCase()}.`
    );
    if (!confirmed) return;
    try {
      const res = await deleteDeviceName(row.id);
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
    if (!deviceId) return setError("Select a device.");
    if (!modelId) return setError("Select a model.");
    if (!value) return setError(`${nameLabel} is required.`);

    setSaving(true);
    setError("");
    try {
      const body = {
        device_id: Number(deviceId),
        model_id: Number(modelId),
        device_name: value,
        description: description.trim() || null,
        status,
      };
      // UPDATE asks first, listing each changed field FROM → TO; Cancel sends nothing.
      if (editingId) {
        const original = rows.find((r) => r.id === editingId);
        // Ids shown as names: from the dropdown lists, or the row's own name for one switched off since.
        const nameOf = (list, field, fallback) => (id) =>
          list.find((x) => String(x.id) === String(id))?.[field] ?? fallback(id) ?? id;
        const ok = await confirmMasterUpdate(original, body, {
          labels: { device_id: "Device", model_id: "Model", device_name: nameLabel, description: "Description", status: "Status" },
          show: {
            device_id: nameOf(devices, "device_name", (id) => (String(id) === String(original?.device_id) ? original?.device : null)),
            model_id: nameOf(models, "model_name", (id) => (String(id) === String(original?.model_id) ? original?.model_name : null)),
          },
          what: `${nameLabel} "${original?.device_name ?? value}"`,
        });
        if (!ok) return;
      }
      // Same form for both; the id is what turns a save into an update.
      const res = editingId
        ? await updateDeviceName({ ...body, id: editingId })
        : await saveDeviceName(body);

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
    {
      key: "device",
      label: "DEVICE",
      width: 130,
      render: (row) => <span>{row.device || "-"}</span>,
    },
    {
      key: "model_name",
      label: "MODEL NAME",
      width: 180,
      render: (row) => <span>{row.model_name || "-"}</span>,
    },
    { key: "device_name", label: "DEVICE NAME" },
    {
      key: "description",
      label: "DESCRIPTION",
      render: (row) => <span>{row.description || "-"}</span>,
    },
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
                Device <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={deviceId}
                onChange={(e) => onDeviceChange(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select Device</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.device_name}</option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              {/* Disabled until a device is chosen: the list is empty before then, and a
                  dropdown that opens onto nothing reads as broken. */}
              <SearchableSelect
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={!deviceId}
                className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="">
                  {!deviceId ? "Select Device First" : "Select Model"}
                </option>
                {modelsForDevice.map((m) => (
                  <option key={m.id} value={m.id}>{m.model_name}</option>
                ))}
              </SearchableSelect>
              {deviceId && modelsForDevice.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-600">
                  No models yet. Add one in Model Master first.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-[#3482AE] uppercase block mb-1">
                {nameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 101"
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
