import { warnAlert, duplicateAlert, confirmActivate, savedToast } from "@/lib/confirmDelete";

const norm = (v) => String(v ?? "").trim().toLowerCase();

/**
 * Before a master is saved: is the typed name already in its list?
 *
 * Case-insensitive and trimmed, the way the backend matches, so "testing", "Testing" and
 * " TESTING " are one name. The row being edited is skipped so it cannot clash with itself.
 *
 *   ACTIVE match   → "already present", nothing is saved.
 *   INACTIVE match → offered for activation instead of a second row; on Activate the row is
 *                    set to status 1 and onActivated runs (close the form, reload the list).
 *
 * @param rows        the master's list as shown on screen
 * @param editingId   the row being edited, or null while adding
 * @param value       the typed name, already trimmed
 * @param field       the row's name field ("name", "model_name", "device_name", …)
 * @param label       what the name is, for the message ("operating system name")
 * @param sameScope   optional (row) => bool — a name is unique only within e.g. one device
 * @param activate    (row) => the update request that sets that row Active
 * @param onActivated after a successful activation
 * @param onDuplicate after the "already present" dialog is closed (Cancel) — back to the list
 * @returns true when the save should go on; false when it was a duplicate, was activated,
 *          or the user cancelled
 */
export async function guardDuplicate({
  rows,
  editingId,
  value,
  field = "name",
  label = "record",
  sameScope = () => true,
  activate,
  onActivated,
  onDuplicate,
}) {
  const clash = (rows ?? []).find(
    (r) => r.id !== editingId && r.status !== -1 && sameScope(r) && norm(r[field]) === norm(value)
  );
  if (!clash) return true;

  const shown = clash[field];
  if (clash.status === 1) {
    await duplicateAlert(`"${shown}" is already present`, `This ${label} is already added and Active.`);
    if (onDuplicate) onDuplicate();
    return false;
  }

  if (!(await confirmActivate(shown, label))) return false;
  const res = await activate(clash);
  if (res?.status_code !== 200) {
    await warnAlert("Could not activate", res?.message || "Please try again.");
    return false;
  }
  if (onActivated) await onActivated();
  savedToast(`"${shown}" activated successfully`);
  return false;
}
