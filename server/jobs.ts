import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { smsActivations, temporaryInboxes } from "../drizzle/schema";

export async function expireDemoResources(now = new Date()) {
  const db = await getDb();
  if (!db) return { inboxes: 0, activations: 0 };
  const inboxes = await db
    .update(temporaryInboxes)
    .set({ status: "EXPIRED", deletedAt: now })
    .where(
      sql`${temporaryInboxes.status} = 'ACTIVE' and ${temporaryInboxes.expiresAt} <= ${now}`
    )
    .returning({ id: temporaryInboxes.id });
  const activations = await db
    .update(smsActivations)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(
      sql`${smsActivations.status} in ('CREATED', 'WAITING') and ${smsActivations.createdAt} <= ${now} - interval '30 minutes'`
    )
    .returning({ id: smsActivations.id });
  return { inboxes: inboxes.length, activations: activations.length };
}
