import { appConfig } from "@/lib/config";
import { analyzeConversation } from "@/lib/server/conversation-analyzer";
import { getConversation, saveDraft } from "@/lib/server/conversation-store";
import { buildDraftReply } from "@/lib/server/draft-engine";
import { getInventorySnapshot, rankListings } from "@/lib/server/inventory-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/draft">,
) {
  const body = (await request.json()) as {
    mode?: "demo" | "live";
    transform?: string;
  };
  const { id } = await context.params;
  const mode = body.mode === "live" ? "live" : appConfig.defaultMode;
  const transform = body.transform || "default";
  const conversation = getConversation(mode, id);

  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const inventory = await getInventorySnapshot();
  const analysis = analyzeConversation(conversation, inventory.listings);
  const matches = rankListings(
    inventory.listings,
    {
      area: analysis.extractedEntities.area,
      propertyType: analysis.extractedEntities.propertyType,
      bedrooms: analysis.extractedEntities.bedrooms,
      features: analysis.extractedEntities.features,
      budgetAmount: analysis.extractedEntities.budget?.amount,
      recentText: conversation.messages.map((message) => message.text).join(" "),
    },
    6,
  );
  const enrichedAnalysis = analyzeConversation(conversation, inventory.listings, matches);
  const draft = await buildDraftReply({
    conversation,
    analysis: enrichedAnalysis,
    matches,
    transform,
  });

  saveDraft(mode, id, draft);

  return Response.json({
    draft,
    analysis: enrichedAnalysis,
    matches,
  });
}
