import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Model master — db_asset.ams_model_master, via /model/* on the backend.
 *
 * A model belongs to a device: save takes { device_id, model_name, description, status },
 * and the listing returns device_name resolved from that id.
 *
 * The device list itself comes from deviceService — this file does not duplicate it.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getModelList = () => apiGet("model/list");
export const saveModel = (data) => apiPost("model/save", data);
export const updateModel = (data) => apiPost("model/update", data);
export const deleteModel = (id) => apiDelete("model/delete", { id });
