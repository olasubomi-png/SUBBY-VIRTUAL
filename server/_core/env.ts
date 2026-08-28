export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  bootstrapAdminEmail: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL ?? "",
  scheduledDispatchToken: process.env.SCHEDULED_DISPATCH_TOKEN ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
