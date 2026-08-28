/**
 * SUBBY VIRTUAL brand assets.
 * - BrandLogo: full wordmark for auth / empty states
 * - BrandMark: compact S emblem for sidebar, mobile, loading
 */

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <img
      src="/brand/subby-virtual-logo.png"
      alt="SUBBY VIRTUAL"
      className={`select-none object-contain ${className}`}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      draggable={false}
    />
  );
}

type BrandMarkProps = {
  className?: string;
  size?: number;
  alt?: string;
};

export function BrandMark({
  className = "",
  size = 32,
  alt = "SUBBY VIRTUAL",
}: BrandMarkProps) {
  return (
    <img
      src="/brand/subby-mark-128.png"
      alt={alt}
      width={size}
      height={size}
      className={`select-none object-contain ${className}`}
      decoding="async"
      loading="eager"
      draggable={false}
    />
  );
}

/** Compact brand lockup: S mark + wordmark text (desktop nav). */
export function BrandLockup({
  collapsed = false,
  className = "",
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark size={28} className="shrink-0" />
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-[13px] font-semibold tracking-[0.14em] text-white">
            SUBBY VIRTUAL
          </div>
          <div className="truncate text-[10px] tracking-[0.18em] text-cyan-400/80">
            CLOUD · AUTOMATE · SCALE
          </div>
        </div>
      ) : null}
    </div>
  );
}
