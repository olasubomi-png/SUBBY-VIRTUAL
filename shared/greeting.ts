export type GreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Local-time greeting period.
 * 05:00–11:59 → morning, 12:00–17:59 → afternoon, 18:00–04:59 → evening
 */
export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const period = getGreetingPeriod(date);
  if (period === "morning") return "Good morning";
  if (period === "afternoon") return "Good afternoon";
  return "Good evening";
}

/**
 * Returns a short display name suitable for a dashboard greeting.
 * Rejects empty values and email-like strings. Prefer first name token.
 */
export function getUsableDisplayName(name?: string | null): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

/**
 * Full greeting line without styling.
 * With name: "Good morning, Alex."
 * Without: "Good morning."
 */
export function buildDashboardGreeting(
  name?: string | null,
  date: Date = new Date()
): string {
  const base = getTimeOfDayGreeting(date);
  const usable = getUsableDisplayName(name);
  return usable ? `${base}, ${usable}.` : `${base}.`;
}

/**
 * Professional date label, e.g. "Friday, 28 August 2026".
 * Uses the provided locale (default en-GB for day-month order).
 */
export function formatDashboardDate(
  date: Date = new Date(),
  locale?: string
): string {
  const resolved =
    locale ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().locale
      : "en-GB");
  return new Intl.DateTimeFormat(resolved, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
