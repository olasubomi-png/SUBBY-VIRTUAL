/** Unicode regional-indicator flag from ISO alpha-2. No external image URLs. */
export function countryFlagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (code.charCodeAt(0) - 65),
    base + (code.charCodeAt(1) - 65)
  );
}

export function formatAvailabilityCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "Unavailable";
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return `${m >= 10 ? Math.floor(m) : m.toFixed(1).replace(/\.0$/, "")}M+ available`;
  }
  if (count >= 10_000) {
    return `${Math.floor(count / 1000)}K+ available`;
  }
  return `${count.toLocaleString("en-US")} available`;
}

export function formatNgnFromKobo(kobo: number): string {
  if (!Number.isSafeInteger(kobo)) return "₦—";
  const major = Math.trunc(kobo / 100);
  return `₦${major.toLocaleString("en-US")}`;
}
