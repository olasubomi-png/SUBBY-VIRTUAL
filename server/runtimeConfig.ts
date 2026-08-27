export type RuntimeEnvironment = Record<string, string | undefined>;

export function getServerBinding(env: RuntimeEnvironment = process.env) {
  const configuredPort = env.PORT ?? "3000";
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const production = env.NODE_ENV === "production";
  return {
    host: env.HOST || (production ? "127.0.0.1" : "0.0.0.0"),
    port,
    allowPortFallback: !production,
  };
}
