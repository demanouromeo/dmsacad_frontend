// For screens whose "loaded" state is a single picker card (a term/classe <select> or two, an
// optional radio-group row, then a row of action buttons) rather than a table or a form — the
// effectifs report/print screens (PvManager, SyntheseGlobaleManager, ClassementManager, ...).
interface PickerSkeletonProps {
  selects?: number;
  hasRadios?: boolean;
  buttons?: number;
  className?: string;
}

const PickerSkeleton = ({
  selects = 1,
  hasRadios = false,
  buttons = 3,
  className = "",
}: PickerSkeletonProps) => {
  return (
    <div
      className={`surface-card p-4 md:p-6 mb-6 flex flex-col gap-5 ${className}`}
      aria-hidden="true"
    >
      <div className="skeleton h-5 w-64 rounded"></div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {Array.from({ length: selects }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="skeleton h-4 w-16 rounded"></div>
            <div className="skeleton h-8 w-40 rounded-lg"></div>
          </div>
        ))}
      </div>
      {hasRadios && (
        <div className="flex flex-wrap items-center gap-6">
          <div className="skeleton h-4 w-44 rounded"></div>
          <div className="skeleton h-4 w-44 rounded"></div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: buttons }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-28 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
};

export default PickerSkeleton;
