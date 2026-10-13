import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * The software licence register — db_asset.ams_software_master, via /software/* .
 *
 * One row per product: how many licences were acquired, how many over or short, the licence
 * type and the renewal date. The product and the licence type come from Product Master and
 * License Master; this file does not duplicate either.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getSoftwareList = () => apiGet("software/list");
export const saveSoftware = (data) => apiPost("software/save", data);
export const updateSoftware = (data) => apiPost("software/update", data);
export const deleteSoftware = (id) => apiDelete("software/delete", { id });
/** One software entry's USER LOG (ams_software_user_log): every field an UPDATE changed, newest first. */
export const getSoftwareChangeLog = (softwareId) => apiGet("software/changelog", { software_id: softwareId });
