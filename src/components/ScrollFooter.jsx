'use client';

import { useState, useEffect } from 'react';

export default function ScrollFooter() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  /* Rolls over on its own: the current calendar year paired with the next one.
     Through 31 Dec 2026 this reads 2026-2027; from 1 Jan 2027 it reads 2027-2028. */
  const currentYear = new Date().getFullYear();
  const copyrightYears = `${currentYear}-${currentYear + 1}`;

  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const handleScroll = () => {
      const currentScrollY = mainContent.scrollTop;
      if (currentScrollY < lastScrollY || currentScrollY === 0) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      setLastScrollY(currentScrollY);
    };

    mainContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <footer
      className={`
        absolute bottom-0 left-0 right-0
        bg-white border-t border-gray-200
        px-4 py-3
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
        shadow-lg
      `}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          Copyright &copy; {copyrightYears} Rucha Yantra Pvt. Ltd. All rights reserved.
        </span>
        <span className="text-sm text-gray-600">
          <b>Version</b> 1.2.1
        </span>
      </div>
    </footer>
  );
}
