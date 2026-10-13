"use client";

/**
 * Styling that makes a react-select look like the native <select>s around it.
 *
 * WHY THIS EXISTS. The plant list has to open BELOW its field. A native <select> gives the
 * browser complete control of where its popup goes, and with sixteen plants under RUCHA
 * ENGINEERS the list is taller than the space below the box, so Chrome and Edge draw it
 * upward across the page. No CSS can change that — the popup is not part of the document.
 *
 * react-select renders an ordinary div, so menuPlacement="bottom" can force it below. The
 * cost is that it looks nothing like a native select out of the box: a thicker border, a
 * vertical separator bar, a chevron rather than the native triangle, a clear ×, and a taller
 * control. Everything here removes that difference, so Company (native) and Plant
 * (react-select) sit side by side and read as the same control.
 *
 * Sizing matches `border rounded px-3 py-2 text-sm`, which is what the native selects on
 * these forms use: 38px tall, 4px radius, #d1d5db border.
 */

/**
 * The browser's own dropdown mark, so a react-select sits beside a native <select> without
 * one of them looking wrong.
 *
 * A THIN STROKED CHEVRON, not a filled triangle. Chrome and Edge draw their select arrow
 * this way on Windows, and the earlier solid ▼ here was visibly heavier than the native one
 * — on a form mixing both kinds of control, that difference is the first thing you notice.
 *
 * Stroked rather than filled, with round caps and joins, at the same 1.5 weight the browser
 * uses. react-select's own chevron is larger again, which is why it is replaced rather than
 * restyled.
 */
function NativeArrow() {
  return (
    <svg width="10" height="7" viewBox="0 0 10 7" aria-hidden="true">
      <path
        d="M1 1.5 L5 5.5 L9 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const nativeSelectComponents = {
  // The vertical bar before the arrow. A native select has no such divider.
  IndicatorSeparator: null,
  DropdownIndicator: (props) => (
    <div
      {...props.innerProps}
      style={{ display: "flex", alignItems: "center", padding: "0 10px", color: "#374151" }}
    >
      <NativeArrow />
    </div>
  ),
};

export const nativeSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    height: "38px",
    fontSize: "14px",
    borderRadius: "4px",
    borderColor: "#d1d5db",
    /*
     * A native disabled select greys its background; matching that keeps the two consistent
     * when no company has been picked yet.
     *
     * Read from --ams-disabled-bg so a screen can say what "disabled" means there — a
     * read-only record tints its fields rather than greying them. An inline style is the only
     * way to reach react-select's control, and inline styles can hold a CSS variable; the
     * fallback keeps the old grey anywhere the variable is not set.
     */
    backgroundColor: state.isDisabled ? "var(--ams-disabled-bg, #f3f4f6)" : "#ffffff",
    boxShadow: "none",
    cursor: "pointer",
    "&:hover": { borderColor: "#d1d5db" },
  }),
  valueContainer: (base) => ({ ...base, height: "36px", padding: "0 12px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  // Same weight as the first <option> of a native select, which is ordinary text rather than
  // react-select's lighter placeholder grey.
  placeholder: (base) => ({ ...base, color: "#374151" }),
  singleValue: (base) => ({ ...base, color: "#111827" }),
  indicatorsContainer: (base) => ({ ...base, height: "36px" }),
  // The menu sits on document.body, so it has to out-rank everything the page draws.
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    marginTop: "2px",
    borderRadius: "2px",
    // A native dropdown is a plain bordered box, not a floating rounded card.
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    border: "1px solid #d1d5db",
  }),
  /*
   * 168px — six rows, not ten.
   *
   * These selects are used inside the ADD dialog, whose card is only a few hundred pixels
   * tall. At 260px a sixteen-plant list ran well past the bottom edge of that card and out
   * over the table behind it, which read as broken rather than as a dropdown.
   *
   * The list still scrolls, and typing filters it, so nothing is unreachable — a long list
   * was never meant to be read by scrolling anyway.
   */
  menuList: (base) => ({ ...base, maxHeight: "168px", paddingTop: 0, paddingBottom: 0 }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    padding: "6px 12px",
    cursor: "pointer",
    // The native highlight is a solid grey bar, not a blue tint.
    backgroundColor: state.isSelected ? "#6b7280" : state.isFocused ? "#f3f4f6" : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#111827",
  }),
};
