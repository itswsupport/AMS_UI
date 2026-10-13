import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * HDD master — db_asset.ams_hdd_master, via /hdd/* on the backend.
 *
 * Its own file because the HDD list is its own entity end to end: HddMaster,
 * HddMasterRepository, HddService, HddController, HddMasterPanel.
 *
 * delete does not remove the row — the backend sets status = -1, so any asset already
 * recording this disk still resolves. list() returns everything but those.
 */
export const getHddList = () => apiGet("hdd/list");
export const saveHdd = (data) => apiPost("hdd/save", data);
export const updateHdd = (data) => apiPost("hdd/update", data);
export const deleteHdd = (id) => apiDelete("hdd/delete", { id });
