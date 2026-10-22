import { createMemoizedComponent } from '@/lib/optimizeComponent';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const PageTitle = ({ title, subtitle, actions, showBack = true, className = '' }) => {
  const router = useRouter();

  return (
    <div className={`mb-4 ${className}`}>
      {/* On a phone a long title wraps under itself rather than pushing BACK off the edge. */}
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-[#3482AE] break-words">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {actions}
          {showBack && (
            <button
              onClick={() => router.back()}
              className="flex items-center px-3 py-2 sm:px-4 text-white text-sm font-semibold rounded-sm"
              style={{ backgroundColor: '#3482AE' }}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              BACK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default createMemoizedComponent(PageTitle);
