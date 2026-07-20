import Loading from "./Loading";

const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-base-300/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-base-100/90 border border-base-content/10 shadow-2xl px-8 py-6">
        <Loading />
      </div>
    </div>
  );
};

export default LoadingOverlay;
