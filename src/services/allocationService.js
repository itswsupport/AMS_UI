import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

// Assigning assets to employees, and taking them back.
export const getAllocationList = (params) => apiGet("allocation/list", params);
export const getAllocationsByEmployee = (empCode) => apiGet("allocation/by_emp_code", { emp_code: empCode });
export const getAllocationHistory = (assetId) => apiGet("allocation/history", { assetId });
export const allocateAsset = (data) => apiPost("allocation/allocate", data);
export const returnAsset = (data) => apiPost("allocation/return", data);

// Requests raised by a USER and approved by an ADMIN.
export const getRequestList = (params) => apiGet("request/list", params);
export const getMyRequests = (empCode) => apiGet("request/by_emp_code", { emp_code: empCode });
export const raiseRequest = (data) => apiPost("request/save", data);
export const approveRequest = (data) => apiPost("request/approve", data);
export const rejectRequest = (data) => apiPost("request/reject", data);
