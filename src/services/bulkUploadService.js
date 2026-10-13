import { apiGet, apiPost } from "@/lib/api";

/**
 * BULK UPLOAD — Excel rows sent in one request per register. The backend saves each row
 * through the same save the form uses and answers one result per row, in the order sent:
 * { index, success, message, name, reference_no }.
 *
 * fileHash is the sheet's data fingerprint: the server refuses a sheet already imported.
 */
const withHash = (path, fileHash) => (fileHash ? `${path}?file_hash=${encodeURIComponent(fileHash)}` : path);
export const bulkUploadDevices = (rows, fileHash) => apiPost(withHash("bulk/device", fileHash), rows);
export const bulkUploadServers = (rows, fileHash) => apiPost(withHash("bulk/server", fileHash), rows);
export const bulkUploadSoftware = (rows, fileHash) => apiPost(withHash("bulk/software", fileHash), rows);

/*
 * UPLOADED SHEETS — ams_bulk_upload_log: one record per imported sheet.
 *   checkUploaded  the earlier upload of this sheet, or response null
 *   logUpload      record a sheet after IMPORT (name, fingerprint, counts, the rows saved)
 */
export const checkUploaded = (type, fileHash) => apiGet("bulk/check", { type, file_hash: fileHash });
export const logUpload = (body) => apiPost("bulk/log", body);
/** Every row imported so far for a register, from all its sheets (each with its sheet's name and date). */
export const getUploadedRows = (type) => apiGet("bulk/uploaded", { type });
