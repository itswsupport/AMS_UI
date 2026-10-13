import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * System type master — db_asset.ams_system_type_master, via /systemtype/* on the backend.
 *
 * The workbook's column X: "64 - Bit", "32 - Bit". These were a list written into the ADD
 * DEVICE form until this master existed, which meant the values people could choose lived in
 * the frontend and could not be maintained by anyone using the application.
 *
 * Its own file because system type is its own entity end to end: SystemTypeMaster,
 * SystemTypeMasterRepository, SystemTypeService, SystemTypeController, SystemTypeMasterPanel.
 *
 * delete does not remove the row — the backend sets status = -1, so any machine already
 * recording this system type still resolves.
 */
export const getSystemTypeList = () => apiGet("systemtype/list");
export const saveSystemType = (data) => apiPost("systemtype/save", data);
export const updateSystemType = (data) => apiPost("systemtype/update", data);
export const deleteSystemType = (id) => apiDelete("systemtype/delete", { id });
