// For single-record form screens (SchoolInfoManager, ClassifiedParamManager, ThParamManager, ...)
// where the loaded state is a <form>/field stack rather than a table.
interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

const FormSkeleton = ({ fields = 5, className = "" }: FormSkeletonProps) => {
  return (
    <div
      className={`surface-card p-6 md:p-8 flex flex-col gap-5 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="skeleton h-3 w-32 rounded"></div>
          <div className="skeleton h-10 w-full rounded-lg"></div>
        </div>
      ))}
      <div className="skeleton h-10 w-32 rounded-lg self-end mt-2"></div>
    </div>
  );
};

export default FormSkeleton;
