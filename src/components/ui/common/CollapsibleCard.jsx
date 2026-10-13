"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

// A card with the standard blue header and a single +/- toggle button on the right.
// Click "-" to collapse (reduce) the card body, click "+" to expand it again.
export default function CollapsibleCard({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded shadow mb-6">
      <div className="bg-[#3482AE] px-4 py-3 rounded-t font-bold text-white text-sm flex items-center justify-between">
        <span>{title}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
          className="ml-2 flex items-center justify-center w-6 h-6 rounded border border-white/70 hover:bg-white/20"
        >
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
      {open && children}
    </div>
  );
}
