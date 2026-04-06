import dynamic from "next/dynamic";

const ImportMiniMap = dynamic(() => import("./ImportMiniMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 animate-pulse rounded-2xl" />
  ),
});

export default ImportMiniMap;
