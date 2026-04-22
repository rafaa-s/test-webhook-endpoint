import { appConfig } from "@/lib/config";
import { ConversationInsightsResponse } from "@/lib/types";
import { analyzeConversation } from "@/lib/server/conversation-analyzer";
import { getConversation } from "@/lib/server/conversation-store";
import { getInventorySnapshot, rankListings } from "@/lib/server/inventory-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/conversations/[id]/insights">,
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "live" ? "live" : appConfig.defaultMode;
  const conversation = getConversation(mode, id);

  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const inventory = await getInventorySnapshot();
  const baseAnalysis = analyzeConversation(conversation, inventory.listings);
  const matches = rankListings(
    inventory.listings,
    {
      area: baseAnalysis.extractedEntities.area,
      propertyType: baseAnalysis.extractedEntities.propertyType,
      bedrooms: baseAnalysis.extractedEntities.bedrooms,
      features: baseAnalysis.extractedEntities.features,
      budgetAmount: baseAnalysis.extractedEntities.budget?.amount,
      recentText: conversation.messages.map((message) => message.text).join(" "),
    },
    6,
  );
  const analysis = analyzeConversation(conversation, inventory.listings, matches);
  const inventoryMeta = {
    status: inventory.status,
    path: inventory.path,
    count: inventory.count,
    headers: inventory.headers,
    normalizedFields: inventory.normalizedFields,
    loadedAt: inventory.loadedAt,
    error: inventory.error,
  };

  const response: ConversationInsightsResponse = {
    mode,
    conversation,
    analysis,
    matches,
    inventory: inventoryMeta,
  };

  return Response.json(response);
}
