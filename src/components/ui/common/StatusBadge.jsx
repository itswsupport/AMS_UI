import { createMemoizedComponent } from "@/lib/optimizeComponent";

/** Coloured pill for an asset / request / maintenance status. */
const StatusBadge = createMemoizedComponent(({ label, color = "#6c757d", className = "" }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white ${className}`}
    style={{ backgroundColor: color }}
  >
    {label}
  </span>
));

export default StatusBadge;
