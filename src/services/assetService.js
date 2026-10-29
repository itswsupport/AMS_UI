import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * The asset register — one machine's full record, via /asset/* on the backend.
 *
 * Keyed on device_id, which is an id from the device master. EVERY device the admin adds
 * there works: the backend keeps all machines in one table with device_id on the row, so
 * there is no list of supported types on either side and nothing to filter the device
 * dropdown against.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
/**
 * The machines of one device type — every device added through ADD DEVICE or BULK UPLOAD.
 *
 * There is no "include imported" switch any more: the bare names carried over from the old
 * asset workbook are gone from this table (the backend dropped its `source` column), so every
 * row here is a real entry.
 */
export const getAssetList = (deviceId) => apiGet("asset/list", { device_id: deviceId });
export const saveAsset = (data) => apiPost("asset/save", data);
export const updateAsset = (data) => apiPost("asset/update", data);
export const deleteAsset = (id) => apiDelete("asset/delete", { id });

/** The reference number the next machine of this type would get — a preview, nothing reserved. */
export const getNextReference = (deviceId, name) =>
  apiGet("asset/nextreference", { device_id: deviceId, name });

/**
 * DEVICE STATUS — every machine of one type as ASSIGNED or OPEN, with its history. Read only;
 * assigning and releasing go through assetActionHistoryService, as from ADD DEVICE.
 */
export const getDeviceStatus = (deviceId) => apiGet("asset/status", { device_id: deviceId });

/** A machine's CHANGE HISTORY: each field an edit changed, before → after, newest first. */
export const getAssetChangeLog = (assetId) => apiGet("asset/changelog", { asset_id: assetId });
