const express = require("express");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const publicDir = path.join(__dirname, "public");

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const verifyToken = process.env.VERIFY_TOKEN;
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/api")
  .replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL || "gemma4:e4b";
const ollamaThink = parseThinkSetting(process.env.OLLAMA_THINK);
const processInboundWebhooks = process.env.PROCESS_INBOUND_WEBHOOKS === "true";
const maxConversationMessages = Number(process.env.MAX_CONVERSATION_MESSAGES) || 24;
const forwardWebhookUrl = normalizeText(process.env.FORWARD_WEBHOOK_URL);
const forwardWebhookTimeoutMs = Number(process.env.FORWARD_WEBHOOK_TIMEOUT_MS) || 15000;
const renderApiBaseUrl = normalizeText(process.env.RENDER_API_BASE_URL) || "https://api.render.com/v1";
const renderApiKey = normalizeText(process.env.RENDER_API_KEY);
const renderServiceId =
  normalizeText(process.env.RENDER_FORWARD_WEBHOOK_SERVICE_ID) ||
  normalizeText(process.env.RENDER_SERVICE_ID);
const renderDynamicForwardWebhookUrl =
  process.env.RENDER_DYNAMIC_FORWARD_WEBHOOK_URL === "true";
const forwardWebhookCacheTtlMs = Number(process.env.FORWARD_WEBHOOK_CACHE_TTL_MS) || 10000;
const systemPrompt =
  process.env.SYSTEM_PROMPT ||
  [
    "You are a concise and helpful local chat assistant.",
    "Answer in the same language as the user unless asked otherwise.",
    "Keep replies practical and easy to scan.",
  ].join(" ");

const conversations = new Map();
const forwardWebhookState = {
  cachedUrl: forwardWebhookUrl,
  expiresAt: 0,
  lastLoggedUrl: "",
  inFlight: null,
};

app.use("/chat", express.static(publicDir));

app.get("/healthz", (_req, res) => {
  return res.status(200).json({ ok: true });
});

app.get("/chat", (_req, res) => {
  return res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/api/local-chat/config", async (_req, res) => {
  const ollamaStatus = await getOllamaStatus();

  return res.json({
    model: ollamaModel,
    baseUrl: ollamaBaseUrl,
    think: ollamaThink,
    ollama: ollamaStatus,
  });
});

app.get("/api/local-chat/state", async (req, res) => {
  const requestedSessionId = normalizeSessionId(req.query.sessionId);
  const sessionId = requestedSessionId || "local-default";
  const conversation = getConversation(sessionId);
  const ollamaStatus = await getOllamaStatus();

  return res.json({
    sessionId,
    messages: conversation.messages,
    model: ollamaModel,
    ollama: ollamaStatus,
  });
});

app.post("/api/local-chat/reset", (req, res) => {
  const sessionId = normalizeSessionId(req.body?.sessionId) || "local-default";

  conversations.delete(sessionId);

  return res.json({
    ok: true,
    sessionId,
  });
});

app.post("/api/local-chat/message", async (req, res) => {
  const sessionId = normalizeSessionId(req.body?.sessionId) || "local-default";
  const message = normalizeText(req.body?.message);
  const profileName = normalizeText(req.body?.profileName) || "Local User";

  if (!message) {
    return res.status(400).json({
      error: "Message is required.",
    });
  }

  try {
    const payload = buildSyntheticWebhookPayload({
      sessionId,
      message,
      profileName,
    });

    const result = await processIncomingPayload(payload, {
      source: "local-ui",
      sessionIdOverride: sessionId,
    });

    return res.json({
      ok: true,
      sessionId,
      reply: result.lastResult.reply,
      messages: result.lastResult.messages,
      model: result.lastResult.model,
      source: result.source,
    });
  } catch (error) {
    return res.status(502).json({
      error: error.message,
      sessionId,
      model: ollamaModel,
    });
  }
});

app.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  console.warn("WEBHOOK VERIFICATION FAILED", {
    mode,
    hasChallenge: typeof challenge !== "undefined",
    hasToken: typeof token !== "undefined" && token !== "",
    verifyTokenConfigured: Boolean(verifyToken),
    tokenMatches: token === verifyToken,
  });

  return res.status(403).end();
});

