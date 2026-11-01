import { NextResponse } from "next/server";
import { db, auditLogs } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .all();
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
  try {
    const body = await request.json();
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

    db.insert(auditLogs).values(newLog).run();

    return NextResponse.json({ auditLog: newLog }, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 }
    );
  }
}
