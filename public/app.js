const messageContainer = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const messageInput = document.querySelector("#message-input");
const sessionIdNode = document.querySelector("#session-id");
const modelNameNode = document.querySelector("#model-name");
const ollamaStatusNode = document.querySelector("#ollama-status");
const composerStatusNode = document.querySelector("#composer-status");
const resetButton = document.querySelector("#reset-button");
const refreshButton = document.querySelector("#refresh-button");
const messageTemplate = document.querySelector("#message-template");

const sessionId = getOrCreateSessionId();

init().catch((error) => {
  renderMessages([
    createSystemMessage(
      `Failed to initialize UI.\n\n${error.message}`,
      "error",
    ),
  ]);
});

async function init() {
  sessionIdNode.textContent = sessionId;
  await Promise.all([loadConfig(), loadState()]);
  wireEvents();
  messageInput.focus();
}

function wireEvents() {
  composer.addEventListener("submit", handleSubmit);
  resetButton.addEventListener("click", handleReset);
  refreshButton.addEventListener("click", async () => {
    await loadConfig();
    composerStatusNode.textContent = "Status refreshed";
  });
  messageInput.addEventListener("input", autoResizeTextarea);
}

async function handleSubmit(event) {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  const optimisticMessages = getRenderedMessages();
  optimisticMessages.push({
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
  });
  optimisticMessages.push(createSystemMessage("Thinking with Ollama...", "pending"));

  renderMessages(optimisticMessages);
  setComposerState(true, "Sending...");
  messageInput.value = "";
  autoResizeTextarea();

  try {
    const response = await fetch("/api/local-chat/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        message: text,
        profileName: "Local User",
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unknown backend error");
    }

    renderMessages(payload.messages);
    composerStatusNode.textContent = "Reply received";
    await loadConfig();
  } catch (error) {
    const currentMessages = getRenderedMessages().filter(
      (message) => message.kind !== "pending",
    );
    currentMessages.push(
      createSystemMessage(
        `Ollama request failed.\n\n${error.message}`,
        "error",
      ),
    );
    renderMessages(currentMessages);
    composerStatusNode.textContent = "Failed";
  } finally {
    setComposerState(false, "Ready");
    messageInput.focus();
  }
}

async function handleReset() {
  setComposerState(true, "Clearing...");

  try {
    await fetch("/api/local-chat/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    renderMessages([]);
    composerStatusNode.textContent = "Chat cleared";
  } finally {
    setComposerState(false, "Ready");
    messageInput.focus();
  }
}

async function loadConfig() {
  const response = await fetch("/api/local-chat/config");
  const payload = await response.json();

  modelNameNode.textContent = payload.model;
  ollamaStatusNode.textContent = buildOllamaStatus(payload.ollama);
}

async function loadState() {
  const response = await fetch(`/api/local-chat/state?sessionId=${encodeURIComponent(sessionId)}`);
  const payload = await response.json();
  renderMessages(payload.messages || []);
}

function renderMessages(messages) {
  messageContainer.innerHTML = "";

  if (!messages.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent =
      "Local UI is ready. Your message will be wrapped into a synthetic webhook payload and sent to Ollama through the same processing layer used by the webhook parser.";
    messageContainer.appendChild(emptyState);
    return;
  }

  for (const message of messages) {
    const node = messageTemplate.content.firstElementChild.cloneNode(true);
    const roleNode = node.querySelector(".message-role");
    const timeNode = node.querySelector(".message-time");
    const bodyNode = node.querySelector(".message-body");

    node.classList.add(message.role || "system");

    if (message.kind) {
      node.classList.add(message.kind);
    }

    roleNode.textContent = labelForRole(message.role, message.kind);
    timeNode.textContent = formatTime(message.createdAt);
    bodyNode.textContent = message.content;

    messageContainer.appendChild(node);
  }

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function createSystemMessage(content, kind) {
  return {
    role: "system",
    content,
    createdAt: new Date().toISOString(),
    kind,
  };
}

function getRenderedMessages() {
  return Array.from(messageContainer.querySelectorAll(".message")).map((node) => ({
    role: Array.from(node.classList).find((value) =>
      ["user", "assistant", "system"].includes(value),
    ),
    kind: Array.from(node.classList).find((value) =>
      ["pending", "error"].includes(value),
    ),
    content: node.querySelector(".message-body").textContent,
    createdAt: new Date().toISOString(),
  }));
}

function labelForRole(role, kind) {
  if (kind === "pending") {
    return "Pending";
  }

  if (kind === "error") {
    return "Error";
  }

  if (role === "user") {
    return "You";
  }

  if (role === "assistant") {
    return "Gemma 4";
  }

  return "System";
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildOllamaStatus(ollama) {
  if (!ollama?.reachable) {
    return `Unavailable${ollama?.error ? `: ${ollama.error}` : ""}`;
  }

  if (ollama.selectedModelAvailable) {
    return "Connected. Selected model is available.";
  }

  if (Array.isArray(ollama.availableModels) && ollama.availableModels.length > 0) {
    return `Connected. Model not pulled yet. Available: ${ollama.availableModels.join(", ")}`;
  }

  return "Connected. No local models reported yet.";
}

function setComposerState(disabled, label) {
  composer.querySelector("button[type='submit']").disabled = disabled;
  messageInput.disabled = disabled;
  resetButton.disabled = disabled;
  refreshButton.disabled = disabled;
  composerStatusNode.textContent = label;
}

function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
}

function getOrCreateSessionId() {
  const storageKey = "local-webhook-chat-session";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const created = `local-${crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}
