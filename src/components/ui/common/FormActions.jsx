import { createMemoizedComponent } from '@/lib/optimizeComponent';

const FormActions = createMemoizedComponent(({
  onSubmit,
  onCancel,
  submitLabel = 'SAVE',
  cancelLabel = 'CANCEL',
  isSubmitting = false,
  disabled = false,
  align = 'end',
  className = '',
}) => {
  const justify = align === 'center' ? 'justify-center' : align === 'start' ? 'justify-start' : 'justify-end';
  return (
    <div className={`flex items-center ${justify} space-x-3 mt-4 ${className}`}>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || disabled}
        className="bg-[#3482AE] text-white px-6 py-2 rounded-[5px] text-sm font-semibold hover:bg-[#2a6d8f] disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'SAVING...' : submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-[#dc3545] text-white px-6 py-2 rounded-[5px] text-sm font-semibold hover:bg-[#c82333] disabled:opacity-50 transition-colors"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
});

export default FormActions;
