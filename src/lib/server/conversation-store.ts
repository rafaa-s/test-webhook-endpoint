import {
  AppMode,
  ConversationMessage,
  ConversationRecord,
  ConversationSummary,
  DraftReply,
  MessageKind,
} from "@/lib/types";
import { generateId } from "@/lib/utils";

import { buildDemoConversations } from "@/lib/server/demo-seeds";

type StoreShape = {
  demo: Map<string, ConversationRecord>;
  live: Map<string, ConversationRecord>;
};

const GLOBAL_KEY = "__WA_SALES_CONVERSATION_STORE__";

function sortMessages(messages: ConversationMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

function getContainer() {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: StoreShape;
  };

  if (!globalObject[GLOBAL_KEY]) {
    globalObject[GLOBAL_KEY] = {
      demo: new Map(buildDemoConversations().map((conversation) => [conversation.id, conversation])),
      live: new Map<string, ConversationRecord>(),
    };
  }

  return globalObject[GLOBAL_KEY];
}

function summarizeConversation(conversation: ConversationRecord): ConversationSummary {
  const sortedMessages = sortMessages(conversation.messages);
  const lastMessage = sortedMessages.at(-1);
  const latestInbound = [...sortedMessages]
    .reverse()
    .find((message) => message.direction === "inbound");

  return {
    id: conversation.id,
    customerName: conversation.customerName,
    phone: conversation.phone,
    avatarColor: conversation.avatarColor,
    mode: conversation.mode,
    assignee: conversation.assignee,
    unreadCount: conversation.unreadCount,
    lastActivityAt: conversation.lastActivityAt,
    lastMessagePreview: lastMessage?.text || "No messages yet",
    latestInboundAt: latestInbound?.timestamp,
  };
}

function upsertConversation(mode: AppMode, conversation: ConversationRecord) {
  getContainer()[mode].set(conversation.id, {
    ...conversation,
    messages: sortMessages(conversation.messages),
  });
}

export function listConversationSummaries(mode: AppMode) {
  return Array.from(getContainer()[mode].values())
    .map((conversation) => summarizeConversation(conversation))
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );
}

export function getConversation(mode: AppMode, id: string) {
  return getContainer()[mode].get(id);
}

export function saveDraft(mode: AppMode, id: string, draft: DraftReply) {
  const conversation = getConversation(mode, id);
  if (!conversation) return undefined;

  const updated: ConversationRecord = {
    ...conversation,
    draft,
  };
  upsertConversation(mode, updated);
  return updated;
}

export function createLiveConversation(payload: {
  conversationId: string;
  customerName: string;
  phone: string;
}) {
  const existing = getConversation("live", payload.conversationId);
  if (existing) return existing;

  const nextConversation: ConversationRecord = {
    id: payload.conversationId,
    customerName: payload.customerName,
    phone: payload.phone,
    avatarColor: "from-green-500 to-emerald-700",
    mode: "live",
    assignee: "Live queue",
    unreadCount: 0,
    lastActivityAt: new Date().toISOString(),
    leadSource: "WhatsApp webhook",
    messages: [],
  };

  upsertConversation("live", nextConversation);
  return nextConversation;
}

export function appendMessage(payload: {
  mode: AppMode;
  conversationId: string;
  direction: "inbound" | "outbound";
  text: string;
  status?: ConversationMessage["status"];
  source?: ConversationMessage["source"];
  authorLabel?: string;
  kind?: MessageKind;
  timestamp?: string;
  meta?: Record<string, unknown>;
}) {
  const conversation = getConversation(payload.mode, payload.conversationId);
  if (!conversation) return undefined;

  const timestamp = payload.timestamp || new Date().toISOString();
  const nextMessage: ConversationMessage = {
    id: generateId("msg"),
    direction: payload.direction,
    text: payload.text,
    timestamp,
    kind: payload.kind || "text",
    source:
      payload.source ||
      (payload.direction === "inbound" ? "customer" : "operator"),
    authorLabel:
      payload.authorLabel ||
      (payload.direction === "inbound"
        ? conversation.customerName
        : "Sales Assistant"),
    status: payload.direction === "outbound" ? payload.status || "sent" : undefined,
    meta: payload.meta,
  };

  const updated: ConversationRecord = {
    ...conversation,
    messages: sortMessages([...conversation.messages, nextMessage]),
    lastActivityAt: timestamp,
    unreadCount:
      payload.direction === "inbound" ? conversation.unreadCount + 1 : 0,
  };

  upsertConversation(payload.mode, updated);
  return updated;
}

