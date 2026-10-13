import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * The shared master reads — the two lists that come from db_all_master rather than from
 * db_asset, and that this application only ever reads.
 *
 * They stay together here because they belong to no one screen: company feeds both the
 * Category and Reporting Person forms, and neither list is maintained in AMS at all. The
 * masters AMS does own each have their own file:
 *
 *   categoryService.js         /category/*, /plantcategory/*   ams_category_mst, ams_plant_category
 *   subCategoryService.js      /subcategory/*                  ams_sub_category_mst
 *   reportingPersonService.js  /reportingperson/*              ams_login_access
 *   ramService.js              /ram/*                          ams_ram_master
 *   processorService.js        /processor/*                    ams_processor_master
 *   hddService.js              /hdd/*                          ams_hdd_master
 *   osService.js               /os/*                           ams_os_master
 */

/**
 * Company/plant rows from db_all_master.company_mst — read-only.
 *
 * One row per company AND plant, so a company appears many times (RUCHA ENGINEERS once per
 * unit). Callers take the distinct company_name values for a Company dropdown and filter
 * the same rows for that company's plants; there is no separate plant endpoint.
 */
export const getCompanyList = () => apiGet("company/list");

/**
 * Active employees from db_all_master.emp_details — read-only, and 851 of them, so the
 * Reporting Person form uses a searchable select rather than a plain dropdown.
 */
export const getEmployeeList = () => apiGet("employee/list");

/** Device Status choices for ADD DEVICE — "In Use", "In Spare". */
export const getDeviceStatusList = () => apiGet("devicestatus/list");

/** Plant-wise departments from db_all_master.plant_dept_mst — read-only. */
export const getDepartmentList = () => apiGet("department/list");

/** Location Master — db_all_master.location_master (company -> plant -> location). */
export const getLocationList = () => apiGet("location/list");
export const saveLocation = (data) => apiPost("location/save", data);

/*
 * ---------------------------------------------------------------------------------------
 * NOT WIRED UP. Everything below is scaffolding from before the masters were built: nothing
 * in src calls any of it, and vendor/list answers 404
 * because no controller exists for them.
 *
 * saveCategory and deleteCategory are the misleading pair — they look like they go with the
 * category master, but that screen uses plantcategory/* in categoryService.js. These two
 * would 404 if anything called them.
 *
 * Kept only so the intended endpoint names are on record; delete when those screens are
 * built for real, or sooner.
 * ---------------------------------------------------------------------------------------
 */

export const saveDepartment = (data) => apiPost("department/save", data);
export const deleteDepartment = (id) => apiDelete("department/delete", { id });

export const saveCategory = (data) => apiPost("category/save", data);
export const deleteCategory = (id) => apiDelete("category/delete", { id });


export const getVendorList = () => apiGet("vendor/list");
export const saveVendor = (data) => apiPost("vendor/save", data);
export const deleteVendor = (id) => apiDelete("vendor/delete", { id });
