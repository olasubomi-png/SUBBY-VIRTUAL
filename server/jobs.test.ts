import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

describe("demo cleanup job", () => {
  beforeEach(() => getDb.mockReset());

  it("expires both resource classes through database updates", async () => {
    const updates: unknown[] = [];
    const db = {
      update: () => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: async () => {
              updates.push(values);
              return [{ id: updates.length }];
            },
          }),
        }),
      }),
    };
    getDb.mockResolvedValue(db);
    const { expireDemoResources } = await import("./jobs");
    const result = await expireDemoResources(new Date("2026-08-26T00:00:00Z"));
    expect(result).toEqual({ inboxes: 1, activations: 1 });
    expect(updates).toEqual([
      { status: "EXPIRED", deletedAt: new Date("2026-08-26T00:00:00Z") },
      { status: "EXPIRED", updatedAt: new Date("2026-08-26T00:00:00Z") },
    ]);
  });
});
