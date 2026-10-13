import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Server master — db_asset.ams_server_master, via /server/* on the backend.
 *
 * Its own entity, table, service and endpoints, like every other master here.
 *
 * The screen manages a name, a description and a status. The table also holds the detail
 * imported from the SERVER sheet — IP, plant, department, processor, RAM, disks, OS, owner,
 * warranty — which these endpoints neither send nor change.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getServerList = () => apiGet("server/list");
export const saveServer = (data) => apiPost("server/save", data);
export const updateServer = (data) => apiPost("server/update", data);
export const deleteServer = (id) => apiDelete("server/delete", { id });
