import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * The server register — one server's full record, via /serverasset/* on the backend, over
 * db_asset.ams_server_with_ip_master.
 *
 * Not to be confused with serverService.js, which is the thin ADMIN master of server names
 * on the Setting page and talks to /server/*. Two different things over two different
 * tables: that one is the list of servers that exist, this is everything known about each.
 *
 * delete does not remove the row; the backend sets status = -1.
 */
export const getServerAssetList = () => apiGet("serverasset/list");
export const saveServerAsset = (data) => apiPost("serverasset/save", data);
export const updateServerAsset = (data) => apiPost("serverasset/update", data);
export const deleteServerAsset = (id) => apiDelete("serverasset/delete", { id });
/** One server's USER LOG (ams_server_user_log): every field an UPDATE changed, newest first. */
export const getServerChangeLog = (serverId) => apiGet("serverasset/changelog", { server_id: serverId });
