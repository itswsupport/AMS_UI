import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Device name master — db_asset.ams_device_name_master, via /devicename/* on the backend.
 *
 * A named machine sits at the end of a chain: it is a MODEL, which is of a DEVICE. So save
 * takes { device_id, model_id, device_name, description, status }, and the listing returns
 * device and model_name resolved from those two ids.
 *
 * The device and model lists themselves come from deviceService and modelService — this file
 * does not duplicate either.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getDeviceNameList = () => apiGet("devicename/list");
export const saveDeviceName = (data) => apiPost("devicename/save", data);
export const updateDeviceName = (data) => apiPost("devicename/update", data);
export const deleteDeviceName = (id) => apiDelete("devicename/delete", { id });
