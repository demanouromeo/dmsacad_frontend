// For card-grid landing screens (ParentDashboard's list of children, ...) where the loaded state
// is a grid of surface-card tiles rather than a table.
interface CardGridSkeletonProps {
  cards?: number;
  className?: string;
}

const CardGridSkeleton = ({ cards = 6, className = "" }: CardGridSkeletonProps) => {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="surface-card p-4 flex items-center gap-4">
          <div className="skeleton w-12 h-12 rounded-full shrink-0"></div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="skeleton h-4 w-3/4 rounded"></div>
            <div className="skeleton h-3 w-1/2 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardGridSkeleton;
