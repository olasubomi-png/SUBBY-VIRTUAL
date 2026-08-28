import { Skeleton } from "./ui/skeleton";
import { BrandMark } from "./Brand";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-[260px] space-y-6 border-r border-border bg-[#0a0c12] p-4 md:block">
        <div className="flex items-center gap-3 px-2">
          <BrandMark size={28} />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
        <div className="space-y-2 px-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-border px-5">
          <BrandMark size={28} className="md:hidden" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-4 p-5 md:p-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
