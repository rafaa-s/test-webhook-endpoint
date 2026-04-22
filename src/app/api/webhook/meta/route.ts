import { NextRequest } from "next/server";

import { appConfig } from "@/lib/config";
import { ingestMetaWebhook } from "@/lib/server/conversation-store";
import {
  mirrorWebhookPayload,
  verifyMetaWebhookSignature,
} from "@/lib/server/meta-whatsapp";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const token = request.nextUrl.searchParams.get("hub.verify_token");

  if (mode === "subscribe" && token === appConfig.metaVerifyToken) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signatureHeader)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  ingestMetaWebhook(payload);

  try {
    await mirrorWebhookPayload(rawBody);
  } catch {
    // Mirror failures should not block webhook acknowledgment.
  }

  return Response.json({ received: true });
}
