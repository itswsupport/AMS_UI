import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Desktop master — db_asset.ams_desktop_master, via /desktop/* on the backend.
 *
 * Every device type has its own table, entity, service and endpoints, so nothing here is
 * shared with the other types. The Warranty screen calls whichever of them matches the
 * device type that was chosen.
 *
 * Rows come back as { id, name, create_date, create_time, status } — "name" is the device
 * number written on the machine.
 */
export const getDesktopList = () => apiGet("desktop/list");
export const saveDesktop = (data) => apiPost("desktop/save", data);
export const updateDesktop = (data) => apiPost("desktop/update", data);
export const deleteDesktop = (id) => apiDelete("desktop/delete", { id });
