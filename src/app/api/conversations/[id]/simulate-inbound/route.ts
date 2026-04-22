import { appConfig } from "@/lib/config";
import { appendMessage } from "@/lib/server/conversation-store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/simulate-inbound">,
) {
  const body = (await request.json()) as {
    mode?: "demo" | "live";
    text?: string;
  };

  if (!body.text?.trim()) {
    return Response.json({ error: "Inbound text is required." }, { status: 400 });
  }

  const { id } = await context.params;
  const mode = body.mode === "live" ? "live" : appConfig.defaultMode;
  const conversation = appendMessage({
    mode,
    conversationId: id,
    direction: "inbound",
    text: body.text.trim(),
    source: "customer",
  });

  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  return Response.json({ conversation });
}
