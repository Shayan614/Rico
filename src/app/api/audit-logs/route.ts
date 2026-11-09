import { NextResponse } from "next/server";
import { db, auditLogs, mandates } from "@/db";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { requireSession } from "@/lib/auth/require-session";
import { getOwnedMandate } from "@/lib/safety/mandate-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    // Logs with no mandate have no owner, so they are returned to nobody.
    const list = await db
      .select(getTableColumns(auditLogs))
      .from(auditLogs)
      .innerJoin(mandates, eq(auditLogs.mandateId, mandates.id))
      .where(eq(mandates.ownerId, auth.session.user.id))
      .orderBy(desc(auditLogs.timestamp));
    return NextResponse.json({ auditLogs: list });
  } catch (error) {
    console.error("Failed to query audit logs:", error);
    return NextResponse.json(
      { error: "Failed to query audit logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (body.mandateId && !(await getOwnedMandate(String(body.mandateId), auth.session.user.id))) {
      return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
    }
    const id = body.id || `log-${Date.now()}`;

    const newLog = {
      id,
      mandateId: body.mandateId || null,
      timestamp:
        body.timestamp ||
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      eventType: body.eventType,
      service: body.service,
      details: body.details,
      severity: body.severity || "info",
      metadata: body.metadata || null,
    };

    await db.insert(auditLogs).values(newLog);

    return NextResponse.json({ auditLog: newLog }, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 }
    );
  }
}
