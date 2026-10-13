"use client";
import { createMemoizedComponent } from '@/lib/optimizeComponent';

const DashboardCard = createMemoizedComponent(({
  title,
  icon,
  onClick,
  variant = 'default',
  loading = false,
  disabled = false,
  counter = null,
  // Optional number shown UNDER the title, with the icon kept above — e.g. "OPEN DEVICES 5".
  count = null,
  // The taller height used by count cards, for a card beside them that has no count.
  tall = false,
  bgColor,
  className = '',
}) => {
  const variants = {
    default: 'bg-[#3482AE]',
    primary: 'bg-[#3482AE]',
    blue: 'bg-[#5aa7ff]',
    success: 'bg-[#2ed8b6]',
    warning: 'bg-[#FFB64D]',
    danger: 'bg-[#e74c3c]',
    info: 'bg-[#3482AE]',
    teal: 'bg-[#20c997]',
    purple: 'bg-[#6f42c1]',
    pink: 'bg-[#e83e8c]',
    orange: 'bg-[#fd7e14]',
    indigo: 'bg-[#6610f2]',
  };

  const bgClass = bgColor || variants[variant] || variants.default;

  return (
    <div
      onClick={!disabled && !loading ? onClick : undefined}
      className={`
        ${bgClass} text-white rounded-[3px] p-4
        ${onClick && !disabled ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        transition-all duration-200 shadow-md ${count !== null || tall ? 'h-[100px]' : 'h-[80px]'} flex flex-col items-center justify-center text-center
        ${className}
      `}
    >
      {counter !== null && (
        <div className="text-2xl font-bold mb-1">{loading ? '...' : counter}</div>
      )}
      {counter === null && icon && (
        <div className="text-white mb-1">{icon}</div>
      )}
      {/* A count card: the number on top (18px), its title under it (13px). */}
      {count !== null ? (
        <>
          <div className="text-[18px] font-bold leading-none">{loading ? '...' : count}</div>
          <p className="mt-1 text-[13px] font-medium uppercase">{title}</p>
        </>
      ) : (
        <p className="text-[12px] font-medium uppercase">{title}</p>
      )}
    </div>
  );
});

export default DashboardCard;
