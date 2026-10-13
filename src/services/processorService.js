import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Processor master — db_asset.ams_processor_master, via /processor/* on the backend.
 *
 * Its own file because the processor list is its own entity end to end: ProcessorMaster,
 * ProcessorMasterRepository, ProcessorService, ProcessorController, ProcessorMasterPanel.
 *
 * delete does not remove the row — the backend sets status = -1, so any asset already
 * recording this processor still resolves. list() returns everything but those.
 */
export const getProcessorList = () => apiGet("processor/list");
export const saveProcessor = (data) => apiPost("processor/save", data);
export const updateProcessor = (data) => apiPost("processor/update", data);
export const deleteProcessor = (id) => apiDelete("processor/delete", { id });
