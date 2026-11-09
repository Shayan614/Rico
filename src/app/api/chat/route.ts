import { NextRequest, NextResponse } from "next/server";
import { ensureOwnerRecord, requireSession } from "@/lib/auth/require-session";
import { geminiAgent } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  try {
    await ensureOwnerRecord(auth.session);
    const body = await req.json();
    const { message, strictMode, mandates } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string." },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = geminiAgent.streamResponse(message, {
            ownerId: auth.session.user.id,
            strictMode,
            activeMandates: mandates,
          });

          for await (const event of generator) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          controller.close();
        } catch (err: unknown) {
          const errorMsg =
            err instanceof Error ? err.message : "Internal streaming error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
