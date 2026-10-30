import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Role master — db_asset.ams_role_master, via /role/* on the backend.
 *
 * Admin, User and Viewer are built in; more can be added. save takes { role_name, access_type,
 * description, status } — access_type (ADMIN / USER / VIEWER) is what the role may do, fixed
 * once added. update takes { id, role_name, description, status }. delete works only for an
 * added role no one holds. Login Access offers the Active ones and saves them by id.
 */
export const getRoleList = () => apiGet("role/list");
export const saveRole = (data) => apiPost("role/save", data);
export const updateRole = (data) => apiPost("role/update", data);
export const deleteRole = (id) => apiDelete("role/delete", { id });
