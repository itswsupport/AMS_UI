"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * A dialog over the page, used by every master's ADD / EDIT form.
 *
 * The masters used to swap the form in where the table was, which meant you could not see the
 * list you were adding to. A dialog leaves the table visible underneath.
 *
 * Closing: the × button, the Escape key, or a click on the backdrop. Clicks inside the panel
 * are stopped from reaching the backdrop, so dragging to select text cannot dismiss the form
 * by accident.
 *
 * Body scroll is locked while it is open — otherwise the page behind scrolls under the
 * dialog, which makes the dialog look stuck to nothing.
 *
 * WHERE IT SITS: centred on the window.
 *
 * It used to be pushed down ~400px, because every master opened as a panel underneath four
 * rows of cards on the Setting page and a centred dialog landed across those cards rather
 * than over the table it belonged to. Each master now has its own page, with nothing above
 * the table but a heading, so that offset only left the form stranded near the bottom.
 *
 * A form taller than the window stops being centred and starts from the top instead — that
 * is what `my-auto` does, and it is the difference between a tall form scrolling properly
 * and one whose heading is clipped off the top where no amount of scrolling reaches it.
 *
 * @param open      whether it is showing
 * @param title     the heading in the coloured bar
 * @param barColor  that bar's colour, matching the card the panel belongs to
 * @param onClose   called by ×, Escape and the backdrop
 */
export default function Modal({ open, title, barColor, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    /*
     * Two nested wrappers, not one. The outer is the backdrop and owns the scrolling; the
     * inner centres the panel.
     *
     * Doing both on one element does not work: a form taller than the window would have its
     * top clipped, and that top could not be scrolled to, because overflow only reveals
     * content below the start of the box. min-h-full on the inner wrapper means a tall form
     * simply extends downward and the backdrop scrolls with it.
     */
    <div
      /*
       * The page behind is blurred as well as dimmed.
       *
       * Dimming alone left the table legible under the form, so the eye kept reading rows it
       * could not click. Blur takes the detail away and leaves only enough shape to show the
       * dialog is over something, which is what a modal is meant to say.
       *
       * backdrop-blur needs the layer to be partly transparent to have anything to blur, so
       * the black/50 is doing two jobs here.
       */
      className="fixed inset-0 z-[1000] overflow-y-auto bg-black/50 backdrop-blur-lg"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-start justify-center px-3 py-6 sm:px-8 sm:py-8">
        {/*
          stopPropagation so a click inside never reaches the backdrop handler above.
          max-w-5xl rather than full width: these forms are three columns, and stretched
          across a wide monitor the labels drift far from their inputs.
        */}
        <div
          className="my-auto w-full max-w-5xl rounded-[3px] bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex items-center justify-between gap-2 rounded-t-[3px] px-3 py-2"
            style={{ backgroundColor: barColor }}
          >
            <h3 className="min-w-0 break-words font-semibold uppercase text-white" style={{ fontSize: "12px" }}>
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-[3px] p-1 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