export function updateMessageByWamid(payload: {
  mode: AppMode;
  conversationId: string;
  wamid: string;
  patch: Partial<ConversationMessage>;
}) {
  const conversation = getConversation(payload.mode, payload.conversationId);
  if (!conversation) return undefined;

  let found = false;
  const messages = conversation.messages.map((message) => {
    const currentWamid =
      typeof message.meta?.wamid === "string" ? message.meta.wamid : undefined;

    if (currentWamid !== payload.wamid) {
      return message;
    }

    found = true;
    return {
      ...message,
      ...payload.patch,
      meta: {
        ...(message.meta || {}),
        ...(payload.patch.meta || {}),
      },
    };
  });

  if (!found) {
    return undefined;
  }

  const updated: ConversationRecord = {
    ...conversation,
    messages: sortMessages(messages),
    lastActivityAt: new Date().toISOString(),
  };

  upsertConversation(payload.mode, updated);
  return updated;
}

export function updateMessageById(payload: {
  mode: AppMode;
  conversationId: string;
  messageId: string;
  patch: Partial<ConversationMessage>;
}) {
  const conversation = getConversation(payload.mode, payload.conversationId);
  if (!conversation) return undefined;

  let found = false;
  const messages = conversation.messages.map((message) => {
    if (message.id !== payload.messageId) {
      return message;
    }

    found = true;
    return {
      ...message,
      ...payload.patch,
      meta: {
        ...(message.meta || {}),
        ...(payload.patch.meta || {}),
      },
    };
  });

  if (!found) {
    return undefined;
  }

  const updated: ConversationRecord = {
    ...conversation,
    messages: sortMessages(messages),
    lastActivityAt: new Date().toISOString(),
  };

  upsertConversation(payload.mode, updated);
  return updated;
}

function inferMessageKind(message: Record<string, unknown>): MessageKind {
  const type = String(message.type || "text");

  if (type === "image") return "image";
  if (type === "document") return "document";
  if (type === "audio") return "voice";
  if (type === "location") return "location";
  return "text";
}

function extractMessageText(message: Record<string, unknown>) {
  if (typeof message.text === "object" && message.text) {
    const body = (message.text as { body?: string }).body;
    if (body) return body;
  }

  const type = String(message.type || "text");
  return `[${type.toUpperCase()} message received - UI hook ready]`;
}

export function ingestMetaWebhook(payload: Record<string, unknown>) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
      ? (entry as { changes: unknown[] }).changes
      : [];

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: Record<string, unknown> }).value;
      if (!value) continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const message of messages) {
        if (!message || typeof message !== "object") continue;
        const typedMessage = message as Record<string, unknown>;
        const waId = String(typedMessage.from || "unknown");
        const profileName =
          typeof contacts[0] === "object" &&
          contacts[0] &&
          typeof (contacts[0] as { profile?: { name?: string } }).profile?.name === "string"
            ? (contacts[0] as { profile: { name: string } }).profile.name
            : `Lead ${waId}`;

        const conversationId = `live-${waId}`;
        createLiveConversation({
          conversationId,
          customerName: profileName,
          phone: waId,
        });

        appendMessage({
          mode: "live",
          conversationId,
          direction: "inbound",
          text: extractMessageText(typedMessage),
          source: "webhook",
          authorLabel: profileName,
          kind: inferMessageKind(typedMessage),
          timestamp: typedMessage.timestamp
            ? new Date(Number(typedMessage.timestamp) * 1000).toISOString()
            : undefined,
          meta: {
            wamid: typedMessage.id,
            fromUserId: typedMessage.from_user_id,
            rawType: typedMessage.type,
          },
        });
      }

      for (const statusItem of statuses) {
        if (!statusItem || typeof statusItem !== "object") continue;
        const typedStatus = statusItem as Record<string, unknown>;
        const recipientId = String(typedStatus.recipient_id || "unknown");
        const wamid = String(typedStatus.id || "");
        if (!wamid) continue;

        const conversationId = `live-${recipientId}`;
        createLiveConversation({
          conversationId,
          customerName: `Lead ${recipientId}`,
          phone: recipientId,
        });

        const nextStatus = (() => {
          const rawStatus = String(typedStatus.status || "");
          if (rawStatus === "sent") return "sent";
          if (rawStatus === "delivered") return "delivered";
          if (rawStatus === "read") return "read";
          if (rawStatus === "failed") return "failed";
          return undefined;
        })();

        updateMessageByWamid({
          mode: "live",
          conversationId,
          wamid,
          patch: {
            status: nextStatus,
            meta: {
              statusRaw: typedStatus.status,
              conversationRaw: typedStatus.conversation,
              pricingRaw: typedStatus.pricing,
              errorsRaw: typedStatus.errors,
            },
          },
        });
      }
    }
  }
}
