import { createMemoizedComponent } from '@/lib/optimizeComponent';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const PageTitle = ({ title, subtitle, actions, showBack = true, className = '' }) => {
  const router = useRouter();

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[16px] font-bold text-[#3482AE]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center space-x-3">
          {actions}
          {showBack && (
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 text-white text-sm font-semibold rounded-sm"
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