app.post("/", async (req, res) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const rawBody = req.rawBody || JSON.stringify(req.body);

  console.log(`\n\nWebhook received ${timestamp}\n`);
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const inboundMessages = extractIncomingMessages(req.body);

    if (inboundMessages.length > 0) {
      console.log(
        "Webhook message summary",
        inboundMessages.map((message) => ({
          sessionKey: message.sessionKey,
          profileName: message.profileName,
          text: message.text,
        })),
      );
    }

    if (processInboundWebhooks) {
      const result = await processIncomingPayload(req.body, {
        source: "webhook",
      });

      if (result.lastResult) {
        console.log("Generated local assistant reply for webhook", {
          sessionId: result.lastResult.sessionId,
          model: result.lastResult.model,
        });
      }
    }

    const activeForwardWebhookUrl = await resolveForwardWebhookUrl();

    if (activeForwardWebhookUrl) {
      const forwardResult = await forwardWebhook({
        url: activeForwardWebhookUrl,
        rawBody,
        signatureHeader: req.get("x-hub-signature-256"),
      });

      console.log("Webhook forward result", forwardResult);
    }
  } catch (error) {
    console.error("Webhook processing error", error.message);
  }

  return res.status(200).end();
});

app.listen(port, host, () => {
  if (!verifyToken) {
    console.warn(
      "\nWARNING: VERIFY_TOKEN is not set. GET verification requests will fail.\n",
    );
  }

  console.log(`\nListening on ${host}:${port}\n`);
  console.log(`Local chat UI: http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/chat`);
  console.log(`Ollama target: ${ollamaBaseUrl}/chat (${ollamaModel})`);
  if (renderDynamicForwardWebhookUrl) {
    console.log(
      `Forward webhook target: dynamic Render lookup (${renderServiceId || "missing service id"})`,
    );
  } else if (forwardWebhookUrl) {
    console.log(`Forwarding webhooks to: ${forwardWebhookUrl}`);
  }
});

function parseThinkSetting(value) {
  if (typeof value === "undefined" || value === "") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

function normalizeSessionId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 80);
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getConversation(sessionId) {
  let conversation = conversations.get(sessionId);

  if (!conversation) {
    conversation = {
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    conversations.set(sessionId, conversation);
  }

  return conversation;
}

function trimConversation(messages) {
  if (messages.length <= maxConversationMessages) {
    return messages;
  }

  return messages.slice(-maxConversationMessages);
}

function buildSyntheticWebhookPayload({ sessionId, message, profileName }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "local-ui",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "local-ui",
                phone_number_id: "local-ui",
              },
              contacts: [
                {
                  profile: {
                    name: profileName,
                  },
                  wa_id: sessionId,
                  user_id: sessionId,
                },
              ],
              messages: [
                {
                  id: randomUUID(),
                  timestamp,
                  from: sessionId,
                  from_user_id: sessionId,
                  type: "text",
                  text: {
                    body: message,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function extractIncomingMessages(payload) {
  const results = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== "messages") {
        continue;
      }

      const value = change.value || {};
      const contact = value.contacts?.[0] || {};
      const profileName = contact.profile?.name || "User";
      const sessionKey =
        contact.wa_id ||
        contact.user_id ||
        value.metadata?.phone_number_id ||
        "default";

      for (const message of value.messages || []) {
        if (message?.type !== "text" || !message?.text?.body) {
          continue;
        }

        results.push({
          messageId: message.id || randomUUID(),
          profileName,
          sessionKey,
          text: message.text.body,
        });
      }
    }
  }

  return results;
}

async function processIncomingPayload(payload, { source, sessionIdOverride } = {}) {
  const inboundMessages = extractIncomingMessages(payload);

  if (inboundMessages.length === 0) {
    return {
      processed: false,
      source,
      inboundCount: 0,
      lastResult: null,
    };
  }

  let lastResult = null;

  for (const inbound of inboundMessages) {
    const sessionId = sessionIdOverride || inbound.sessionKey;
    const conversation = getConversation(sessionId);
    const now = new Date().toISOString();

    conversation.messages.push({
      id: inbound.messageId,
      role: "user",
      content: inbound.text,
      createdAt: now,
      source,
      profileName: inbound.profileName,
    });
    conversation.messages = trimConversation(conversation.messages);
    conversation.updatedAt = now;

    const ollamaMessages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const ollamaResponse = await queryOllama(ollamaMessages);
    const assistantContent = sanitizeAssistantContent(
      ollamaResponse.message?.content || "",
    );

    conversation.messages.push({
      id: randomUUID(),
      role: "assistant",
      content: assistantContent || "(No content returned by model)",
      createdAt: new Date().toISOString(),
      source: "ollama",
      model: ollamaResponse.model || ollamaModel,
    });
    conversation.messages = trimConversation(conversation.messages);
    conversation.updatedAt = new Date().toISOString();

    lastResult = {
      sessionId,
      reply: assistantContent || "(No content returned by model)",
      messages: conversation.messages,
      model: ollamaResponse.model || ollamaModel,
    };
  }

  return {
    processed: true,
    source,
    inboundCount: inboundMessages.length,
    lastResult,
  };
}

async function queryOllama(messages) {
  const response = await fetch(`${ollamaBaseUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
      keep_alive: "10m",
      think: ollamaThink,
    }),
  });

  const responseText = await response.text();
  const parsed = tryParseJson(responseText);

  if (!response.ok) {
    throw new Error(
      `Ollama error ${response.status}: ${responseText || response.statusText}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Ollama returned a non-JSON response.");
  }

  return parsed;
}

async function getOllamaStatus() {
  try {
    const response = await fetch(`${ollamaBaseUrl}/tags`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return {
        reachable: false,
        status: response.status,
      };
    }

    const payload = await response.json();
    const availableModels = Array.isArray(payload.models)
      ? payload.models.map((model) => model.name)
      : [];

    return {
      reachable: true,
      status: response.status,
      availableModels,
      selectedModelAvailable: availableModels.includes(ollamaModel),
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error.message,
    };
  }
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeAssistantContent(content) {
  return content
    .replace(/<\|channel\>thought[\s\S]*?<channel\|>/g, "")
    .replace(/<\|channel\>thought/g, "")
    .replace(/<channel\|>/g, "")
    .trim();
}

async function forwardWebhook({ url, rawBody, signatureHeader }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signatureHeader ? { "x-hub-signature-256": signatureHeader } : {}),
    },
    signal: AbortSignal.timeout(forwardWebhookTimeoutMs),
    body: rawBody,
  });

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: responseText.slice(0, 500),
  };
}

