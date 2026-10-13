import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

// User administration - ADMIN only.
export const getUserList = (params) => apiGet("user/list", params);
export const getUserById = (id) => apiGet("user/by_id", { id });
export const saveUser = (data) => apiPost("user/save", data);
export const updateUser = (data) => apiPut("user/update", data);
export const deleteUser = (id) => apiDelete("user/delete", { id });
export const assignRole = (data) => apiPost("user/assign_role", data);
