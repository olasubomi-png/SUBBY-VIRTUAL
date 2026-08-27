import { describe, expect, it } from "vitest";
import { getServerBinding } from "./runtimeConfig";

describe("runtime server binding", () => {
  it("binds production to loopback and keeps the configured port strict", () => {
    expect(getServerBinding({ NODE_ENV: "production", PORT: "3000" })).toEqual({
      host: "127.0.0.1",
      port: 3000,
      allowPortFallback: false,
    });
  });

  it("allows the development preview binding and port fallback", () => {
    expect(getServerBinding({ NODE_ENV: "development", PORT: "5173" })).toEqual(
      {
        host: "0.0.0.0",
        port: 5173,
        allowPortFallback: true,
      }
    );
  });

  it("rejects invalid configured ports instead of silently binding elsewhere", () => {
    expect(() => getServerBinding({ PORT: "0" })).toThrow(
      "PORT must be an integer between 1 and 65535"
    );
  });
});
