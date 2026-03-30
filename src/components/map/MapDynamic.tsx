import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});

export default MapView;
