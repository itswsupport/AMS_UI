import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Download an array of row objects as an .xlsx file. */
export function exportToExcel(rows, fileName = "export", sheetName = "Sheet1") {
  const sheet = XLSX.utils.json_to_sheet(rows || []);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName + ".xlsx");
}

/** Download an array of row objects as a landscape PDF table. */
export function exportToPdf(rows, columns, fileName = "export", title = "") {
  const doc = new jsPDF({ orientation: "landscape" });
  if (title) doc.text(title, 14, 14);
  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: (rows || []).map((r) => columns.map((c) => r[c.key] ?? "")),
    startY: title ? 20 : 14,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [52, 130, 174] },
  });
  doc.save(fileName + ".pdf");
}
