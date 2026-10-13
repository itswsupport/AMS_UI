import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Product master — db_asset.ams_product_master, via /product/* on the backend.
 *
 * Its own entity, table, service and endpoints, like every other master here.
 *
 * Rows come back as { id, name, description, create_date, create_time, status }. The two
 * stamps are returned but the screen does not show them — they are there for an audit.
 *
 * delete does not remove the row; the backend sets status = -1, so anything already
 * recording this product still resolves.
 */
export const getProductList = () => apiGet("product/list");
export const saveProduct = (data) => apiPost("product/save", data);
export const updateProduct = (data) => apiPost("product/update", data);
export const deleteProduct = (id) => apiDelete("product/delete", { id });
