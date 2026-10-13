import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * IP address master — db_asset.ams_ip_address_master, via /ipaddress/* on the backend.
 *
 * Rows come back as { id, ip_name, ip_address, description, create_date, create_time,
 * status }. The two stamps are returned but not shown on screen.
 *
 * ip_address is the unique one, so a repeat is refused; ip_name may be anything.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getIpAddressList = () => apiGet("ipaddress/list");
export const saveIpAddress = (data) => apiPost("ipaddress/save", data);
export const updateIpAddress = (data) => apiPost("ipaddress/update", data);
export const deleteIpAddress = (id) => apiDelete("ipaddress/delete", { id });
