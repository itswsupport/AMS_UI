'use client';

/*
 * THE FOOTER — FIXED at the bottom of every signed-in page, always visible (it no longer hides
 * while scrolling). It sits BELOW the scrolling page area rather than over it, so it never
 * covers the last table row or a form's buttons.
 */
export default function ScrollFooter() {
  /* Rolls over on its own: the current calendar year paired with the next one.
     Through 31 Dec 2026 this reads 2026-2027; from 1 Jan 2027 it reads 2027-2028. */
  const currentYear = new Date().getFullYear();
  const copyrightYears = `${currentYear}-${currentYear + 1}`;

  return (
    <footer className="shrink-0 bg-white border-t border-gray-200 px-3 py-2 sm:px-4 sm:py-3 shadow-lg">
      {/* Smaller on a phone, so the footer takes one short line instead of a third of the screen. */}
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] sm:text-sm text-gray-600">
          Copyright &copy; {copyrightYears} Rucha Yantra Pvt. Ltd.
          <span className="hidden sm:inline"> All rights reserved.</span>
        </span>
        <span className="text-[10px] sm:text-sm text-gray-600 whitespace-nowrap">
          <b>Version</b> 1.2.1
        </span>
      </div>
    </footer>
  );
}
