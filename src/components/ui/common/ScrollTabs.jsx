"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * TABS ON ONE LINE — the device-type tabs (Desktop, Laptop, Printer, Tablet, and every type
 * added later) stay in a single row instead of wrapping onto a second line. When they do not
 * all fit (a phone, or many types), ‹ and › appear at the ends to slide to the rest; on a phone
 * they can be swiped too. Arrows only show when there is more to see that way.
 *
 * `activeKey` — the selected tab's key: it is scrolled into view whenever it changes.
 * Children are the tab buttons themselves; each needs data-tab-key={key} to be found.
 */
export default function ScrollTabs({ children, activeKey, arrowClassName = "text-white" }) {
  const strip = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = () => {
    const el = strip.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, []);

  // Tabs arrive after loading, and their counts change their width.
  useEffect(measure, [children]);

  // The selected tab is always in view.
  useEffect(() => {
    if (activeKey === undefined || activeKey === null) return;
    const tab = strip.current?.querySelector(`[data-tab-key="${CSS.escape(String(activeKey))}"]`);
    tab?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeKey]);

  const slide = (dir) => {
    const el = strip.current;
    if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const arrow = `shrink-0 rounded-[3px] p-1 hover:bg-white/15 ${arrowClassName}`;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {canLeft && (
        <button type="button" aria-label="Previous tabs" onClick={() => slide(-1)} className={arrow}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={strip}
        role="tablist"
        // One line, scrolls sideways; the scrollbar itself is hidden (the arrows and swiping do it).
        className="flex min-w-0 flex-1 flex-nowrap gap-[10px] overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canRight && (
        <button type="button" aria-label="More tabs" onClick={() => slide(1)} className={arrow}>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
