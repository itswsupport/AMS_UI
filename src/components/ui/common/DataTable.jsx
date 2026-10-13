"use client";
import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
// jsPDF is imported inside handlePdfExport, not here — keeps it off every page load.
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridColumnMenuContainer,
  GridColumnMenuSortItem,
  GridColumnMenuColumnsItem,
  GridFilterListIcon,
  useGridApiContext,
  useGridSelector,
  gridSortModelSelector,
  gridVisibleColumnDefinitionsSelector,
  gridDensityFactorSelector,
} from '@mui/x-data-grid';
import { IconButton, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const PAGE_SIZES = [10, 25, 50, 100];
const ACTION_LABELS = ['ACTION', 'DELETE', 'VIEW', 'EDIT'];

const gridTheme = createTheme({
  palette: { primary: { main: '#3482AE' } },
  typography: { fontFamily: 'Exo, sans-serif' },
  zIndex: { modal: 10000, tooltip: 10001 },
});

const GridUICtx = createContext({});

function GridToolbarNoExport() {
  const { isFullscreen, toggleFullscreen, filtersVisible, toggleFilters, hasActiveFilters, hasQuickFilterText, clearFilters, reportDensityFactor, toolbarExports } = useContext(GridUICtx);
  // Open width — applied on focus, and while the box holds text.
  const searchOpen = { width: { xs: 160, sm: 220 } };
  const showCross = filtersVisible || hasActiveFilters;
  const apiRef = useGridApiContext();
  const densityFactor = useGridSelector(apiRef, gridDensityFactorSelector);
  useEffect(() => { reportDensityFactor?.(densityFactor); }, [densityFactor, reportDensityFactor]);
  return (
    <GridToolbarContainer
      sx={{
        justifyContent: 'flex-end',
        gap: { xs: 0.125, sm: 0.5 },
        p: 0.5,
        '& .MuiButton-root': { fontSize: 0, minWidth: 0, p: '6px', color: '#6b7280' },
        '& .MuiButton-startIcon': { m: 0 },
        '& .MuiButton-startIcon > svg, & .MuiButton-endIcon > svg': { fontSize: 20 },
        '& .MuiIconButton-root': { color: '#6b7280' },
        '& .MuiSvgIcon-root': { color: '#6b7280' },
      }}
    >
      {/* exportsInToolbar: Excel / PDF / Print on the left of this row, inside the table's card,
          instead of on their own line above it. marginRight auto pushes the icons right. */}
      {toolbarExports && <div style={{ marginRight: 'auto' }}>{toolbarExports}</div>}
      <GridToolbarQuickFilter
        sx={{
          width: 34,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          ...(hasQuickFilterText ? searchOpen : {}),
          '&:focus-within': searchOpen,
          '& .MuiInput-underline:before': {
            borderBottomColor: hasQuickFilterText ? 'rgba(0,0,0,0.42)' : 'transparent',
          },
          '&:focus-within .MuiInput-underline:before': { borderBottomColor: 'rgba(0,0,0,0.42)' },
          '& .MuiInputBase-root': { minHeight: 30, paddingTop: 0, paddingBottom: 0, width: '100%' },
          '& .MuiInputAdornment-root': { marginRight: hasQuickFilterText ? '8px' : 0 },
          '&:focus-within .MuiInputAdornment-root': { marginRight: '8px' },
          '& .MuiInputBase-input': { paddingTop: '3px', paddingBottom: '3px', fontSize: 13, textTransform: 'uppercase !important' },
          '& input::placeholder': { textTransform: 'uppercase !important', fontSize: 12, opacity: 0.7 },
        }}
      />
      <IconButton
        size="small"
        onClick={hasActiveFilters ? clearFilters : toggleFilters}
        title={hasActiveFilters ? 'Clear filters' : 'Filters'}
        sx={{
          position: 'relative',
          ...(filtersVisible ? { backgroundColor: '#eaf2f8' } : {}),
        }}
      >
        <GridFilterListIcon sx={{ fontSize: 20, color: showCross ? '#3482AE' : '#6b7280' }} />
        {showCross && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 22,
              height: 2,
              backgroundColor: '#6b7280',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              transformOrigin: 'center',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </IconButton>
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
      <IconButton size="small" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} style={{ fontSize: 15, color: '#6b7280' }} />
      </IconButton>
    </GridToolbarContainer>
  );
}

function SortIcon({ field }) {
  const apiRef = useGridApiContext();
  const sortModel = useGridSelector(apiRef, gridSortModelSelector);
  const dir = sortModel.find((s) => s.field === field)?.sort ?? null;
  const sort = (target) => (event) => {
    event.stopPropagation();
    apiRef.current.sortColumn(field, dir === target ? null : target);
  };
  const DARK = '#ffffff';
  const FAINT = 'rgba(255,255,255,0.55)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <i
        className="fas fa-long-arrow-alt-up"
        onClick={sort('asc')}
        title="Sort ascending"
        style={{ fontSize: 8, cursor: 'pointer', color: dir === 'asc' ? DARK : FAINT, marginRight: 1 }}
      />
      <i
        className="fas fa-long-arrow-alt-down"
        onClick={sort('desc')}
        title="Sort descending"
        style={{ fontSize: 8, cursor: 'pointer', color: dir === 'desc' ? DARK : FAINT }}
      />
    </span>
  );
}

