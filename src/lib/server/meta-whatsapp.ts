import crypto from "node:crypto";

import { appConfig } from "@/lib/config";

type SendTextMessagePayload = {
  to: string;
  text: string;
  previewUrl?: boolean;
  contextMessageId?: string;
};

type MetaSendResponse = {
  messaging_product?: string;
  contacts?: Array<{
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
  error?: {
    message?: string;
    error_user_msg?: string;
    code?: number;
  };
};

function graphBaseUrl() {
  return `https://graph.facebook.com/${appConfig.whatsappGraphApiVersion}`;
}

export function getWhatsAppConnectionState() {
  return {
    webhookEndpoint: "/api/webhook/meta",
    apiConfigured: Boolean(appConfig.whatsappAccessToken),
    phoneNumberIdConfigured: Boolean(appConfig.whatsappPhoneNumberId),
    businessAccountIdConfigured: Boolean(appConfig.whatsappBusinessAccountId),
    appIdConfigured: Boolean(appConfig.whatsappAppId),
    appSecretConfigured: Boolean(appConfig.whatsappAppSecret),
    graphApiVersion: appConfig.whatsappGraphApiVersion,
    externalWebhookUrl: appConfig.externalWebhookUrl,
    localSecretsJsonPath: appConfig.localSecretsJsonPath,
  };
}

export function assertWhatsAppConfigured() {
  if (!appConfig.whatsappAccessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured.");
  }

  if (!appConfig.whatsappPhoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured.");
  }
}

export async function sendWhatsAppTextMessage(payload: SendTextMessagePayload) {
  assertWhatsAppConfigured();

  const response = await fetch(
    `${graphBaseUrl()}/${appConfig.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appConfig.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: payload.to,
        type: "text",
        context: payload.contextMessageId ? { message_id: payload.contextMessageId } : undefined,
        text: {
          body: payload.text,
          preview_url: payload.previewUrl ?? false,
        },
      }),
    },
  );

  const data = (await response.json()) as MetaSendResponse;

  if (!response.ok) {
    const message =
      data.error?.error_user_msg ||
      data.error?.message ||
      `WhatsApp API error ${response.status}`;
    throw new Error(message);
  }

  const wamid = data.messages?.[0]?.id;
  return {
    wamid,
    raw: data,
  };
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!appConfig.whatsappAppSecret) {
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", appConfig.whatsappAppSecret)
    .update(rawBody)
    .digest("hex");

  const received = signatureHeader.slice("sha256=".length);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(received, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

export async function mirrorWebhookPayload(rawBody: string) {
  if (!appConfig.externalWebhookUrl) {
    return { mirrored: false as const, reason: "No external webhook URL configured." };
  }

  const response = await fetch(appConfig.externalWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: rawBody,
  });

  return {
    mirrored: response.ok,
    status: response.status,
  };
}
