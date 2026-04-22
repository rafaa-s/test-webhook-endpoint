import { appConfig } from "@/lib/config";
import { DashboardResponse } from "@/lib/types";
import { listConversationSummaries } from "@/lib/server/conversation-store";
import { getInventorySnapshot } from "@/lib/server/inventory-service";
import { getWhatsAppConnectionState } from "@/lib/server/meta-whatsapp";

export const runtime = "nodejs";

function resolveMode(searchParams: URLSearchParams) {
  return searchParams.get("mode") === "live" ? "live" : appConfig.defaultMode;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = resolveMode(url.searchParams);
  const inventory = await getInventorySnapshot();
  const inventoryMeta = {
    status: inventory.status,
    path: inventory.path,
    count: inventory.count,
    headers: inventory.headers,
    normalizedFields: inventory.normalizedFields,
    loadedAt: inventory.loadedAt,
    error: inventory.error,
  };

  const response: DashboardResponse = {
    mode,
    inventory: inventoryMeta,
    conversations: listConversationSummaries(mode),
    ollama: {
      baseUrl: appConfig.ollamaBaseUrl,
      model: appConfig.ollamaModel,
    },
    whatsapp: getWhatsAppConnectionState(),
    webhookEndpoint: "/api/webhook/meta",
  };

  return Response.json(response);
}