function ColumnHeader({ label, field, filterable, sortable }) {
  const { filtersVisible, getColFilter, setColFilter } = useContext(GridUICtx);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, width: '100%' }}>
        <span
          className="dt-col-label"
          style={{ fontWeight: 600, color: '#ffffff', fontSize: 13, lineHeight: 1.2, whiteSpace: 'nowrap' }}
        >
          {label}
        </span>
        {sortable && <SortIcon field={field} />}
      </span>
      {filtersVisible && filterable && (
        <input
          className="dt-col-filter"
          value={getColFilter(field)}
          onChange={(e) => setColFilter(field, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={`Filter by ${label}`}
          style={{
            font: 'inherit', fontSize: 11, fontWeight: 400, padding: '2px 0',
            border: 'none', borderBottom: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 0,
            outline: 'none', width: '100%', background: 'transparent', color: '#ffffff',
          }}
        />
      )}
    </div>
  );
}

function CustomColumnMenu(props) {
  const { revealFilters } = useContext(GridUICtx);
  const filterable = props.colDef?.filterable !== false;
  return (
    <GridColumnMenuContainer {...props}>
      <GridColumnMenuSortItem {...props} onClick={props.hideMenu} />
      {filterable && (
        <MenuItem onClick={(event) => { revealFilters?.(); props.hideMenu?.(event); }}>
          <ListItemIcon><GridFilterListIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Filter</ListItemText>
        </MenuItem>
      )}
      <GridColumnMenuColumnsItem {...props} onClick={props.hideMenu} />
    </GridColumnMenuContainer>
  );
}

