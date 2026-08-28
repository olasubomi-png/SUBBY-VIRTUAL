import { BrandMark } from "./Brand";

/**
 * Professional, restrained workspace loading state.
 */
export function WorkspaceLoading({
  title = "Loading your workspace",
  status = "Preparing your secure cloud environment",
}: {
  title?: string;
  status?: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#080a0f] px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full border border-cyan-400/20"
            aria-hidden
          />
          <span
            className="brand-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-300/90 border-r-cyan-400/30"
            aria-hidden
          />
          <BrandMark size={36} className="relative z-10" />
        </div>
        <h1 className="mt-6 font-display text-lg font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{status}</p>
      </div>
    </div>
  );
}
