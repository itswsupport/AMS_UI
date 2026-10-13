import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Laptop master — db_asset.ams_laptop_master, via /laptop/* on the backend.
 *
 * Every device type has its own table, entity, service and endpoints, so nothing here is
 * shared with the other types. The Warranty screen calls whichever of them matches the
 * device type that was chosen.
 *
 * Rows come back as { id, name, create_date, create_time, status } — "name" is the device
 * number written on the machine.
 */
export const getLaptopList = () => apiGet("laptop/list");
export const saveLaptop = (data) => apiPost("laptop/save", data);
export const updateLaptop = (data) => apiPost("laptop/update", data);
export const deleteLaptop = (id) => apiDelete("laptop/delete", { id });
