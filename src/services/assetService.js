import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * The asset register — one machine's full record, via /asset/* on the backend.
 *
 * Keyed on device_id, which is an id from the device master. EVERY device the admin adds
 * there works: the backend keeps all machines in one table with device_id on the row, so
 * there is no list of supported types on either side and nothing to filter the device
 * dropdown against.
 *
 * Not to be confused with desktopService.js / laptopService.js / printerService.js, which are
 * the older per-type lists and are not used by any screen.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
/**
 * The machines of one device type.
 *
 * By default only the ones ADDED through ADD DEVICE — that is what LIST DEVICE shows. The 656
 * rows carried over from the asset workbook are bare names, and listing them alongside real
 * entries would bury what was actually filled in.
 *
 * includeImported brings those back, and is what the ADD DEVICE form asks for: its Model and
 * Device Name dropdowns are the whole catalogue of machines the company owns, and it has to
 * see every name to know which are already taken.
 */
export const getAssetList = (deviceId, includeImported = false) =>
  apiGet("asset/list", { device_id: deviceId, include_imported: includeImported });
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
