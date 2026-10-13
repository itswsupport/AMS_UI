import { createMemoizedComponent } from '@/lib/optimizeComponent';

const Label = createMemoizedComponent(({
  children,
  htmlFor,
  required = false,
  className = '',
}) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-semibold text-[#3482AE] uppercase block mb-1 ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
});

export default Label;
