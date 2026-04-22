import fs from "node:fs";
import path from "node:path";

import { AppMode } from "@/lib/types";

const DEFAULT_INVENTORY_PATH =
  "C:\\Users\\rsoli\\Documents\\Scripts\\flamingobeachrealty_recopilado_2026-04-20\\featured_listing_details.csv";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
const DEFAULT_GRAPH_API_VERSION = "v23.0";
const DEFAULT_EXTERNAL_WEBHOOK_URL =
  "https://test-webhook-endpoint-luxz.onrender.com/";
const DEFAULT_LOCAL_SECRETS_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "secrets.whatsapp.local.json",
);

type LocalSecrets = {
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAppId?: string;
};

function normalizeMode(value?: string): AppMode {
  return value === "live" ? "live" : "demo";
}

function loadLocalSecrets(): LocalSecrets {
  const candidatePath =
    process.env.LOCAL_SECRETS_JSON_PATH || DEFAULT_LOCAL_SECRETS_PATH;

  if (!candidatePath || !fs.existsSync(candidatePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(candidatePath, "utf8");
    const parsed = JSON.parse(raw) as LocalSecrets;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const localSecrets = loadLocalSecrets();

export const appConfig = {
  inventoryCsvPath: process.env.INVENTORY_CSV_PATH || DEFAULT_INVENTORY_PATH,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
  metaVerifyToken:
    process.env.META_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    process.env.VERIFY_TOKEN ||
    "",
  whatsappAccessToken:
    process.env.WHATSAPP_ACCESS_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    localSecrets.whatsappAccessToken ||
    "",
  whatsappPhoneNumberId:
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    localSecrets.whatsappPhoneNumberId ||
    "",
  whatsappBusinessAccountId:
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
    localSecrets.whatsappBusinessAccountId ||
    "",
  whatsappAppId:
    process.env.WHATSAPP_APP_ID ||
    localSecrets.whatsappAppId ||
    "",
  whatsappAppSecret:
    process.env.WHATSAPP_APP_SECRET ||
    process.env.META_APP_SECRET ||
    localSecrets.whatsappAppSecret ||
    "",
  whatsappGraphApiVersion:
    process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION,
  externalWebhookUrl:
    process.env.WHATSAPP_EXTERNAL_WEBHOOK_URL ||
    process.env.EXTERNAL_WEBHOOK_URL ||
    process.env.RENDER_WEBHOOK_URL ||
    DEFAULT_EXTERNAL_WEBHOOK_URL,
  localSecretsJsonPath:
    process.env.LOCAL_SECRETS_JSON_PATH || DEFAULT_LOCAL_SECRETS_PATH,
  defaultMode: normalizeMode(process.env.DEFAULT_MODE),
};
