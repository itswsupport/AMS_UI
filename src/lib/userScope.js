/**
 * WHAT A SIGNED-IN USER MAY ADD AND SEE — set for them in Reporting Person.
 *
 * PLANT-WISE ACCESS FOR EVERY ROLE — User, Viewer and Admin (alone or Admin + User) alike are
 * limited to the device types and the plant(s) on their Reporting Person row (sent at login as
 * device_ids / plant_codes / plant_company); a viewer only reads. The shared masters (RAM, OS,
 * Model …) are not plant-wise and are not touched by this.
 *
 * Each part only limits when it is set, so someone with no device types or no plant on record
 * is not shut out of everything. The backend applies the same rule when a device is saved.
 *
 * A name not yet registered in ADD DEVICE has no plant, so it stays visible to a USER of that
 * device type — that is how they register it into their plant.
 */
export function getUserScope(user) {
  // Every role that signs in is plant-wise — Admin, User and Viewer alike.
  const limited = Boolean(user);
  const deviceIds =
    limited && Array.isArray(user?.device_ids) ? user.device_ids.map((id) => String(id)) : [];
  /*
   * Their plant(s) — one or several, as picked in Reporting Person. plant_codes from login;
   * plant_code ("1001,1003") for a session signed in before that was sent.
   */
  const plants = !limited
    ? []
    : [
        ...new Set(
          (Array.isArray(user?.plant_codes) ? user.plant_codes : String(user?.plant_code ?? "").split(","))
            .map((c) => String(c ?? "").trim())
            .filter(Boolean)
        ),
      ];

  return {
    /** True for a USER or VIEWER — their screens are narrowed to the rest of this object. */
    limited,
    /** Every plant code they work in; empty when not limited by plant. */
    plants,
    /** Their plant when they have exactly ONE (filled in for them); "" otherwise. */
    plant: plants.length === 1 ? plants[0] : "",
    /** Whether this plant code is one of theirs (always, when not limited by plant). */
    allowsPlant: (code) => plants.length === 0 || plants.includes(String(code ?? "").trim()),
    /** The company that plant belongs to, as saved in Reporting Person. */
    company: limited ? user?.plant_company ?? "" : "",
    /** Whether this device type (Device Master id) is one they handle. */
    allowsDevice: (id) => !limited || deviceIds.length === 0 || deviceIds.includes(String(id)),
    /** Whether a device-status row is in their plant (unregistered names always are). */
    allowsRow: (row) =>
      !limited || plants.length === 0 || !row?.registered || plants.includes(String(row?.plant ?? "").trim()),
  };
}
