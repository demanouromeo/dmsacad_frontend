// Mimics the surface-card > table-toolbar + data-table shape most *Manager screens render once
// loaded, so swapping the skeleton out for real content doesn't jump the layout. Use in place of
// the centered <Loading /> spinner for any table/list-based initial load.
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
  /** Wrap in the standard surface-card shell. Set false when embedding inside an
   *  already-carded container (a dialog, a side panel, ...) to avoid a double border. */
  card?: boolean;
  className?: string;
}

const TableSkeleton = ({
  rows = 6,
  columns = 4,
  showToolbar = true,
  card = true,
  className = "",
}: TableSkeletonProps) => {
  const content = (
    <>
      {showToolbar && (
        <div className="table-toolbar">
          <div className="skeleton h-8 w-full max-w-xs rounded-lg"></div>
          <div className="skeleton h-8 w-28 rounded-lg"></div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table table-zebra data-table">
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i}>
                  <div className="skeleton h-3 w-16 rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c}>
                    <div className="skeleton h-4 w-full max-w-40 rounded"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  if (!card) {
    return (
      <div className={className} aria-hidden="true">
        {content}
      </div>
    );
  }

  return (
    <div className={`surface-card overflow-hidden ${className}`} aria-hidden="true">
      {content}
    </div>
  );
};

export default TableSkeleton;
