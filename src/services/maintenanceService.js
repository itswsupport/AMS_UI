import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

// Service tickets against an asset.
export const getMaintenanceList = (params) => apiGet("maintenance/list", params);
export const getMaintenanceByAsset = (assetId) => apiGet("maintenance/by_asset", { assetId });
export const getMaintenanceHistory = (params) => apiGet("maintenance/history", params);
export const raiseServiceRequest = (data) => apiPost("maintenance/save", data);
export const updateMaintenance = (data) => apiPut("maintenance/update", data);
export const closeMaintenance = (id) => apiPost("maintenance/close", { id });
