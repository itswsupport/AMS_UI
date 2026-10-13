"use client";

import { useEffect } from "react";

export default function FontOverride() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { font-family: var(--font-exo), 'Exo', sans-serif !important; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
}
