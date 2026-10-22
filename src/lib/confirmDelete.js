import Swal from "sweetalert2";

/**
 * "Are you sure?" before a delete.
 *
 * SweetAlert2 rather than window.confirm: the native dialog cannot be styled, shows the page
 * URL as its heading, and is suppressed entirely by some browsers when it fires outside a
 * direct click handler.
 *
 * Cancel is the default focus. A destructive dialog should never be dismissable by pressing
 * Enter out of habit.
 *
 * @returns true only when the user actually pressed Delete.
 */
export async function confirmDelete(title = "Are you sure?", text = "This cannot be undone.") {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, delete it",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#e74c3c",
    cancelButtonColor: "#6b7280",
    // The action first, Cancel beside it — the same order in every dialog of the app.
    focusCancel: true,
  });
  return result.isConfirmed;
}

/** Brief confirmation after a delete succeeds. Auto-dismisses; nothing to click. */
export function deletedToast(message = "Deleted") {
  return Swal.fire({
    title: message,
    icon: "success",
    timer: 1600,
    showConfirmButton: false,
  });
}

/**
 * A rejected save — most often a duplicate.
 *
 * Deliberately a dialog and not inline red text. The forms on the Setting page put their
 * error line at the very top, so on a three-column form the message can be above the field
 * the user is looking at, and a save that did nothing reads as a save that worked. A dialog
 * has to be dismissed, so the rejection cannot be missed.
 *
 * No timer, unlike deletedToast: this one reports a failure and the user should read it
 * before carrying on.
 */
export function warnAlert(title, text) {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    confirmButtonText: "OK",
    confirmButtonColor: "#3482AE",
  });
}

/**
 * A name typed again that is already in the master and ACTIVE. One button, Cancel: the
 * caller then closes the form and goes back to the list.
 */
export function duplicateAlert(title, text) {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    confirmButtonText: "Cancel",
    confirmButtonColor: "#6b7280",
  });
}

/**
 * A name typed again that is already in the master but INACTIVE: offers to activate that
 * row instead of adding a second one. true only when the user pressed Activate.
 */
export async function confirmActivate(name, what = "record") {
  const result = await Swal.fire({
    title: `"${name}" is already added`,
    text: `This ${what} is already added but it is Inactive. You can simply activate it.`,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Activate it",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#3482AE",
    cancelButtonColor: "#6b7280",
  });
  return result.isConfirmed;
}

/**
 * Leaving a form with changes not saved: true to discard them and leave, false to stay.
 * Stay is the focused, safe choice.
 */
export async function confirmDiscard(
  title = "Discard your changes?",
  text = "You changed this form but did not save. Leave without saving?"
) {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, discard",
    cancelButtonText: "Stay",
    confirmButtonColor: "#e74c3c",
    cancelButtonColor: "#6b7280",
    focusCancel: true,
  });
  return result.isConfirmed;
}

/**
 * "Do you want to update this?" — before an UPDATE, listing exactly what changes:
 * each field FROM its old value TO the new one, and any other step (e.g. an employee
 * assigned). true to go ahead, false to go back to the form. Cancel is the focused choice.
 *
 * @param changes  [{ label, from, to }]
 * @param notes    extra lines, e.g. ["Assign to 101099 - GANESH BARATHE from 10/10/2026"]
 */
export async function confirmUpdate(changes = [], notes = [], what = "this device") {
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const shown = (v) => (String(v ?? "").trim() === "" ? '<span style="color:#9ca3af">—</span>' : esc(v));
  const rows = changes
    .map(
      (c) =>
        `<tr><td style="padding:4px 8px;font-weight:600;color:#3482AE;white-space:nowrap">${esc(c.label)}</td>` +
        `<td style="padding:4px 8px;color:#b91c1c;text-decoration:line-through">${shown(c.from)}</td>` +
        `<td style="padding:4px 4px;color:#6b7280">→</td>` +
        `<td style="padding:4px 8px;color:#15803d;font-weight:600">${shown(c.to)}</td></tr>`
    )
    .join("");
  const table = rows
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left">` +
      `<tr style="background:#f3f4f6"><th style="padding:4px 8px">Field</th><th style="padding:4px 8px">From</th><th></th><th style="padding:4px 8px">To</th></tr>${rows}</table>`
    : "";
  const extra = notes.length
    ? `<ul style="margin-top:8px;font-size:12px;text-align:left;padding-left:18px">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
    : "";
  const result = await Swal.fire({
    title: `Do you want to update ${what}?`,
    html: `<div style="max-height:320px;overflow-y:auto">${table}${extra}</div>`,
    icon: "question",
    width: 640,
    showCancelButton: true,
    confirmButtonText: "Yes, update",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#3482AE",
    cancelButtonColor: "#6b7280",
    focusCancel: true,
  });
  return result.isConfirmed;
}

/**
 * UPDATE in an admin MASTER (RAM, Model, Reporting Person, …): "Do you want to update …?" with
 * every field that changed, FROM the saved row TO what the form now holds — the same dialog as
 * a device update. Nothing changed: says so and sends nothing. true only on "Yes, update".
 *
 * @param original  the row as loaded (the list's own row)
 * @param body      what the form is about to send
 * @param labels    { key: "Label" } — the fields to compare, in this order
 * @param show      { key: (value) => text } — for ids and codes (device_id -> "Laptop")
 * @param what      how the record is named in the title, e.g. 'RAM "16 GB"'
 */
export async function confirmMasterUpdate(original, body, { labels, show = {}, what = "this record" }) {
  const text = (key, v) => {
    if (show[key]) return show[key](v);
    if (key === "status") return Number(v) === 1 ? "Active" : Number(v) === 0 ? "Inactive" : v;
    return Array.isArray(v) ? v.join(", ") : v;
  };
  const norm = (v) => String(v ?? "").trim();
  const changes = Object.entries(labels)
    .map(([key, label]) => ({ label, from: text(key, original?.[key]), to: text(key, body[key]) }))
    .filter((c) => norm(c.from) !== norm(c.to));
  if (!changes.length) {
    await Swal.fire({
      icon: "info",
      title: "Nothing to update",
      text: "No field was changed.",
      confirmButtonColor: "#3482AE",
    });
    return false;
  }
  return confirmUpdate(changes, [], what);
}

/** Brief confirmation after a save succeeds. */
/*
 * "… added successfully" / "… updated successfully" — after EVERY successful save, on the user
 * screens (Add Device, Server, Software) and the admin masters alike. Stays on screen with an
 * OK button so it is not missed; closes by itself after 3 seconds (the bar shows the time left).
 */
/**
 * @param message the title ("Device added successfully")
 * @param details optional lines under it, label → value, e.g. { "Reference No": "DE26QA112118" };
 *                an empty value is left out
 */
export function savedToast(message = "Saved successfully", details = null) {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const lines = Object.entries(details ?? {}).filter(([, v]) => String(v ?? "").trim() !== "");
  return Swal.fire({
    title: message,
    html: lines.length
      ? lines.map(([k, v]) => `<div style="margin:2px 0">${esc(k)}: <b>${esc(v)}</b></div>`).join("")
      : undefined,
    icon: "success",
    confirmButtonText: "OK",
    confirmButtonColor: "#3482AE",
    timer: 3000,
    timerProgressBar: true,
  });
}
