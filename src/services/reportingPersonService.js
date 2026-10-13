import { apiGet, apiPost, apiDelete } from "@/lib/api";

/**
 * Reporting Person — who is responsible for a company + plant + category + sub category,
 * and with which AMS role. Backed by db_asset.ams_login_access via /reportingperson/*.
 *
 * SAVING ALSO GRANTS LOGIN ACCESS, and DELETING REVOKES IT. The assignment and the login
 * row are the same row: the backend writes the chosen role into ams_login_access, and a
 * delete sets that row to status = -1, which is exactly what sign-in checks. So this is not
 * an ordinary master — every call here changes who can get into AMS.
 *
 * The listing resolves each employee's name live from db_all_master.emp_details rather than
 * trusting the name stored on the row, so a correction made in HR shows up here.
 */
export const getReportingPersonList = () => apiGet("reportingperson/list");
export const saveReportingPerson = (data) => apiPost("reportingperson/save", data);

/* Update changes plant, category, sub category, role or status. The employee cannot be
   changed — emp_code is the UNIQUE key login looks up, so a different person is a new row. */
export const updateReportingPerson = (data) => apiPost("reportingperson/update", data);
export const deleteReportingPerson = (id) => apiDelete("reportingperson/delete", { id });
