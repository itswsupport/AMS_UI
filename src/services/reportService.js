import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

// Read-only reporting endpoints.
export const getAssetRegister = (params) => apiGet("report/asset_register", params);
export const getDepartmentWiseReport = (params) => apiGet("report/department_wise", params);
export const getAllocationReport = (params) => apiGet("report/allocation", params);
export const getMaintenanceReport = (params) => apiGet("report/maintenance", params);
export const getDashboardSummary = () => apiGet("report/summary");
