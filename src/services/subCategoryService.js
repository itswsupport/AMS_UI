import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Sub category master — db_asset.ams_sub_category_mst, via /subcategory/* on the backend.
 *
 * Every row belongs to a category, so save takes { category_id, sub_category_name }. The
 * listing carries the category's name along with it, so a table needs no second lookup.
 *
 * The category dropdown itself comes from categoryService.js — this file does not duplicate
 * that call.
 *
 * delete retires the row (status = 0) rather than removing it, so anything already pointing
 * at it still resolves.
 */
export const getSubCategoryList = () => apiGet("subcategory/list");
export const saveSubCategory = (data) => apiPost("subcategory/save", data);
export const updateSubCategory = (data) => apiPost("subcategory/update", data);
export const deleteSubCategory = (id) => apiDelete("subcategory/delete", { id });