// Placeholder rows shown while the list is still on its way. Keeps the grid's
// shape on screen instead of an empty table reading "NO RECORDS FOUND".
const SKELETON_ROWS = 8;
function GridLoadingSkeleton() {
  const apiRef = useGridApiContext();
  const columns = useGridSelector(apiRef, gridVisibleColumnDefinitionsSelector);
  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#fff', zIndex: 5 }}>
      {Array.from({ length: SKELETON_ROWS }).map((_, r) => (
        <div key={r} style={{ display: 'flex', width: '100%', height: 52, alignItems: 'center', borderBottom: '1px solid #f1f3f5' }}>
          {columns.map((col) => (
            <div
              key={col.field}
              style={{
                flex: col.flex ? `${col.flex} 1 0` : `0 0 ${col.computedWidth || col.width || 110}px`,
                minWidth: col.minWidth || 0,
                padding: '0 16px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: '70%', height: 12, borderRadius: 6, backgroundColor: '#e9edf0' }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * @param exportsInToolbar true puts Excel / PDF / Print inside the table's card, on the toolbar
 *                         row above the headings, rather than on their own line above the card.
 *                         Off by default, so every other table keeps its layout.
 * @param exportColumns    optional: the columns Excel, PDF and Print use, in this order,
 *                         instead of the ones on screen — for a report whose layout is fixed
 *                         (LIST DEVICE's Desktop sheet). Same shape as `columns`.
 * @param getRowClassName  optional: (row) => a class for that row; "dt-row-pending" shades it
 *                         light amber (e.g. rows not uploaded yet). Nothing changes without it.
 */
export default function DataTable({
  columns = [], data = [], reportTitle = 'Report', loading = false, exportsInToolbar = false,
  exportColumns = null, getRowClassName = null,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterModel, setFilterModel] = useState({ items: [] });
  const [densityFactor, setDensityFactor] = useState(1);
  const wrapRef = useRef(null);
  const toggleFullscreen = () => setIsFullscreen((f) => !f);
  const toggleFilters = () => setFiltersVisible((v) => !v);
  const getColFilter = (field) => filterModel.items.find((it) => it.field === field)?.value ?? '';
  const setColFilter = (field, value) =>
    setFilterModel((prev) => {
      const items = prev.items.filter((it) => it.field !== field);
      if (value) items.push({ field, operator: 'contains', value, id: field });
      return { ...prev, items };
    });
  // Keeps the search box open once focus moves away.
  const hasQuickFilterText =
    filterModel.quickFilterValues?.some((v) => v != null && v !== '') ?? false;
  // Column filters only — the search box must not light up the filter icon.
  const hasActiveFilters =
    filterModel.items.some((it) => it.value != null && it.value !== '');
  // Clears the column filters only — the search box keeps its text.
  const clearFilters = () =>
    setFilterModel((prev) => ({ items: [], quickFilterValues: prev.quickFilterValues ?? [] }));
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  function getCellValue(row, col, rowIndex) {
    const labelUpper = String(col.label || '').toUpperCase();
    if (labelUpper.includes('SR.NO') || labelUpper.includes('SR. NO') || labelUpper.includes('SR NO')) {
      return String(rowIndex + 1);
    }

    if (col.render && !col.key) {
      try {
        const val = col.render(row, rowIndex);
        if (typeof val === 'string' || typeof val === 'number') return String(val);
      } catch { /* empty */ }
      return '';
    }

    if (col.key) {
      const item = row[col.key];
      if (item && typeof item === 'object') return item.deptName || item.plantName || item.name || '';
      return item ?? '';
    }
    return '';
  }

  /** The plain text inside whatever a column's render returned. */
  function textOf(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (typeof node === 'object' && node.props) {
      // A small function component (a badge, say): run it to reach the text it draws.
      if (typeof node.type === 'function' && !node.type.prototype?.isReactComponent) {
        try { return textOf(node.type(node.props)); } catch { /* fall through */ }
      }
      return textOf(node.props.children);
    }
    return '';
  }

  /*
   * What a cell SHOWS, for Excel, PDF and Print.
   *
   * getCellValue gives the raw field — status 1 / 0 — which is right for sorting but wrong in a
   * file someone reads. When a column has a render, the export takes the text it renders on
   * screen ("Active", "Inactive", "In Use"…), so the file matches what was on the screen.
   */
  function getDisplayValue(row, col, rowIndex) {
    const raw = getCellValue(row, col, rowIndex);
    if (!col.render || !col.key) return raw;
    try {
      const text = textOf(col.render(row, rowIndex)).trim();
      return text !== '' ? text : raw;
    } catch {
      return raw;
    }
  }

  const escapeHtml = (v) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = data.map((row, i) => ({ __idx: i, ...row, id: row.id ?? i }));

  const fieldToCol = {};
  columns.forEach((col, ci) => {
    fieldToCol[col.key ? String(col.key) : `__c${ci}`] = col;
  });

  const activeColItems = filterModel.items.filter((it) => it.value != null && it.value !== '');
  const filteredRows =
    activeColItems.length === 0
      ? rows
      : rows.filter((row) =>
          activeColItems.every((it) => {
            const col = fieldToCol[it.field];
            if (!col) return true;
            const cell = String(getCellValue(row, col, row.__idx) ?? '').toLowerCase();
            return cell.includes(String(it.value).toLowerCase());
          }),
        );

  /*
   * STATUS holds one short word (ACTIVE / INACTIVE), so it is kept at a fixed width rather
   * than stretched — stretching it is what left a wide blank gap between STATUS and ACTION on
   * the masters. The spare room goes to the text columns instead. Only when there is some
   * other column to take that room; otherwise STATUS still stretches so the table fills.
   */
  const isFixedCol = (c) => {
    const label = String(c.label || '').trim();
    return ACTION_LABELS.includes(label.toUpperCase()) || /^sr\.?\s*no\.?$/i.test(label);
  };
  const isStatusCol = (c) => c.key === 'status';
  const otherGrows = columns.some((c) => !isFixedCol(c) && !isStatusCol(c));

  const muiColumns = columns.map((col, ci) => {
    const hasKey = Boolean(col.key);
    const isAction = ACTION_LABELS.includes(String(col.label || '').trim().toUpperCase());
    const field = hasKey ? String(col.key) : `__c${ci}`;
    const filterable = hasKey && col.filterable !== false && !isAction;
    const def = {
      field,
      headerName: col.label || '',
      // Left, not centred: values in a column line up with each other and with the heading,
      // which is what makes a dense list scannable down the page.
      headerAlign: 'left',
      align: 'left',
      sortable: hasKey && !isAction,
      filterable,
      disableColumnMenu: !hasKey || isAction,
      valueGetter: (_value, row) => getCellValue(row, col, row.__idx),
      renderHeader: () => <ColumnHeader label={col.label || ''} field={field} filterable={filterable} sortable={hasKey && !isAction} />,
    };
    const isSrNo = /^sr\.?\s*no\.?$/i.test(String(col.label || '').trim());
    if (col.width && (isAction || isSrNo)) {
      // SR. NO and ACTION keep the caller's width exactly: stretching them only adds blank space.
      def.width = col.width;
    } else if (isStatusCol(col) && otherGrows) {
      // Fixed too — see isStatusCol above. Room for the heading and its icons.
      def.width = Math.max(col.width || 0, 130);
    } else if (col.width) {
      /*
       * The caller's width is the MINIMUM, and the column grows (in proportion to that width)
       * to share any spare room. Fixed widths alone stopped the table short of the right edge
       * on a wide screen, leaving a white gap after ACTION; on a narrow one it still scrolls.
       */
      def.minWidth = col.width;
      def.flex = col.width;
    } else if (isAction) {
      def.width = 90;
    } else {
      // Room for the label, its sort arrows and the menu icon — nothing more, so columns
      // stay narrow and the row does not stretch.
      def.minWidth = Math.max(110, (col.label?.length || 8) * 8 + 50);
      if (col.key === 'status') def.minWidth = Math.max(def.minWidth, 200);
      /*
       * Grows in proportion to its minimum, on the same scale as a column given a width
       * (flex = width). flex: 1 here let a single column with a width take nearly all the
       * spare room — DEVICE (150) against MODEL NAME (1) — leaving one huge column and
       * cramped ones beside it. Now every growing column shares the room evenly.
       */
      def.flex = def.minWidth;
    }
    if (col.render) {
      def.renderCell = (params) => {
        let idx = params.row.__idx ?? 0;
        try {
          const ids = params.api.getSortedRowIds();
          const pos = ids.indexOf(params.id);
          if (pos >= 0) idx = pos;
        } catch { /* empty */ }
        return col.render(params.row, idx);
      };
    }
    return def;
  })
    /*
     * exportOnly columns are left off the screen but kept in Excel, PDF and Print, so a wide
     * register can show a short table and still export every field. Filtered AFTER the map so
     * keyless columns keep the same __c<index> field names fieldToCol was built with.
     */
    .filter((_, ci) => !columns[ci].exportOnly);

  const exportableCols = (exportColumns ?? columns).filter((c) => {
    const lbl = String(c.label || '').trim().toUpperCase();
    return !ACTION_LABELS.includes(lbl) && c.label;
  });


  function handleExcelExport() {
    const headers = exportableCols.map((c) => c.label);
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
          th { background-color: #333399 !important; color: #ffffff !important; font-weight: bold !important; border: 1px solid #000 !important; padding: 8px 12px !important; text-align: center !important; }
          td { border: 1px solid #ccc !important; padding: 8px 12px !important; text-align: center !important; }
          .last-row td { border-bottom: 3px double #000 !important; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${headers.map((h) => `<th bgcolor="#333399" style="background:#333399;color:#ffffff;">${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${data.map((row, rowIndex) => {
              const isLast = rowIndex === data.length - 1;
              return `<tr class="${isLast ? 'last-row' : ''}">${exportableCols.map((col) => `<td>${escapeHtml(getDisplayValue(row, col, rowIndex))}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /*
   * THE REPORT AS A PDF DOCUMENT — built once here and used by both buttons: PDF saves it,
   * Print sends it to the printer. So the paper is exactly what the PDF shows: the title, the
   * date and the table, never the sidebar, header or form around it.
   */
  async function buildPdf() {
    // Loaded on first click only.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const headers = exportableCols.map((c) => c.label);
    const body = data.map((row, rowIndex) =>
      exportableCols.map((col) => String(getDisplayValue(row, col, rowIndex) ?? '')),
    );

    /*
     * A WIDE REGISTER NEEDS A WIDE PAGE. Twenty columns on A4 left autoTable no choice but to
     * squeeze some to a letter or two wide, so "DESKTOP" printed one character per line down
     * the page. More than ten columns go on A3 landscape instead.
     */
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: headers.length > 10 ? 'a3' : 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const MARGIN = 10;
    const PAD = 1.5;

    /*
     * EVERY COLUMN AT LEAST AS WIDE AS ITS LONGEST WORD, so text wraps between words and never
     * inside one. Measured at the font size the table will use; if the columns cannot all fit
     * at that size, the font steps down (not below 6pt) until they do. Capped per column so
     * one very long value cannot take the whole page.
     */
    const longestWord = (text, bold) => {
      doc.setFont('Helvetica', bold ? 'bold' : 'normal');
      return String(text ?? '')
        .split(/\s+/)
        .reduce((max, w) => Math.max(max, doc.getTextWidth(w)), 0);
    };
    const minWidths = (size) => {
      doc.setFontSize(size);
      return headers.map((h, i) => {
        const widest = Math.max(
          longestWord(h, true),
          ...body.map((r) => longestWord(r[i], false)),
        );
        return Math.min(widest + PAD * 2 + 0.5, 45);
      });
    };
    let fontSize = 8;
    let widths = minWidths(fontSize);
    while (fontSize > 6 && widths.reduce((a, b) => a + b, 0) > pageWidth - MARGIN * 2) {
      fontSize -= 0.5;
      widths = minWidths(fontSize);
    }
    const columnStyles = Object.fromEntries(widths.map((w, i) => [i, { minCellWidth: w }]));

    // DD/MM/YYYY, the same as every date shown on screen.
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${now.toLocaleTimeString()}`;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(reportTitle, MARGIN, 15);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated on: ${stamp}`, MARGIN, 22);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      columnStyles,
      styles: {
        fontSize,
        font: 'Helvetica',
        cellPadding: PAD,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      // #333399 — the dark blue of the IT team's register sheet, the same as the Excel export.
      headStyles: { fillColor: [51, 51, 153], textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      // Page 1 starts below the title (startY); later pages start near the top, not 30mm down.
      margin: { top: 12, right: MARGIN, bottom: 15, left: MARGIN },
      // A row is moved whole to the next page rather than split across two.
      rowPageBreak: 'avoid',
      didDrawPage: function () {
        const str = 'Page ' + doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        const size = doc.internal.pageSize;
        const pageHeight = size.height ? size.height : size.getHeight();
        const pageWidth = size.width ? size.width : size.getWidth();
        doc.text(str, pageWidth - 20, pageHeight - 8);
      },
    });
    return doc;
  }

  async function handlePdfExport() {
    const doc = await buildPdf();
    doc.save(`${reportTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  }

  /*
   * PRINT — the same PDF, opened in the browser's own print dialog, so every print option
   * (printer, pages, copies, scale, colour) is still there.
   *
   * The PDF is loaded into a hidden frame and that frame is printed, which prints ONLY the
   * report. window.print() on the page itself printed the whole screen — sidebar, cards, form.
   * If a browser will not print the frame, the PDF opens in a new tab to print from there.
   */
  async function handlePrint() {
    const doc = await buildPdf();
    const url = doc.output('bloburl');

    const frame = document.createElement('iframe');
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    frame.src = url;
    frame.onload = () => {
      // A moment for the PDF viewer inside the frame to finish drawing before printing.
      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch {
          window.open(url, '_blank');
        }
      }, 300);
    };
    document.body.appendChild(frame);

    // Cleared away once the dialog has long since been dealt with.
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  }

  const exportBtnCls =
    'px-4 py-1.5 bg-[#3482AE] hover:bg-[#2A6B91] text-white text-[11px] uppercase rounded-sm border-0 cursor-pointer transition-colors flex items-center gap-1.5';

  const gridBlock = (
        <div
          ref={wrapRef}
          className={`no-print bg-white border border-gray-200 shadow-sm ${
            isFullscreen ? 'fixed inset-0 z-[9998] rounded-none overflow-hidden p-2 flex flex-col' : 'rounded-lg'
          }`}
        >
          <DataGrid
            rows={loading ? [] : filteredRows}
            columns={muiColumns}
            loading={loading}
            showToolbar
            filterModel={{ items: [], quickFilterValues: filterModel.quickFilterValues ?? [] }}
            onFilterModelChange={(m) =>
              setFilterModel((prev) => ({ ...prev, quickFilterValues: m.quickFilterValues ?? [] }))
            }
            columnHeaderHeight={Math.round((filtersVisible ? 72 : 40) / densityFactor)}
            slots={{ toolbar: GridToolbarNoExport, columnMenu: CustomColumnMenu, loadingOverlay: GridLoadingSkeleton }}
            autoHeight={!isFullscreen}
            /* 38 rather than MUI's default 52. The default leaves a lot of empty space
               around a single line of text, so a short list reads as very tall. Divided by
               densityFactor so the density selector still has an effect. */
            rowHeight={Math.round(36 * densityFactor)}
            disableRowSelectionOnClick
            getRowClassName={getRowClassName ? (p) => getRowClassName(p.row) || '' : undefined}
            pageSizeOptions={PAGE_SIZES}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            localeText={{ noRowsLabel: 'NO RECORDS FOUND', noResultsOverlayLabel: 'NO RESULTS FOUND' }}
            sx={{
              border: 'none',
              fontSize: '13px',
              ...(isFullscreen ? { flex: 1, minHeight: 0 } : {}),
              ...(loading ? { '--DataGrid-overlayHeight': `${SKELETON_ROWS * 45}px` } : {}),
              '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': { backgroundColor: '#3482AE' },
              // A row marked by getRowClassName (e.g. not uploaded yet): light amber.
              '& .dt-row-pending': { backgroundColor: '#fff7e0' },
              '& .dt-row-pending:hover': { backgroundColor: '#ffefc2' },
              '& .dt-col-filter::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, color: '#ffffff' },
              '& .MuiDataGrid-columnSeparator': { color: 'rgba(255,255,255,0.4)' },
              '& .MuiDataGrid-menuIcon .MuiSvgIcon-root, & .MuiDataGrid-menuIconButton': { color: '#ffffff' },
              '& .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeaderTitleContainerContent': {
                overflow: 'visible',
              },
              '& .MuiDataGrid-menuIcon': { visibility: 'visible', width: 'auto', opacity: 1 },
              '& .MuiDataGrid-iconButtonContainer': { display: 'none' },
              '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows, & .MuiTablePagination-select, & .MuiTablePagination-input': {
                fontSize: '13px',
              },

              '& .MuiTablePagination-selectLabel': { display: 'block', marginRight: { xs: '2px', sm: 0 } },
              '& .MuiTablePagination-toolbar': { paddingLeft: { xs: '4px', sm: undefined } },
              '& .MuiTablePagination-input': {
                display: 'inline-flex',
                marginRight: { xs: '4px', sm: '32px' },
                marginLeft: { xs: '2px', sm: '8px' },
              },
              '& .MuiTablePagination-actions': { marginLeft: { xs: '6px', sm: '20px' } },
              /* Tighter than MUI's 16px default so more columns fit without scrolling, and
                 the list reads as a dense report rather than a spacious form.

                 display:flex + alignItems:center is what puts a rendered cell on the same
                 line as plain text cells. Without it an ACTION cell's icon buttons sit
                 higher than the row's own text, because the button box is shorter than the
                 line box the text creates. */
              '& .MuiDataGrid-cell': {
                color: '#374151',
                paddingLeft: '10px',
                paddingRight: '10px',
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-columnHeader': { paddingLeft: '10px', paddingRight: '10px' },
              '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
              '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
            }}
          />
        </div>
  );

  const exportButtons = (
    <div className="flex items-center gap-1 no-print">
      <button type="button" onClick={handleExcelExport} className={exportBtnCls}>
        <i className="fas fa-file-excel" /> Excel
      </button>
      <button type="button" onClick={handlePdfExport} className={exportBtnCls}>
        <i className="fas fa-file-pdf" /> PDF
      </button>
      <button type="button" onClick={handlePrint} className={exportBtnCls}>
        <i className="fas fa-print" /> Print
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {!exportsInToolbar && exportButtons}

      <ThemeProvider theme={gridTheme}>
       <GridUICtx.Provider
         value={{ isFullscreen, toggleFullscreen, filtersVisible, toggleFilters, hasActiveFilters, hasQuickFilterText, clearFilters, reportDensityFactor: setDensityFactor, revealFilters: () => setFiltersVisible(true), getColFilter, setColFilter, toolbarExports: exportsInToolbar ? exportButtons : null }}
       >
        {isFullscreen ? createPortal(gridBlock, document.body) : gridBlock}
       </GridUICtx.Provider>
      </ThemeProvider>

      {/* Only for the browser's own Ctrl+P on this page — the PRINT button prints the PDF. */}
      <div className="print-table-container">
        <table className="data-table w-full">
          <thead>
            <tr>
              {exportableCols.map((col) => (
                <th key={col.key || col.label}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={exportableCols.length}>No records found</td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id ?? rowIndex}>
                  {exportableCols.map((col) => (
                    <td key={col.key || col.label}>{getDisplayValue(row, col, rowIndex)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
