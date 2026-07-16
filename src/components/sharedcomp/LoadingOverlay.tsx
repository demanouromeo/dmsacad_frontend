import Loading from "./Loading";

const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
      <Loading />
    </div>
  );
};

export default LoadingOverlay;
