"use client";

import { formatDateForDisplay as fmtDate } from "@/utils/dateUtils";

/**
 * THE USER LOG — every field earlier UPDATEs changed on one record, before → after, with who
 * saved it and when, newest first. The same table as on the device form (Add Device), shared by
 * the Server and Software forms. Rows come from the backend's changelog APIs.
 *
 * @param rows      [{ id, field_name, old_value, new_value, changed_by_code, changed_by_name,
 *                     change_date, change_time }]
 * @param emptyText shown when nothing has been changed yet
 */
export default function UserLogTable({ rows = [], emptyText = "No changes recorded yet." }) {
  return (
    <div className="mt-6">
      <div className="mb-3 border-b pb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">User Log</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-gray-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto rounded-[3px] border">
          <table
            className="w-full border-collapse text-[12px]
              [&_td]:border [&_td]:border-gray-200
              [&_th]:border [&_th]:border-[#2a6d8f]"
          >
            <thead>
              <tr className="bg-[#3482AE] text-left text-white">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Sr No</th>
                <th className="px-3 py-2 font-semibold">Field</th>
                <th className="px-3 py-2 font-semibold">Before</th>
                <th className="px-3 py-2 font-semibold">After</th>
                <th className="px-3 py-2 font-semibold">Changed By</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id ?? i} className="border-b border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-gray-700">{c.field_name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.old_value || "Not set"}</td>
                  <td className="px-3 py-2 text-gray-800">{c.new_value || "Removed"}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {[c.changed_by_code, c.changed_by_name].filter(Boolean).join(" - ") || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                    {fmtDate(c.change_date)} {c.change_time || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
