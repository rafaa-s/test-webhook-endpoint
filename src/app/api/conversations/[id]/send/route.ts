import { appConfig } from "@/lib/config";
import {
  appendMessage,
  getConversation,
  updateMessageById,
} from "@/lib/server/conversation-store";
import { sendWhatsAppTextMessage } from "@/lib/server/meta-whatsapp";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/send">,
) {
  const body = (await request.json()) as {
    mode?: "demo" | "live";
    text?: string;
    manual?: boolean;
  };

  if (!body.text?.trim()) {
    return Response.json({ error: "Message text is required." }, { status: 400 });
  }

  const { id } = await context.params;
  const mode = body.mode === "live" ? "live" : appConfig.defaultMode;
  const currentConversation = getConversation(mode, id);
  if (!currentConversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const stagedConversation = appendMessage({
    mode,
    conversationId: id,
    direction: "outbound",
    text: body.text.trim(),
    status:
      mode === "live" && !body.manual
        ? "pending"
        : body.manual
          ? "manual"
          : "sent",
    source: "operator",
    authorLabel: "Operator",
    meta: {
      channel: mode === "live" && !body.manual ? "whatsapp-cloud-api" : "demo",
    },
  });

  if (!stagedConversation) {
    return Response.json({ error: "Unable to stage message." }, { status: 500 });
  }

  const stagedMessage = [...stagedConversation.messages]
    .reverse()
    .find((message) => message.direction === "outbound");

  if (!stagedMessage) {
    return Response.json({ error: "Unable to locate staged message." }, { status: 500 });
  }

  if (mode === "live" && !body.manual) {
    try {
      const apiResponse = await sendWhatsAppTextMessage({
        to: currentConversation.phone,
        text: body.text.trim(),
      });

      const conversation = updateMessageById({
        mode,
        conversationId: id,
        messageId: stagedMessage.id,
        patch: {
          status: "sent",
          meta: {
            wamid: apiResponse.wamid,
            apiResponse: apiResponse.raw,
          },
        },
      });

      if (!conversation) {
        return Response.json(
          { error: "Message was sent but local state could not be updated." },
          { status: 500 },
        );
      }

      return Response.json({ conversation });
    } catch (error) {
      const conversation =
        updateMessageById({
          mode,
          conversationId: id,
          messageId: stagedMessage.id,
          patch: {
            status: "failed",
            meta: {
              sendError:
                error instanceof Error ? error.message : "WhatsApp send failed.",
            },
          },
        }) || stagedConversation;

      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "WhatsApp send failed.",
          conversation,
        },
        { status: 502 },
      );
    }
  }

  return Response.json({ conversation: stagedConversation });
}
