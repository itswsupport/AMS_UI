import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Operating System master — db_asset.ams_os_master, via /os/* on the backend.
 *
 * Its own file because the OS list is its own entity end to end: OsMaster,
 * OsMasterRepository, OsService, OsController, OsMasterPanel.
 *
 * delete does not remove the row — the backend sets status = -1, so any asset already
 * recording this OS still resolves. list() returns everything but those.
 */
export const getOsList = () => apiGet("os/list");
export const saveOs = (data) => apiPost("os/save", data);
export const updateOs = (data) => apiPost("os/update", data);
export const deleteOs = (id) => apiDelete("os/delete", { id });
