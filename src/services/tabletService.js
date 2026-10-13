import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Tablet master — db_asset.ams_tablet_master, via /tablet/* on the backend.
 *
 * Every device type has its own table, entity, service and endpoints, so nothing here is
 * shared with the other types. The Warranty screen calls whichever of them matches the
 * device type that was chosen.
 *
 * Rows come back as { id, name, create_date, create_time, status } — "name" is the device
 * number written on the machine.
 */
export const getTabletList = () => apiGet("tablet/list");
export const saveTablet = (data) => apiPost("tablet/save", data);
export const updateTablet = (data) => apiPost("tablet/update", data);
export const deleteTablet = (id) => apiDelete("tablet/delete", { id });
