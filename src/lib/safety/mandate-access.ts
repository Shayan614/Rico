import { and, eq } from "drizzle-orm";
import { db, mandates, type MandateRecord } from "@/db";

/**
 * Returns the mandate only if this user owns it. A mandate with no owner matches nobody.
 * Callers respond the same way as for a missing mandate, so IDs cannot be probed.
 */
export async function getOwnedMandate(
  mandateId: string,
  ownerId: string
): Promise<MandateRecord | undefined> {
  const [mandate] = await db
    .select()
    .from(mandates)
    .where(and(eq(mandates.id, mandateId), eq(mandates.ownerId, ownerId)))
    .limit(1);
  return mandate;
}