async function resolveForwardWebhookUrl() {
  if (!renderDynamicForwardWebhookUrl) {
    return forwardWebhookUrl;
  }

  if (!renderApiKey || !renderServiceId) {
    if (forwardWebhookUrl) {
      return forwardWebhookUrl;
    }

    console.warn(
      "Dynamic Render lookup is enabled but RENDER_API_KEY or RENDER_SERVICE_ID is missing.",
    );
    return "";
  }

  const now = Date.now();

  if (forwardWebhookState.cachedUrl && now < forwardWebhookState.expiresAt) {
    return forwardWebhookState.cachedUrl;
  }

  if (forwardWebhookState.inFlight) {
    return forwardWebhookState.inFlight;
  }

  forwardWebhookState.inFlight = fetchForwardWebhookUrlFromRender()
    .then((url) => {
      forwardWebhookState.cachedUrl = url;
      forwardWebhookState.expiresAt = Date.now() + forwardWebhookCacheTtlMs;
      logForwardWebhookTarget(url);
      return url;
    })
    .catch((error) => {
      console.error(`Failed to refresh FORWARD_WEBHOOK_URL from Render: ${error.message}`);

      if (forwardWebhookState.cachedUrl) {
        return forwardWebhookState.cachedUrl;
      }

      return forwardWebhookUrl;
    })
    .finally(() => {
      forwardWebhookState.inFlight = null;
    });

  return forwardWebhookState.inFlight;
}

async function fetchForwardWebhookUrlFromRender() {
  const response = await fetch(
    `${renderApiBaseUrl}/services/${renderServiceId}/env-vars/FORWARD_WEBHOOK_URL`,
    {
      headers: {
        Authorization: `Bearer ${renderApiKey}`,
      },
      signal: AbortSignal.timeout(forwardWebhookTimeoutMs),
    },
  );

  const responseText = await response.text();
  const payload = tryParseJson(responseText);

  if (response.status === 404) {
    return "";
  }

  if (!response.ok) {
    throw new Error(
      `Render lookup error ${response.status}: ${responseText || response.statusText}`,
    );
  }

  return normalizeText(
    payload?.value ||
      payload?.envVar?.value ||
      payload?.data?.value ||
      payload?.envVarValue ||
      "",
  );
}

function logForwardWebhookTarget(url) {
  if (!url || url === forwardWebhookState.lastLoggedUrl) {
    return;
  }

  forwardWebhookState.lastLoggedUrl = url;
  console.log(`Forwarding webhooks to: ${url}`);
}
