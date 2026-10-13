import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Printer master — db_asset.ams_printer_master, via /printer/* on the backend.
 *
 * Every device type has its own table, entity, service and endpoints, so nothing here is
 * shared with laptops, desktops or tablets.
 *
 * "name" is the printer number, which is "MODEL - S/N" rather than a bare model: the sheet
 * has seven CANNON IR2006 and six CANON LBP2900B, so the model alone identifies nothing.
 */
export const getPrinterList = () => apiGet("printer/list");
export const savePrinter = (data) => apiPost("printer/save", data);
export const updatePrinter = (data) => apiPost("printer/update", data);
export const deletePrinter = (id) => apiDelete("printer/delete", { id });
