# AMS — Test Record

This file records **what has been tested in AMS, how, and the result**, module by module, with
**where each module stores its data** and **what has changed** between test runs. The automatic
checks are two files in [`tests/`](tests/), so anyone can run them again. **How to maintain this
file** is at the end.

| | |
|---|---|
| **Last full run** | 13/10/2026 |
| **Result** | ✅ Code: all checks passed. ⚠️ Data: 3 rules found old records to fix (see [Section 5](#5-data-findings-to-fix)) |
| **Database** | 29 of 32 data rules pass; 3 find old data (8 records) |
| **Backend** | 41 of 41 APIs OK · all 165 Java files compile |
| **Frontend** | 125 files, 0 syntax errors, 0 broken imports · 3 of 3 Bulk Upload templates correct |
| **Type of test** | Read-only: database `SELECT`s, API `GET`s, compile and syntax checks. Nothing was added, changed or deleted. |
| **Not yet tested** | Saving, editing and deleting, and how screens look (see [Section 7](#7-manual-checklist-save--edit--delete-and-screens)) |

---

## 1. How to run the tests

**Before you start**
- The AMS backend is running (default `http://localhost:8080`), **restarted after the latest
  change** (in Eclipse: Project → Clean, then restart).
- You can reach the `db_asset` database. The host, port, user and password are in the backend's
  `src/main/resources/application.properties`. Don't copy the password into this file.

**Step 1: database checks** ([`tests/db-checks.sql`](tests/db-checks.sql))

Open the file in MySQL Workbench and run it on `db_asset`, or from a terminal:

```powershell
Get-Content tests\db-checks.sql -Raw | & "C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe" -h <host> -P <port> -u <user> -p db_asset
```

- **Part A** has 32 data rules. **Every line should show `bad = 0`.** Anything else, see Section 5.
- **Part B** lists how many rows each module's table has. You use these numbers in Step 3.

**Step 2: API checks** ([`tests/api-check.mjs`](tests/api-check.mjs))

```bash
node tests/api-check.mjs
# another server:  AMS_API=http://<host>:8080 node tests/api-check.mjs
```

- Every line must start with **`OK`**. The last line says `N of N APIs OK`.
- The script exits with code 1 if any API fails.

**Step 3: compare.** For each module, the API's `rows=` (Step 2) must equal the table's
`not_deleted` count (Step 1, Part B). Device Status (`asset/status`) shows **active** names only.

**Step 4: frontend and backend build checks** (done by the developer; how is in Section 4).

**Step 5: record the run** in [Section 8](#8-test-log).

---

## 2. What changed since the last test (10/10/2026 → 13/10/2026)

### Database (`db_asset`)

| Change | Table |
|---|---|
| New column `added_via` (FORM / BULK) | `ams_server_with_ip_master` |
| New column `warranty_start_date` | `ams_server_with_ip_master` |
| `total_warranty_years` widened from DECIMAL(4,1) to **DECIMAL(5,2)** (stops "4.8 → 4.83" being logged on every update) | `ams_server_with_ip_master` |
| Column **`usage_status` removed** | `ams_server_with_ip_master` |
| Column **`plant_name` removed**; `plant_code` widened to hold several plants ("1001,1003") | `ams_login_access` |
| **New table** — server User Log | `ams_server_user_log` (columns `employee_code`, `employee_name`) |
| **New table** — software User Log | `ams_software_user_log` (columns `employee_code`, `employee_name`) |
| Unique key on product name removed (the same product may be added again) | `ams_software_master` |
| New columns `exp_service_code`, `keyboard`, `mouse` | `ams_add_device_master` |
| 3 backup tables removed (`…_bak_2026…`) | — |

### Backend (`Asset-Tracking-System`)

| Change | Files |
|---|---|
| Server and Software **User Log**: every changed field recorded on UPDATE; read APIs `GET /serverasset/changelog?server_id=` and `GET /software/changelog?software_id=` | `ChangeLogBase`, `ServerChangeLog`, `SoftwareChangeLog`, their repositories, `ChangeLogSupport`, `ServerAssetService`, `SoftwareService`, both controllers |
| Server: `added_via`, Warranty Start Date, Total Warranty **worked out from the two dates** (end must be after start); Usage Status removed | `ServerWithIpMaster`, `ServerAssetBO`, `ServerAssetService`, `BulkUploadController` |
| Software: `added_via`; the same product may be added more than once | `SoftwareMaster`, `SoftwareBO`, `SoftwareService` |
| Devices: Exp. Service Code, Keyboard, Mouse (saved, returned, logged) | `AssetMaster`, `AssetBO`, `AssetService` |
| Devices: a USER cannot change a device that is **currently in another plant** | `AssetService.checkScope` |
| Reporting Person: **one or several plants**; `plant_name` removed | `AmsLoginAccess`, `ReportingPersonBO`, `MasterServiceImpl`, `LoginUserBO`, `LoginServiceImpl` |
| Bulk Upload: upload record keeps only the saved rows; `/bulk/history/rows` removed | `BulkUploadController` |
| Faster lists: responses compressed (gzip); device status reads only one type's data | `application.properties`, `DeviceStatusService`, two repositories |

### Frontend (`AMS`)

| Module | Change |
|---|---|
| **Add Device** | **Status = In Use / In Spare** for every type (Active / Inactive and the separate Device Status box removed) · **Exp. Service Code** (laptop, desktop) · **Keyboard, Mouse** (desktop) · **Charger Adaptor** moved before System Type (laptop) · **Age (Years)** = `(TODAY − Warranty End)/365 + Total Warranty` · Total Warranty shown as years.months · all fields 38 px high · opens in **View** first, **EDIT** to change · **"Do you want to update?"** From → To popup · BACK warns about unsaved changes · a USER's plant is never changed on an existing device · VIEWER: view only |
| **Add Server** | Warranty Start Date; Total Warranty worked out; start date filled in for older servers; **Location** from Location Master by Plant · Usage Status and Status (Active / Inactive) removed · **User Log** below the form · update popup · List Server: ACTION and STATUS columns removed |
| **Add Software** | **User Log** below the form · update popup · fields 38 px · License Type list shorter · List Software: ACTION column removed |
| **Bulk Upload** | Payroll-style layout (cards, green Download, dashed Select File, Upload File) · Device opens by default · BACK to User Dashboard · already-added / already-assigned rows named, with the holder · software: an entry identical in every value is skipped · Reference No / name opens the record · Download Failed Rows and "View that upload" removed · popup lists the Reference Nos added · page loads the forms, Excel reader and template builders **only when needed** (opens faster) |
| **Templates** | Device: Exp. Service Code, Charger Adaptor (before System Type), Keyboard, Mouse, Age, Status (In Use / In Spare); colours yellow / green / grey · Server: Warranty Start Date, Total Warranty formula, Location by Plant; Usage Status and Status removed |
| **Reporting Person** | Plant and Device Type: tick-box multi-select on one line, with **All** at the end |
| **Sign-in** | Login page never shows the previous user's menu; a full reload into the new user's own dashboard; other open tabs follow; one person's unfinished Bulk Upload preview cleared at sign-in and sign-out |

---

## 3. Results by module (13/10/2026)

### Database rules (Part A of `tests/db-checks.sql`)

| # | Rule: what must be true | Result |
|---|---|---|
| A01–A07 | Device names have a unique Reference No; models, names and devices point to real device types; a device keeps its name's Reference No | ✅ 0 |
| A08–A09 | Open / Assigned is right (Assigned = current holder or a printer) | ✅ 0 |
| A10, A16, A19 | `added_via` is FORM or BULK (devices, servers, software) | ✅ 0 |
| A11–A13 | Action History: real device, one current holder, end not before start | ✅ 0 |
| A14–A15 | Servers in Server Master, none added twice | ✅ 0 |
| A17–A18 | Software products and license types are in their masters | ✅ 0 |
| A20–A22 | Models valid; Reporting Person roles valid, one row per employee | ✅ 0 |
| A23–A24 | Bulk Upload records valid; no sheet recorded twice | ✅ 0 |
| **A25** | Every device's Status is In Use or In Spare | ⚠️ **5** (old data — Section 5) |
| A26 | Keyboard / Mouse only on desktops | ✅ 0 |
| **A27** | Charger Adaptor only on laptops | ⚠️ **2** (old data — Section 5) |
| A28 | Exp. Service Code never on a printer or tablet | ✅ 0 |
| A29–A30 | Every server / software User Log row belongs to a real record | ✅ 0 |
| **A31** | A server's Total Warranty matches its two dates | ⚠️ **1** (old data — Section 5) |
| A32 | Removed columns (`usage_status`, `plant_name`) are gone | ✅ 0 |

### Backend APIs (`tests/api-check.mjs`) — 41 of 41 OK, all counts match

| Module | Table | API | Table rows | API rows | Result |
|---|---|---|---|---|---|
| Add Device — Desktop / Laptop / Printer / Tablet | `ams_add_device_master` | `asset/list?device_id=` | 12 / 10 / 1 / 4 | 12 / 10 / 1 / 4 | ✅ |
| Open / Assigned / Total Devices | `ams_device_name_master` + `ams_add_device_master` | `asset/status?device_id=` | 305 / 321 / 2 / 12 | 305 / 321 / 2 / 12 | ✅ |
| Device User Log | `ams_asset_user_log` | `asset/changelog` | 18 | — (per device) | ✅ |
| Add Server | `ams_server_with_ip_master` | `serverasset/list` | 20 | 20 | ✅ |
| **Server User Log** (new) | `ams_server_user_log` | `serverasset/changelog?server_id=20` | 14 | 14 | ✅ |
| Add Software | `ams_software_master` | `software/list` | 24 | 24 | ✅ |
| **Software User Log** (new) | `ams_software_user_log` | `software/changelog?software_id=1` | 1 (on another entry) | 0 | ✅ |
| Server Master · Product · License | `ams_server_master` · `ams_product_master` · `ams_license_master` | `…/list` | 20 · 4 · 10 | 20 · 4 · 10 | ✅ |
| Device · Model · Device Name Master | `ams_device_master` · `ams_model_master` · `ams_device_name_master` | `…/list` | 4 · 73 · 641 | 4 · 73 · 641 | ✅ |
| Processor · RAM · HDD · OS · System Type · Warranty · IP | the matching `ams_…_master` tables | `…/list` | 14 · 8 · 15 · 17 · 2 · 3 · 19 | the same | ✅ |
| Department · Plant Category · Sub Category | `ams_category_mst` · `ams_plant_category` · `ams_sub_category_mst` | `…/list` | 4 · 5 · 3 | 4 · 5 · 3 | ✅ |
| Reporting Person | `ams_login_access` | `reportingperson/list` | 6 | 6 | ✅ |
| Bulk Upload — device / server / software | `ams_bulk_upload_log` | `bulk/uploaded?type=` | 12 / 1 / 23 | 12 / 1 / 23 | ✅ |
| Old Excel sheets — Laptop / Desktop / Printer / Tablet | `ams_laptop_master` … `ams_tablet_master` | `…/list` | 317 / 300 / 39 / 11 | the same | ✅ |
| Shared lists — Company, Department, Location, Employee | `company_mst`, `plant_dept_mst`, `location_master`, `emp_details` | `…/list` | — | 18 · 1090 · 390 · 851 | ✅ |

Speed: every API answered in about 10–290 ms; compression (gzip) ON.

### Backend build

| Check | Result |
|---|---|
| All 165 Java files compile together | ✅ 0 errors |

### Frontend

| Check | Result |
|---|---|
| Syntax of every `.js` / `.jsx` file under `src/` | ✅ 125 files, 0 errors |
| Every `import` points to a file that exists | ✅ 0 missing |
| **Device template** — 40 columns in form order, 15 dropdowns all with data, formulas Reference No / Company / Total Warranty / Age, one rule per column, read back by the upload | ✅ |
| **Server template** — 20 columns in form order, 10 dropdowns (Location linked to Plant), Total Warranty formula | ✅ (Server Name has no dropdown while every Server Master server is already added — expected) |
| **Software template** — 6 columns, 3 dropdowns, Renewal Date accepts real dates only | ✅ |

---

## 4. How the build checks are run

- **Backend compile:** `javac` over all files in `src/main/java`, with the project's own libraries
  (newest version of each in the local Maven folder; Spring Boot 4.1.1 needs Spring Security 7.x).
  Eclipse's own build (Project → Clean) does the same.
- **Frontend syntax and imports:** every `.js` / `.jsx` file is parsed, and every `@/…` and relative
  import is checked to point to an existing file.
- **Templates:** each Bulk Upload template is built with the app's own builder and live data, written
  to a file and read back — headings, dropdown lists, formulas, one rule per column, and the upload
  reader must recognise every heading.

---

## 5. Data findings to fix

Old records saved before this week's rules. **The code is correct**; the data needs a correction.

| Rule | Records | What to do |
|---|---|---|
| **A25** Status not In Use / In Spare | **it36363** (laptop) has the old value "Active"; **print409** (printer), **HR605**, **sou282**, **tab sou** (tablets) have none | Open each, EDIT, choose **In Use** or **In Spare**, UPDATE — or set them in the database |
| **A27** Charger on a desktop | **HR401**, **HR903** (desktops) have Charger = "test" (saved 09/10, before the laptop-only rule) | Hidden on the form; clear it in the database if you want the data clean |
| **A31** Server total ≠ dates | **testing** (server 20) stores 4.80; its dates give 4.83 (saved before the column took two decimals) | Corrects itself on its next UPDATE |

Also still open: **QA107** is recorded in plant 1001 instead of 1008 (moved by the bug fixed on
12/10); and Device Master has an unused device type **"test"**.

---

## 6. Rules each module must follow (expected behaviour)

| Module | Expected |
|---|---|
| Device Name Master | Creating a name gives it a Reference No, stored on the name. |
| Add Device | Keeps the name's Reference No. Fields per type: printer and tablet show only their own; Charger Adaptor laptop only; Keyboard / Mouse desktop only; Exp. Service Code laptop and desktop. **Status** (In Use / In Spare) on every type, a new device starts In Use. Age is calculated, never stored. `added_via = FORM`. |
| Device lists | Reference No opens an added device in **View** (EDIT to change); an Open name opens Add Device with type / model / name locked. |
| Edit (device, server, software) | UPDATE shows **"Do you want to update …?"** with each changed field From → To; nothing changed = "Nothing to update". Each change is written to that record's **User Log** with the employee code and name. |
| Action History | One current holder at a time. Assign → Assigned; release → Open (printers always Assigned). |
| Add Server | Server from Server Master, never twice. Location from Location Master by Plant. Total Warranty from the two dates. `added_via = FORM`. |
| Add Software | Product and License Type from their masters; the same product may be added again. `added_via = FORM`. |
| Bulk Upload | Rows checked first; already-added rows skipped and named (with holder); a software entry identical in every value skipped; the same sheet can't be uploaded twice; saved rows `added_via = BULK`. |
| Reporting Person | One or several plants and device types. A USER sees and changes only those; a VIEWER only views. |
| Sign-in | After LOGIN only the new person's dashboard is shown; nothing of the previous person remains. |

---

## 7. Manual checklist: save / edit / delete and screens

These write to the database or need eyes on the screen, so they are **not** in the automatic checks.
Use test records with a clear name (e.g. `TEST-QA-001`), check the table after each step, then
delete them and run `tests/db-checks.sql` again.

| # | Step | Check | Status |
|---|---|---|---|
| M01 | Device Name Master: add a name | `ams_device_name_master`: `reference_no` filled, Open | ☐ Not run |
| M02 | Add Device from that name (desktop): fill Exp. Service Code, Keyboard, Mouse; Status In Use | `ams_add_device_master`: same `reference_no`, the three new values, `device_status = In Use`, `added_via = FORM` | ☐ Not run |
| M03 | Laptop: Charger Adaptor shows just before System Type; desktop / tablet / printer don't show it | On screen | ☐ Not run |
| M04 | View → EDIT → change two fields → UPDATE | Popup lists both From → To; `ams_asset_user_log` has both rows | ☐ Not run |
| M05 | Age (Years) on the form equals the Excel formula for the same dates | On screen | ☐ Not run |
| M06 | Assign, then release, an employee | `ams_asset_action_history`; name Assigned, then Open | ☐ Not run |
| M07 | Server: EDIT → change Location and Warranty dates → UPDATE | Popup; `ams_server_user_log` rows with `employee_code` / `employee_name`; total = dates | ☐ Not run |
| M08 | Software: EDIT → change Renewal Date → UPDATE | Popup; `ams_software_user_log` row | ☐ Not run |
| M09 | Bulk Upload Device / Server / Software (1 good row each), then upload the same sheet again | Rows saved `added_via = BULK`; popup shows the Reference No; second upload refused | ☐ Not run |
| M10 | Bulk Upload: a sheet with 1 old + 1 new row | Old row skipped and named; new row uploaded | ☐ Not run |
| M11 | Bulk Upload page opens quickly; the record form opens on clicking a Reference No | On screen | ☐ Not run |
| M12 | Reporting Person: tick **All** plants, UPDATE | `plant_code` holds every code | ☐ Not run |
| M13 | Sign in as one user, then another | Login page has no sidebar; only the new user's dashboard | ☐ Not run |
| M14 | Sign in as VIEWER | No Add Device card, no EDIT / UPDATE | ☐ Not run |
| M15 | Each master: add, edit, set Inactive | Row saved / changed; inactive hidden from dropdowns | ☐ Not run |

When an item is done, change ☐ to ✅ (or ❌ with a note) and add a line to the test log.

---

## 8. Test log

Newest first.

| Date | Who | What was run | Result | Notes |
|---|---|---|---|---|
| 13/10/2026 | Claude (for the AMS team) | `db-checks.sql` (32 rules) · `api-check.mjs` (41 APIs) · backend compile (165 files) · frontend syntax + imports (125 files) · 3 templates | ✅ code · ⚠️ 3 data rules (8 old records) | Read-only. Backend confirmed restarted (new User Log APIs live). Save / edit / delete not run. |
| 10/10/2026 | Claude (for the AMS team) | `db-checks.sql` (24 rules) + `api-check.mjs` (39 APIs) | ✅ 24/24 rules, 39/39 APIs | Read-only. |

---

## 9. How to maintain this file

**Run the tests:**
- after every backend change or database change (new column, new table, ALTER);
- before a release or a demo;
- after a large Bulk Upload or data import.

**Every time something is changed**, add it to [Section 2](#2-what-changed-since-the-last-test-10102026--13102026)
under Database, Backend or Frontend — what changed, and in which table or file. At the next full run,
rename the section's dates and start a fresh list.

**When you add a new module or screen:**
1. Add its list API to `ENDPOINTS` in [`tests/api-check.mjs`](tests/api-check.mjs).
2. Add its table to **Part B** of [`tests/db-checks.sql`](tests/db-checks.sql).
3. If it links to other tables, add a rule to **Part A** (`A33`, `A34` …) that counts the **bad**
   rows, so 0 means correct.
4. Add it to Sections 3 and 6, and its save / edit / delete steps to Section 7.

**When a rule changes:** update or remove its Part A check and its lines in Sections 3 and 6.

**When a table or column is renamed or dropped:** fix the names in `tests/db-checks.sql`; the run
fails with "Unknown column" until you do.

**When a check fails:**
1. Don't change the check to make it pass. Find out whether the **data** or the **code** is wrong.
2. Use the check's SQL with `SELECT *` instead of `COUNT(*)` to see the bad rows.
3. Fix the cause, run again, and note it in Section 5 and the test log.

**Keep the automatic tests read-only.** The files in `tests/` only `SELECT` and `GET`. Anything that
saves or deletes goes in the manual checklist (Section 7), on test records.
