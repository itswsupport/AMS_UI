import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * ASSET ACTION HISTORY — db_asset.ams_asset_action_history, via /assetactionhistory/* .
 *
 * One asset's chain of holders, first to last. Each entry is one handover: who held it, from
 * when to when, who it went to next, and why. A machine that passed between four people is
 * three entries against the one asset id, and the chain is as long as it needs to be.
 *
 * Entries are ADDED as things happen rather than edited; update exists for correcting a
 * mistake, not for rewriting what happened.
 *
 * The employee names are stored alongside their codes, so an entry keeps reading the way it
 * was written even if somebody is renamed in the employee master later.
 *
 * Every write here also restamps the machine's own row — its holder and the four last_action_*
 * columns — so ADD DEVICE's summary never drifts from this log. delete does not remove the
 * row; the backend sets status = -1.
 */
export const getAssetActionHistory = (assetId) =>
  apiGet("assetactionhistory/list", { asset_id: assetId });
export const saveAssetActionHistory = (data) => apiPost("assetactionhistory/save", data);
export const updateAssetActionHistory = (data) => apiPost("assetactionhistory/update", data);
export const deleteAssetActionHistory = (id) =>
  apiDelete("assetactionhistory/delete", { id });
