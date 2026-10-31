"use client";

import Select, { components as rsComponents } from "react-select";
import { nativeSelectStyles, nativeSelectComponents } from "@/components/masters/nativeLikeSelect";

/*
 * THE CHECKBOX PICKER (Login Access's Plant, Device Type and Role; Department Master's Company
 * and Plant) — one or many, kept to ONE LINE like every other field: the box shows a summary
 * ("1001, 1002, 1003 +15 more", or "All plants (18)") instead of a tag per choice, and the
 * list shows a checkbox beside each, with "All" after the last one.
 * Defined at module level so the open list is not rebuilt (and does not flicker) on a re-render.
 */

/** The "All" entry at the END of the list (after the last choice): ticks or clears every one. */
const ALL = "__ALL__";

/** "1001, 1002, 1003 +15 more" — the first few, then how many more; "All plants (18)" for all. */
export const summarisePlants = (codes, total, noun = "plants") => {
  if (!codes.length) return "";
  if (total > 1 && codes.length === total) return `All ${noun} (${total})`;
  const shown = codes.slice(0, 3).join(", ");
  return codes.length > 3 ? `${shown} +${codes.length - 3} more` : shown;
};

/** A choice in the list: a checkbox, ticked when chosen, and its label. */
const CheckOption = (props) => (
  <rsComponents.Option {...props}>
    <span className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={props.isSelected}
        readOnly
        tabIndex={-1}
        className="pointer-events-none h-3.5 w-3.5 accent-[#3482AE]"
      />
      {props.label}
    </span>
  </rsComponents.Option>
);

const checkSelectComponents = { ...nativeSelectComponents, Option: CheckOption };

const checkSelectStyles = {
  ...nativeSelectStyles,
  // The summary is the value, so it reads as normal text, cut with "…" if it is too long.
  placeholder: (base, state) => ({
    ...base,
    color: state.selectProps.pickedCount ? "#111827" : "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  // A light tint for a ticked choice — the checkbox already says it is chosen.
  option: (base, state) => ({
    ...nativeSelectStyles.option(base, state),
    backgroundColor: state.isFocused && !state.isDisabled ? "#eef4f8" : "#ffffff",
    // A choice that cannot be ticked now (Viewer with Admin / User) reads as greyed out.
    color: state.isDisabled ? "#9ca3af" : state.data.value === ALL ? "#3482AE" : "#111827",
    cursor: state.isDisabled ? "not-allowed" : base.cursor,
    fontWeight: state.isSelected || state.data.value === ALL ? 600 : 400,
    // "All" sits under the last choice, set apart by a line.
    borderTop: state.data.value === ALL ? "1px solid #e5e7eb" : base.borderTop,
  }),
};

/**
 * One checkbox picker: `options` [{ value, label, search? }], `values` the chosen values,
 * `onChange(values)`. "All" after the last option ticks every one; unticking it clears them.
 * `noun` names them in the summary ("All device types (4)").
 */
export default function CheckMultiSelect({
  options, values, onChange, noun, placeholder, isDisabled = false, showAll = true, isOptionDisabled,
}) {
  const picked = options.filter((o) => values.includes(o.value));
  const allOption = { value: ALL, label: "All", search: "all" };
  // Roles have no "All": Viewer is never combined with the others.
  const allPicked = showAll && options.length > 0 && picked.length === options.length;
  return (
    <Select
      isMulti
      options={options.length ? (showAll ? [...options, allOption] : options) : []}
      value={allPicked ? [...picked, allOption] : picked}
      onChange={(opts, meta) => {
        if (meta?.option?.value === ALL) {
          onChange(meta.action === "select-option" ? options.map((o) => o.value) : []);
          return;
        }
        onChange((opts ?? []).filter((o) => o.value !== ALL).map((o) => o.value));
      }}
      isDisabled={isDisabled}
      // A choice that cannot go with what is ticked (Viewer with Admin / User) is greyed out.
      isOptionDisabled={isOptionDisabled}
      // The summary stands in for the tags (shown through the placeholder).
      controlShouldRenderValue={false}
      placeholder={summarisePlants(picked.map((o) => o.label), options.length, noun) || placeholder}
      hideSelectedOptions={false}
      closeMenuOnSelect={false}
      isClearable={false}
      backspaceRemovesValue={false}
      // Matches `search` when an option has one (a plant's hidden name), else its label.
      filterOption={(option, input) =>
        !input ||
        (option.data.search ?? String(option.label).toLowerCase()).includes(input.trim().toLowerCase())
      }
      pickedCount={picked.length}
      menuPlacement="bottom"
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      components={checkSelectComponents}
      styles={checkSelectStyles}
    />
  );
}
