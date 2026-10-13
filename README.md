# AMS — Asset Management System

Frontend (Next.js) for tracking company IT devices — desktops, laptops, printers and tablets —
from the moment a device name is created to who holds it today.

- **Frontend:** this project (Next.js, React, Tailwind, MUI DataGrid, react-select)
- **Backend:** `Asset-Tracking-System` (Spring Boot, Hibernate), port `8080`
- **Database:** MySQL `db_asset` (AMS tables) and `db_all_master` (shared company / plant / employee masters)

---

## Running the frontend

```bash
npm install
npm run dev        # http://localhost:3000
```

The backend URL comes from `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (see `.env.example`).

> The backend runs with `spring.jpa.hibernate.ddl-auto=none`, so **every table change is done
> by hand in SQL** — Hibernate never alters a table itself.

---

## How device data is organised

Three masters build the chain **Device Type → Model → Device Name**:

| Level | Table (`db_asset`) | Key columns | Linked to |
|---|---|---|---|
| 1. Device type | `ams_device_master` | `id`, `device_name` (desktop, laptop, printer, tablet) | — |
| 2. Model | `ams_model_master` | `id`, `device_id`, `model_name`, `status` | device type via `device_id` |
| 3. Device name | `ams_device_name_master` | `id`, `device_id`, `model_id`, `device_name`, `allocation_status`, `reference_no` | device type and model |

Current device ids: **1 = Desktop, 2 = Laptop, 3 = Printer, 5 = Tablet**.

- `device_name` is unique across the whole table — two machines can never share a name.
- `status`: `1` active, `0` inactive (hidden from dropdowns), `-1` deleted.

---

## The device flow

1. **Device Master** — create the device type (e.g. Desktop).
2. **Model Master** — create a model under it (e.g. DELL OPTIPLEX 3000).
3. **Device Name Master** — create the machine name under that model (e.g. MAINT703).
   - Its **reference number** is generated immediately, e.g. `DE26MAINT703280`.
   - It starts as **Open** and appears in *Open Devices*.
4. **Add Device** — open it from the list (or pick Type → Model → Name) and fill in the details.
   - Saved in `ams_add_device_master`, with the **same** reference number.
5. **Action History** — assign an employee (`ams_asset_action_history`, one row per employee).
   - The device becomes **Assigned**.
6. Every later edit is logged field by field in `ams_asset_user_log`.

In the Add Device form:
- **Model** lists `ams_model_master` rows for the chosen `device_id` with `status = 1`, A→Z.
- **Device Name** lists `ams_device_name_master` rows for that `device_id` **and** `model_id`.

### Open or Assigned

A device is **Assigned** only while an employee holds it in Action History (a printer counts as
Assigned once registered — its department holds it). Everything else is **Open**. The result is
kept in `ams_device_name_master.allocation_status`.

### Reference number

`<type><FY><name><serial>` with no separators — e.g. **`DE26HR01008`**:

| Part | Example | Meaning |
|---|---|---|
| Type | `DE` | First two letters of the device type |
| FY | `26` | Financial year (1 April – 31 March) |
| Name | `HR01` | Device name, spaces removed, upper case |
| Serial | `008` | Running number per device type, restarts at 001 each financial year |

Generated once when the name is created and never changed after the device is registered.

---

## Access by plant and device type (Reporting Person)

**Settings → Reporting Person** sets each employee's AMS access in `
ams_login_access->Reporting Person 

**Company → Plant → Device Type (one or several) → Employee Role

| Role | What they can do |
|---|---|
| **ADMIN** | Everything — every device type, every plant |
| **USER** | Adds and sees **only** their device types, 
___________________________________________________________
Department Master ,location master
Location master =>db_all_master
taken form the db_ems_version2.sf
plant_mst
___________________________________________________________
Ram Master 
SELECT * FROM db_asset.ams_ram_master;
____________________________________________________________
Processor Master 
SELECT * FROM db_asset.ams_processor_master;
____________________________________________________________
HDD Master 
SELECT * FROM db_asset.ams_hdd_master;
____________________________________________________________
OS Master
SELECT * FROM db_asset.ams_os_master;
____________________________________________________________
Device Master 
SELECT * FROM db_asset.ams_device_master;
____________________________________________________________
Model Master 

SELECT * FROM db_asset.ams_model_master
____________________________________________________________
Device name Master 
SELECT * FROM db_asset.ams_device_name_master;
____________________________________________________________
warranty_master

SELECT * FROM db_asset.ams_warranty_master;

____________________________________________________________
Product Master

SELECT * FROM db_asset.ams_product_master;
____________________________________________________________
server Master

SELECT * FROM db_asset.ams_server_master;

____________________________________________________________
License Master

SELECT * FROM db_asset.ams_license_master;
____________________________________________________________

when device is added it is stored in the 

SELECT * FROM db_asset.ams_add_device_master;

_____________________________________________________________________________
History of the device 

SELECT * FROM db_asset.ams_asset_action_history;
_____________________________________________________________________________
User what is change 

SELECT * FROM db_asset.ams_asset_user_log
_____________________________________________________________________________
when the server is add or submited

SELECT * FROM db_asset.ams_server_with_ip_master ;
_____________________________________________________________________________
When software was added or submited
SELECT * FROM db_asset.ams_software_master;

_________________________________________________________
Before  after change in the server which was alredy added.
SELECT * FROM db_asset.ams_server_user_log;

_________________________________________________________
In this the software changes which are alredy added.

SELECT * FROM db_asset.ams_software_user_log;

_________________________________________________________

