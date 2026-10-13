import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * License master — db_asset.ams_license_master, via /license/* on the backend.
 *
 * Its own entity, table, service and endpoints, like every other master here.
 *
 * Rows come back as { id, name, description, create_date, create_time, status }. The two
 * stamps are returned but the screen does not show them.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getLicenseList = () => apiGet("license/list");
export const saveLicense = (data) => apiPost("license/save", data);
export const updateLicense = (data) => apiPost("license/update", data);
export const deleteLicense = (id) => apiDelete("license/delete", { id });
