import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Category master — db_asset.ams_category_mst and db_asset.ams_plant_category.
 *
 * Two tables, one screen, so both live here:
 *
 *   ams_category_mst    the independent list — IT, HR, OPERATIONS. Belongs to no company
 *                       and no plant, which is why getCategoryList takes no arguments.
 *   ams_plant_category  records that one of those categories applies at a given company's
 *                       plant. This is what the Category panel adds, edits and removes.
 *
 * getCategoryList is imported by SubCategoryMasterPanel and ReportingPersonPanel too — they
 * need the same list for their dropdowns, and the category is owned here rather than copied
 * into each of their service files.
 *
 * delete retires the row (status = 0) rather than removing it, so anything already pointing
 * at it still resolves.
 */
export const getCategoryList = () => apiGet("category/list");

export const getPlantCategoryList = () => apiGet("plantcategory/list");
export const savePlantCategory = (data) => apiPost("plantcategory/save", data);
export const updatePlantCategory = (data) => apiPost("plantcategory/update", data);
export const deletePlantCategory = (id) => apiDelete("plantcategory/delete", { id });
