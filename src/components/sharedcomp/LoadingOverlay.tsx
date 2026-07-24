import Loading from "./Loading";

// Optional progress reporting - every existing call site still renders `<LoadingOverlay />` with
// no props and gets the plain spinner unchanged. Pass `progress` from a screen whose async action
// has a real, countable unit of work (e.g. ReportCardManager's whole-section/whole-classe PDF
// batches) to show a determinate bar instead of a bare spinner. `overall` is an optional header
// line above the bar for a coarser-grained context (e.g. "Classe 2/5: 6ème A") when `current`/
// `total` themselves track a finer-grained sub-phase (e.g. photos loaded within that classe).
export interface LoadingOverlayProgress {
  current: number;
  total: number;
  label?: string;
  overall?: string;
}

interface LoadingOverlayProps {
  progress?: LoadingOverlayProgress | null;
}

const LoadingOverlay = ({ progress }: LoadingOverlayProps = {}) => {
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-base-300/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-base-100/90 border border-base-content/10 shadow-2xl px-8 py-6 min-w-64">
        <Loading />
        {percent !== null && (
          <div className="w-full flex flex-col items-center gap-1">
            {progress?.overall && (
              <p className="text-sm font-medium text-center text-base-content/80">
                {progress.overall}
              </p>
            )}
            <progress
              className="progress progress-primary w-full"
              value={percent}
              max={100}
            />
            <p className="text-xs text-base-content/50">
              {progress?.label ? `${progress.label} — ` : ""}
              {progress?.current}/{progress?.total}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
