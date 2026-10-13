import CategoryMasterPanel from "./CategoryMasterPanel";
import SubCategoryMasterPanel from "./SubCategoryMasterPanel";
import ReportingPersonPanel from "./ReportingPersonPanel";
import RamMasterPanel from "./RamMasterPanel";
import ProcessorMasterPanel from "./ProcessorMasterPanel";
import HddMasterPanel from "./HddMasterPanel";
import OsMasterPanel from "./OsMasterPanel";
import SystemTypeMasterPanel from "./SystemTypeMasterPanel";
import ModelMasterPanel from "./ModelMasterPanel";
import DeviceNameMasterPanel from "./DeviceNameMasterPanel";
import WarrantyMasterPanel from "./WarrantyMasterPanel";
import ProductMasterPanel from "./ProductMasterPanel";
import ServerMasterPanel from "./ServerMasterPanel";
import IpAddressMasterPanel from "./IpAddressMasterPanel";
import LicenseMasterPanel from "./LicenseMasterPanel";
import DeviceMasterPanel from "@/components/masters/DeviceMasterPanel";
import LocationMasterPanel from "./LocationMasterPanel";
import {
  Layers, Boxes, UserCog, MemoryStick, Cpu, HardDrive, Monitor, ShieldCheck, FileCheck,
  Package, Server, Network, KeyRound, Tag, Barcode, Binary, MapPin,
} from "lucide-react";

/**
 * Every master on the Setting page: its card, its URL and the screen behind it.
 *
 * ONE LIST, read by two places. The Setting page turns it into cards, and
 * Setting/[master]/page.jsx looks a slug up in it to decide what to render. Kept together
 * because a master added to one and forgotten in the other is either a card that leads
 * nowhere or a page nothing links to, and neither shows up until someone clicks.
 *
 * `key` is the URL segment — /AdminDashboard/Setting/<key> — so it is part of the address
 * bar and should not be renamed casually once people have bookmarked it. `title` is what the
 * card and the page heading show, and can change freely.
 *
 * The order here is the order on screen: the hardware specs together, then the
 * device → model → device name chain, then everything else.
 */
export const MASTERS = [
  {
    key: "department",
    title: "Department Master",
    icon: <Layers className="w-8 h-8" />,
    Panel: CategoryMasterPanel,
  },
  {
    // Beside Department Master: both are company -> plant -> (department | location).
    // Stored in db_all_master.location_master.
    key: "location",
    title: "Location Master",
    icon: <MapPin className="w-8 h-8" />,
    Panel: LocationMasterPanel,
  },
  {
    key: "subcategory",
    title: "Sub Category Master",
    icon: <Boxes className="w-8 h-8" />,
    Panel: SubCategoryMasterPanel,
  },
  {
    key: "reportingperson",
    title: "Reporting Person",
    icon: <UserCog className="w-8 h-8" />,
    Panel: ReportingPersonPanel,
  },
  {
    key: "ram",
    title: "RAM",
    icon: <MemoryStick className="w-8 h-8" />,
    Panel: RamMasterPanel,
  },
  {
    key: "processor",
    title: "Processor",
    icon: <Cpu className="w-8 h-8" />,
    Panel: ProcessorMasterPanel,
  },
  {
    key: "hdd",
    title: "HDD",
    icon: <HardDrive className="w-8 h-8" />,
    Panel: HddMasterPanel,
  },
  {
    key: "os",
    title: "Operating System",
    icon: <Monitor className="w-8 h-8" />,
    Panel: OsMasterPanel,
  },
  {
    // Beside the other hardware specs: it is a property of the machine, like RAM or HDD.
    key: "systemtype",
    title: "System Type Master",
    icon: <Binary className="w-8 h-8" />,
    Panel: SystemTypeMasterPanel,
  },
  {
    key: "device",
    title: "Device Master",
    icon: <ShieldCheck className="w-8 h-8" />,
    Panel: DeviceMasterPanel,
  },
  {
    key: "model",
    title: "Model Master",
    icon: <Tag className="w-8 h-8" />,
    Panel: ModelMasterPanel,
  },
  {
    // Device → Model → Device Name, so the three sit next to each other in that order.
    key: "devicename",
    title: "Device Name Master",
    icon: <Barcode className="w-8 h-8" />,
    Panel: DeviceNameMasterPanel,
  },
  {
    key: "warranty",
    title: "Warranty Master",
    icon: <FileCheck className="w-8 h-8" />,
    Panel: WarrantyMasterPanel,
  },
  {
    key: "product",
    title: "Product Master",
    icon: <Package className="w-8 h-8" />,
    Panel: ProductMasterPanel,
  },
  {
    key: "server",
    title: "Server Master",
    icon: <Server className="w-8 h-8" />,
    Panel: ServerMasterPanel,
  },
  {
    key: "ipaddress",
    title: "IP Address Master",
    icon: <Network className="w-8 h-8" />,
    Panel: IpAddressMasterPanel,
  },
  {
    key: "license",
    title: "License Master",
    icon: <KeyRound className="w-8 h-8" />,
    Panel: LicenseMasterPanel,
  },
];

/** One master by its URL segment, or undefined for a slug nobody registered. */
export const findMaster = (key) => MASTERS.find((m) => m.key === key);

/** The sidebar blue, shared by the cards and each master's own title bar. */
export const SIDEBAR_COLOR = "#3482AE";
