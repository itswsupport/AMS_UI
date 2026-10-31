import { apiGet, apiPost } from "@/lib/api";

/**
 * Role master — db_asset.ams_role_master, via /role/* on the backend.
 *
 * Admin, User and Viewer are built in; more can be added. save takes { role_name, access_type,
 * description, status } — access_type (ADMIN / USER / VIEWER) is what the role may do, fixed
 * once added. update takes { id, role_name, description, status }. Roles are not deleted from
 * the screen: one no longer wanted is made Inactive. Login Access offers the Active ones and
 * saves them by id.
 */
export const getRoleList = () => apiGet("role/list");
export const saveRole = (data) => apiPost("role/save", data);
export const updateRole = (data) => apiPost("role/update", data);
