import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Warranty master — db_asset.ams_warranty_master, via /warranty/* on the backend.
 *
 * The warranty statuses themselves: In Warranty, Out Of Warranty, AMC, EOL. Its own entity,
 * table, service and endpoints, like every other master here.
 *
 * Rows come back as { id, name, create_date, create_time, status } — "name" is the status
 * text. Screens that OFFER a warranty status should show active rows only.
 *
 * delete does not remove the row; the backend sets status = -1, so anything already
 * recording this status still resolves.
 */
export const getWarrantyList = () => apiGet("warranty/list");
export const saveWarranty = (data) => apiPost("warranty/save", data);
export const updateWarranty = (data) => apiPost("warranty/update", data);
export const deleteWarranty = (id) => apiDelete("warranty/delete", { id });
