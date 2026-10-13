import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * RAM master — db_asset.ams_ram_master, via /ram/* on the backend.
 *
 * Its own file because RAM is its own entity end to end: RamMaster, RamMasterRepository,
 * RamService, RamController, RamMasterPanel. Nothing here is shared with the processor,
 * HDD or OS masters.
 *
 * delete does not remove the row — the backend sets status = -1, so any asset already
 * recording this RAM size still resolves. list() returns everything but those.
 */
export const getRamList = () => apiGet("ram/list");
export const saveRam = (data) => apiPost("ram/save", data);
export const updateRam = (data) => apiPost("ram/update", data);
export const deleteRam = (id) => apiDelete("ram/delete", { id });
