"use client";

import { Children, isValidElement } from "react";
import Select from "react-select";
import { nativeSelectStyles, nativeSelectComponents } from "@/components/masters/nativeLikeSelect";

/**
 * A searchable drop-in for a native <select>.
 *
 * Written exactly like one — value, onChange, disabled, <option> children — so turning a plain
 * dropdown into a searchable one is a change of tag and nothing else:
 *
 *   <SearchableSelect value={x} onChange={(e) => setX(e.target.value)}>
 *     <option value="">Select Device</option>
 *     {devices.map((d) => <option key={d.id} value={d.id}>{d.device_name}</option>)}
 *   </SearchableSelect>
 *
 * onChange receives { target: { value, name } } with the value as a STRING, the same as a
 * native select, so handlers like `Number(e.target.value)` keep working unchanged.
 *
 * The empty-valued <option> becomes the placeholder, reworded "Select X" -> "Search X..." so the
 * box says it can be typed into; it also makes the field clearable, as picking that option was.
 */

/** The text inside an <option>, however it was written. */
function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

/** "Select Device Type" -> "Search Device Type..."; "Select Model First" stays an instruction. */
function toSearchPlaceholder(label) {
  const text = (label || "").trim();
  if (!text) return "Search...";
  if (/first$/i.test(text)) return text;
  return /^select\s+/i.test(text) ? `${text.replace(/^select\s+/i, "Search ")}...` : text;
}

export default function SearchableSelect({
  value,
  onChange,
  disabled = false,
  name,
  id,
  className = "",
  children,
  placeholder,
  /*
   * How tall the open list may get before it scrolls inside itself, in px. Left out, the
   * shared 168px from nativeSelectStyles applies. Given, it has to replace that menuList rule
   * too — react-select's own maxMenuHeight prop is overridden by the style.
   */
  maxMenuHeight,
  // True draws the border red — a required field left empty.
  invalid = false,
  // Optional (option) => node: draws each option (and the chosen one) as more than plain
  // text, e.g. a coloured badge. Typing still searches the plain label.
  formatOptionLabel,
}) {
  const styles = { ...nativeSelectStyles };
  if (maxMenuHeight) {
    styles.menuList = (base, state) => ({
      ...nativeSelectStyles.menuList(base, state),
      maxHeight: `${maxMenuHeight}px`,
    });
  }
  if (invalid) {
    styles.control = (base, state) => ({
      ...nativeSelectStyles.control(base, state),
      borderColor: "#ef4444",
      "&:hover": { borderColor: "#ef4444" },
    });
  }

  const options = [];
  let emptyLabel = null;

  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const label = textOf(child.props.children);
    const raw = child.props.value !== undefined ? child.props.value : label;
    const v = raw == null ? "" : String(raw);
    if (v === "") {
      emptyLabel = label;
      return;
    }
    options.push({ value: v, label, isDisabled: !!child.props.disabled });
  });

  const current = value == null ? "" : String(value);
  const selected = options.find((o) => o.value === current) ?? null;

  const emit = (v) => onChange?.({ target: { value: v, name }, currentTarget: { value: v, name } });

  // Only width classes carry over; the border and padding come from the shared styles.
  const widthCls = className
    .split(/\s+/)
    .filter((c) => /^(w-|min-w-|max-w-|flex-)/.test(c))
    .join(" ");

  return (
    <div className={widthCls || "w-full"}>
      <Select
        inputId={id}
        name={name}
        options={options}
        value={selected}
        onChange={(opt) => emit(opt ? opt.value : "")}
        isDisabled={disabled}
        isClearable={emptyLabel !== null}
        placeholder={placeholder ?? toSearchPlaceholder(emptyLabel)}
        noOptionsMessage={() => "No match"}
        /* Always below the field, never flipped above it near the bottom of a page — the
           page scrolls to make room instead, the same as the react-selects on the forms. */
        menuPlacement="bottom"
        maxMenuHeight={maxMenuHeight ?? 300}
        formatOptionLabel={formatOptionLabel}
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        components={nativeSelectComponents}
        styles={styles}
      />
    </div>
  );
}
