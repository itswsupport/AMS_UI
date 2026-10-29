import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Device master — db_asset.ams_device_master, via /device/* on the backend.
 *
 * Its own file because the device master is its own entity end to end: DeviceMaster,
 * DeviceMasterRepository, DeviceService, DeviceController, DeviceMasterPanel.
 *
 * save and update take { device_type_id, device_number, system_type, warranty_status,
 * last_date_of_warranty, total_warranty_years, status }. They do NOT take age — the server
 * works that out from the end date and the term, because it changes on its own as months pass.
 *
 * delete does not remove the row; the backend sets status = -1, so any asset already
 * referencing this device still resolves.
 */
export const getDeviceList = () => apiGet("device/list");
export const saveDevice = (data) => apiPost("device/save", data);
export const updateDevice = (data) => apiPost("device/update", data);
export const deleteDevice = (id) => apiDelete("device/delete", { id });
