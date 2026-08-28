import { describe, expect, it } from "vitest";
import {
  buildDashboardGreeting,
  formatDashboardDate,
  getGreetingPeriod,
  getTimeOfDayGreeting,
  getUsableDisplayName,
} from "../shared/greeting";

function atHour(hour: number, minute = 0): Date {
  return new Date(2026, 7, 28, hour, minute, 0, 0);
}

describe("dashboard greeting period", () => {
  it("returns morning for 05:00–11:59", () => {
    expect(getGreetingPeriod(atHour(5))).toBe("morning");
    expect(getGreetingPeriod(atHour(11, 59))).toBe("morning");
    expect(getTimeOfDayGreeting(atHour(9))).toBe("Good morning");
  });

  it("returns afternoon for 12:00–17:59", () => {
    expect(getGreetingPeriod(atHour(12))).toBe("afternoon");
    expect(getGreetingPeriod(atHour(17, 59))).toBe("afternoon");
    expect(getTimeOfDayGreeting(atHour(15))).toBe("Good afternoon");
  });

  it("returns evening for 18:00–04:59", () => {
    expect(getGreetingPeriod(atHour(18))).toBe("evening");
    expect(getGreetingPeriod(atHour(23))).toBe("evening");
    expect(getGreetingPeriod(atHour(0))).toBe("evening");
    expect(getGreetingPeriod(atHour(4, 59))).toBe("evening");
    expect(getTimeOfDayGreeting(atHour(21))).toBe("Good evening");
  });
});

describe("dashboard greeting with user name", () => {
  it("includes a usable authenticated display name", () => {
    expect(buildDashboardGreeting("Alex", atHour(9))).toBe(
      "Good morning, Alex."
    );
    expect(buildDashboardGreeting("Alex Rivera", atHour(14))).toBe(
      "Good afternoon, Alex."
    );
  });

  it("omits the name when no usable name exists", () => {
    expect(buildDashboardGreeting(null, atHour(9))).toBe("Good morning.");
    expect(buildDashboardGreeting(undefined, atHour(14))).toBe(
      "Good afternoon."
    );
    expect(buildDashboardGreeting("   ", atHour(20))).toBe("Good evening.");
    expect(buildDashboardGreeting("user@example.com", atHour(9))).toBe(
      "Good morning."
    );
  });

  it("never treats Olasubomi as a hard-coded fallback", () => {
    expect(getUsableDisplayName(null)).toBeNull();
    expect(getUsableDisplayName("")).toBeNull();
    expect(buildDashboardGreeting(null, atHour(9))).not.toContain("Olasubomi");
    expect(buildDashboardGreeting(undefined, atHour(9))).not.toContain(
      "Olasubomi"
    );
    expect(buildDashboardGreeting("", atHour(9))).not.toContain("Olasubomi");
  });
});

describe("dashboard date formatting", () => {
  it("renders a professional dynamic date label", () => {
    const date = new Date(2026, 7, 28, 10, 0, 0, 0);
    const label = formatDashboardDate(date, "en-GB");
    expect(label).toContain("28");
    expect(label).toContain("August");
    expect(label).toContain("2026");
    expect(label).toMatch(/Friday/i);
  });
});
