/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import useSWR from "swr";
import {
  Archive,
  BadgeDollarSign,
  BedDouble,
  Bot,
  BriefcaseBusiness,
  CircleAlert,
  ClipboardList,
  Flame,
  Filter,
  Home,
  LoaderCircle,
  MapPinned,
  MessageCircleMore,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  WandSparkles,
} from "lucide-react";

import {
  AppMode,
  ConversationInsightsResponse,
  ConversationSummary,
  DashboardResponse,
  DraftReply,
} from "@/lib/types";
import {
  cn,
  formatCompactCurrency,
  formatDay,
  formatTime,
  relativeTime,
} from "@/lib/utils";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

function deliveryLabel(status?: string) {
  if (status === "read") return "Read";
  if (status === "delivered") return "Delivered";
  if (status === "manual") return "Manual";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  return "";
}

function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "hot" | "warm" | "cool" | "accent";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
        tone === "hot" && "bg-rose-100 text-rose-700",
        tone === "warm" && "bg-amber-100 text-amber-800",
        tone === "cool" && "bg-slate-100 text-slate-700",
        tone === "accent" && "bg-emerald-100 text-emerald-700",
        tone === "default" &&
          "bg-white/75 text-slate-600 ring-1 ring-slate-200/80",
      )}
    >
      {label}
    </span>
  );
}

function ConversationItem({
  conversation,
  selected,
  onClick,
  insight,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onClick: () => void;
  insight?: ConversationInsightsResponse;
}) {
  const stage = insight?.analysis.leadStage || "Lead";
  const temperature = insight?.analysis.buyerTemperature || "New";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[24px] border p-4 text-left transition duration-150",
        selected
          ? "border-emerald-300 bg-emerald-50/90 shadow-[0_16px_40px_-28px_rgba(6,95,70,0.75)]"
          : "border-transparent bg-white/75 hover:border-slate-200 hover:bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white shadow-lg",
              conversation.avatarColor,
            )}
          >
            {conversation.customerName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {conversation.customerName}
            </div>
            <div className="text-xs text-slate-500">{conversation.phone}</div>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          {relativeTime(conversation.lastActivityAt)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge label={stage} tone="accent" />
        <Badge
          label={temperature}
          tone={
            temperature === "Hot"
              ? "hot"
              : temperature === "Warm"
                ? "warm"
                : "cool"
          }
        />
        {conversation.unreadCount > 0 ? (
          <Badge label={`${conversation.unreadCount} new`} tone="default" />
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
        {conversation.lastMessagePreview}
      </p>
    </button>
  );
}

function MessageBubble({
  message,
}: {
  message: ConversationInsightsResponse["conversation"]["messages"][number];
}) {
  const outbound = message.direction === "outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-[22px] px-4 py-3 shadow-sm",
          outbound
            ? "rounded-br-md bg-emerald-100 text-slate-800"
            : "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200/80",
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-6">{message.text}</div>
        <div
          className={cn(
            "mt-2 flex items-center gap-2 text-[11px]",
            outbound ? "justify-end text-emerald-800/70" : "text-slate-400",
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {outbound ? <span>{deliveryLabel(message.status)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function ListingCard({
  match,
}: {
  match: ConversationInsightsResponse["matches"][number];
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_45px_-38px_rgba(15,23,42,0.8)]">
      {match.thumbnailUrl ? (
        <img
          src={match.thumbnailUrl}
          alt={match.title}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 items-center justify-center bg-gradient-to-br from-emerald-100 via-teal-50 to-white text-sm text-slate-500">
          No preview image
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{match.title}</h3>
            <p className="mt-1 text-xs text-slate-500">{match.location}</p>
          </div>
          <Badge label={match.status || "Inventory"} tone="default" />
        </div>
        <div className="text-sm font-semibold text-emerald-700">
          {match.priceText || formatCompactCurrency(match.priceValue)}
        </div>
        <div className="flex flex-wrap gap-2">
          {match.keyAttributes.slice(0, 4).map((attribute) => (
            <span
              key={attribute}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
            >
              {attribute}
            </span>
          ))}
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {match.whyMatched.join(" | ")}
        </p>
      </div>
    </div>
  );
}

function LiveConversationItem({
  conversation,
  selected,
  onClick,
}: {
  conversation: ConversationSummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-white/6 px-4 py-3 text-left transition",
        selected ? "bg-white/12" : "hover:bg-white/6",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
          conversation.avatarColor,
        )}
      >
        {conversation.customerName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-[15px] font-medium text-[#e9edef]">
            {conversation.customerName}
          </div>
          <div className="shrink-0 text-[11px] text-[#8696a0]">
            {formatTime(conversation.lastActivityAt)}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-[13px] text-[#8696a0]">
            {conversation.lastMessagePreview}
          </p>
          {conversation.unreadCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-[#111b21]">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function LiveMessageBubble({
  message,
}: {
  message: ConversationInsightsResponse["conversation"]["messages"][number];
}) {
  const outbound = message.direction === "outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-lg px-3 py-2 text-[14px] leading-6 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          outbound
            ? "rounded-tr-sm bg-[#005c4b] text-[#e9edef]"
            : "rounded-tl-sm bg-[#202c33] text-[#e9edef]",
        )}
      >
        <div className="whitespace-pre-wrap">{message.text}</div>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#8696a0]">
          <span>{formatTime(message.timestamp)}</span>
          {outbound && message.status ? <span>{deliveryLabel(message.status)}</span> : null}
        </div>
      </div>
    </div>
  );
}

function LiveEmptyState() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/6 bg-[#202c33] px-4">
        <div className="text-sm font-medium text-[#e9edef]">WhatsApp</div>
        <div className="flex items-center gap-4 text-[#aebac1]">
          <Search className="h-5 w-5" />
          <MoreVertical className="h-5 w-5" />
        </div>
      </div>
      <div className="whatsapp-wallpaper relative flex-1 overflow-hidden bg-[#0b141a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(17,27,33,0.2),_rgba(11,20,26,0.55))]" />
        <div className="relative flex h-full items-center justify-center">
          <div className="rounded-2xl border border-white/8 bg-[#111b21]/78 px-6 py-5 text-center text-[#8696a0] backdrop-blur-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#202c33] text-[#25d366]">
              <MessageCircleMore className="h-6 w-6" />
            </div>
            <div className="text-base font-medium text-[#e9edef]">No chats yet</div>
            <div className="mt-2 max-w-sm text-sm leading-6">
              Live conversations will appear here as soon as the webhook receives a
              real WhatsApp message.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveLeadBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "green" | "amber" | "rose" | "sky" | "slate";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone === "green" && "border-[#1d5245] bg-[#103529] text-[#7ce6b0]",
        tone === "amber" && "border-[#5b4522] bg-[#2c2414] text-[#f4cf7a]",
        tone === "rose" && "border-[#5b2b36] bg-[#2d1720] text-[#ffb0c1]",
        tone === "sky" && "border-[#204755] bg-[#112a33] text-[#84d9ff]",
        tone === "slate" && "border-white/10 bg-[#172229] text-[#aebac1]",
      )}
    >
      {label}
    </span>
  );
}

function LiveInsightStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#111b21]/88 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8696a0]">
        <span className="text-[#25d366]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-medium leading-5 text-[#e9edef]">{value}</div>
    </div>
  );
}

function LeadSnapshotCard({
  analysis,
  match,
}: {
  analysis: ConversationInsightsResponse["analysis"];
  match?: ConversationInsightsResponse["matches"][number];
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[#111b21]/88 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#25d366]" />
          <div className="text-sm font-semibold text-[#e9edef]">Lead snapshot</div>
        </div>
        <LiveLeadBadge
          label={`${Math.round(analysis.seriousnessProbability * 100)}% serious`}
          tone="green"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <LiveInsightStat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Stage"
          value={analysis.leadStage}
        />
        <LiveInsightStat
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Temperature"
          value={analysis.buyerTemperature}
        />
        <LiveInsightStat
          icon={<ClipboardList className="h-3.5 w-3.5" />}
          label="Intent"
          value={analysis.intent}
        />
        <LiveInsightStat
          icon={<BadgeDollarSign className="h-3.5 w-3.5" />}
          label="Budget"
          value={analysis.budgetDetected}
        />
        <LiveInsightStat
          icon={<MapPinned className="h-3.5 w-3.5" />}
          label="Zones"
          value={analysis.preferredZones.join(", ") || "Not detected"}
        />
        <LiveInsightStat
          icon={<BedDouble className="h-3.5 w-3.5" />}
          label="Bedrooms"
          value={analysis.bedrooms.join(", ") || "Open"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LiveLeadBadge label={analysis.messageType} tone="sky" />
        <LiveLeadBadge label={analysis.sentiment} tone="slate" />
        {analysis.followUpNeeded ? (
          <LiveLeadBadge label="Follow-up needed" tone="amber" />
        ) : null}
      </div>

      {match ? (
        <div className="mt-4 rounded-2xl border border-[#1d5245] bg-[#0f171c] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#8696a0]">
                <Home className="h-3.5 w-3.5 text-[#25d366]" />
                Top match
              </div>
              <div className="mt-2 text-sm font-semibold text-[#e9edef]">
                {match.title}
              </div>
              <div className="mt-1 text-xs text-[#8696a0]">{match.location}</div>
            </div>
            <div className="text-sm font-semibold text-[#7ce6b0]">
              {match.priceText || formatCompactCurrency(match.priceValue)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {match.keyAttributes.slice(0, 4).map((attribute) => (
              <span
                key={attribute}
                className="rounded-full bg-[#172229] px-2.5 py-1 text-[11px] text-[#d1d7db]"
              >
                {attribute}
              </span>
            ))}
          </div>

          <div className="mt-3 text-xs leading-5 text-[#8696a0]">
            {match.whyMatched.join(" | ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReplyWorkbench({
  draft,
  draftState,
  draftError,
  composer,
  selectedAnalysis,
  onComposerChange,
  onSuggestionUse,
  onTriggerDraft,
  onSend,
}: {
  draft: DraftReply | null;
  draftState: "idle" | "analyzing" | "ready" | "error";
  draftError: string | null;
  composer: string;
  selectedAnalysis?: ConversationInsightsResponse["analysis"];
  onComposerChange: (value: string) => void;
  onSuggestionUse: (value: string) => void;
  onTriggerDraft: (transform: string) => void;
  onSend: (manual?: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {draftError ? (
        <div className="rounded-xl border border-[#5a2a2a] bg-[#2a1414] px-4 py-3 text-sm text-[#ffb3b3]">
          {draftError}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-white/8 bg-[#111b21]/92 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#103529] text-[#25d366]">
              {draftState === "analyzing" ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#e9edef]">
                {draftState === "analyzing" ? "Building lead reply" : "Reply assistant"}
              </div>
              <div className="text-xs text-[#8696a0]">
                {draft
                  ? `${draft.toneLabel} | ${Math.round(draft.confidence * 100)}% confidence | ${draft.source}`
                  : "Generate operator-reviewed responses with listing context."}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["default", "shorter", "more-direct", "more-persuasive", "more-premium"].map(
              (transform) => (
                <button
                  key={transform}
                  type="button"
                  onClick={() => onTriggerDraft(transform)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d1d7db] transition hover:bg-white/5"
                >
                  {transform === "default"
                    ? "Regenerate"
                    : transform.replace("more-", "More ")}
                </button>
              ),
            )}
          </div>
        </div>

        {draft ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/8 bg-[#0f171c] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#8696a0]">
                Draft reply
              </div>
              <div className="mt-3 text-sm leading-7 text-[#dfe7ea]">{draft.text}</div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0f171c] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#8696a0]">
                Why this draft
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#aebac1]">
                {draft.decisionSummary.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {draft?.suggestions?.length ? (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#8696a0]">
              Suggested reply paths
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-3">
              {draft.suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => onSuggestionUse(suggestion.text)}
                  className="rounded-2xl border border-white/8 bg-[#0f171c] p-4 text-left transition hover:border-[#1d5245] hover:bg-[#132128]"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#8696a0]">
                    <WandSparkles className="h-3.5 w-3.5 text-[#25d366]" />
                    {suggestion.label}
                  </div>
                  <div className="mt-3 line-clamp-4 text-sm leading-6 text-[#dfe7ea]">
                    {suggestion.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <LiveLeadBadge
            label={selectedAnalysis?.leadStage || "Lead"}
            tone="sky"
          />
          <LiveLeadBadge
            label={selectedAnalysis?.buyerTemperature || "New"}
            tone="amber"
          />
          <LiveLeadBadge label={selectedAnalysis?.intent || "Open intent"} tone="slate" />
          <LiveLeadBadge
            label={selectedAnalysis?.recommendedNextAction || "Guide next action"}
            tone="green"
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-[#202c33] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-[#e9edef]">Operator response</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSend(true)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d1d7db] transition hover:bg-white/5"
            >
              Mark as sent manually
            </button>
            <button
              type="button"
              onClick={() => onSend(false)}
              className="inline-flex items-center gap-2 rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#25d366]"
            >
              <Send className="h-4 w-4" />
              Send reply
            </button>
          </div>
        </div>

        <textarea
          value={composer}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder="Write the final reply the agent will send..."
          className="mt-4 min-h-[112px] w-full resize-none rounded-[22px] bg-[#2a3942] px-4 py-4 text-[15px] leading-7 text-[#e9edef] outline-none placeholder:text-[#8696a0]"
        />

        <div className="mt-3 text-xs text-[#8696a0]">
          Keep the reply short, confident, and specific to the client intent. Use the
          draft as a base, then personalize before sending.
        </div>
      </div>
    </div>
  );
}

export function SalesConsoleApp({ initialMode }: { initialMode: AppMode }) {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [draft, setDraft] = useState<DraftReply | null>(null);
  const [draftState, setDraftState] = useState<"idle" | "analyzing" | "ready" | "error">(
    "idle",
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();
  const autoDraftRef = useRef<string>("");

  const dashboardQuery = useSWR<DashboardResponse>(
    `/api/dashboard?mode=${mode}`,
    fetcher,
    {
      refreshInterval: mode === "live" ? 4000 : 0,
      revalidateOnFocus: mode === "live",
    },
  );

  const conversations = dashboardQuery.data?.conversations || [];
  const resolvedSelectedId =
    selectedId && conversations.some((item) => item.id === selectedId)
      ? selectedId
      : conversations[0]?.id || null;

  const insightsQuery = useSWR<ConversationInsightsResponse>(
    resolvedSelectedId
      ? `/api/conversations/${resolvedSelectedId}/insights?mode=${mode}`
      : null,
    fetcher,
    {
      refreshInterval: mode === "live" ? 4000 : 0,
      revalidateOnFocus: mode === "live",
    },
  );

  const autoDraft = useEffectEvent(() => {
    void triggerDraft("default");
  });

  useEffect(() => {
    const conversation = insightsQuery.data?.conversation;
    if (!conversation) return;

    const lastInbound = [...conversation.messages]
      .reverse()
      .find((message) => message.direction === "inbound");
    if (!lastInbound) return;

    const signature = `${conversation.id}:${lastInbound.id}:${mode}`;
    if (autoDraftRef.current === signature) return;
    autoDraftRef.current = signature;

    autoDraft();
  }, [insightsQuery.data?.conversation, mode]);

  async function triggerDraft(transform: string) {
    if (!resolvedSelectedId) return;

    setDraftState("analyzing");
    setDraftError(null);

    try {
      const response = await fetch(`/api/conversations/${resolvedSelectedId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, transform }),
      });
      if (!response.ok) {
        throw new Error("Draft request failed.");
      }

      const payload = (await response.json()) as { draft: DraftReply };
      setDraft(payload.draft);
      setComposer(payload.draft.text);
      setDraftState("ready");
      await insightsQuery.mutate();
    } catch (error) {
      setDraftState("error");
      setDraftError(
        error instanceof Error ? error.message : "Unable to generate draft.",
      );
    }
  }

  async function sendMessage(manual = false) {
    if (!resolvedSelectedId || !composer.trim()) return;

    const text = composer.trim();
    setComposer("");

    const response = await fetch(`/api/conversations/${resolvedSelectedId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, text, manual }),
    });

    if (!response.ok) {
      setComposer(text);
      return;
    }

    setDraft(null);
    setDraftState("idle");
    await Promise.all([dashboardQuery.mutate(), insightsQuery.mutate()]);
  }

  async function simulateInbound() {
    if (!resolvedSelectedId) return;

    await fetch(`/api/conversations/${resolvedSelectedId}/simulate-inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        text: "Thanks, can you also include something with stronger rental upside and low HOA if possible?",
      }),
    });

    autoDraftRef.current = "";
    await Promise.all([dashboardQuery.mutate(), insightsQuery.mutate()]);
  }

  const selectedConversation = insightsQuery.data?.conversation;
  const selectedAnalysis = insightsQuery.data?.analysis;
  const selectedMatches = insightsQuery.data?.matches || [];
  const inventory = dashboardQuery.data?.inventory;
  const whatsappConnection = dashboardQuery.data?.whatsapp;

  if (mode === "live") {
    return (
      <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
        <div className="mx-auto grid min-h-screen max-w-[1900px] grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="flex min-h-screen flex-col border-r border-white/6 bg-[#111b21]">
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#202c33] text-[#aebac1]">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">Chats</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#8696a0]">
                    Live queue
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[#aebac1]">
                <MessageSquarePlus className="h-5 w-5" />
                <Archive className="h-5 w-5" />
                <MoreVertical className="h-5 w-5" />
              </div>
            </div>

            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 rounded-lg bg-[#202c33] px-4 py-2.5 text-[#8696a0]">
                <Search className="h-4 w-4" />
                <span className="text-sm">Search or start a new chat</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-[#103529] px-4 py-2 text-sm font-medium text-[#25d366]">
                  All
                </span>
                <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#aebac1]">
                  Unread
                </span>
                <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#aebac1]">
                  Favorites
                </span>
                <span className="rounded-full border border-white/10 p-2 text-[#aebac1]">
                  <Filter className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.length > 0 ? (
                conversations.map((conversation) => (
                  <LiveConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    selected={conversation.id === resolvedSelectedId}
                    onClick={() => {
                      setSelectedId(conversation.id);
                      setDraft(null);
                      setDraftState("idle");
                      autoDraftRef.current = "";
                    }}
                  />
                ))
              ) : (
                <div className="px-6 py-12 text-center text-sm text-[#8696a0]">
                  No live conversations yet.
                </div>
              )}
            </div>

            <div className="border-t border-white/6 px-4 py-3 text-xs text-[#8696a0]">
              <div className="flex items-center justify-between gap-3">
                <span>Webhook</span>
                <span className="text-[#d1d7db]">
                  {whatsappConnection?.webhookEndpoint || "/api/webhook/meta"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Access token</span>
                <span
                  className={cn(
                    whatsappConnection?.apiConfigured
                      ? "text-[#25d366]"
                      : "text-[#ff6b6b]",
                  )}
                >
                  {whatsappConnection?.apiConfigured ? "Configured" : "Missing"}
                </span>
              </div>
            </div>
          </aside>

          <main className="min-h-screen bg-[#0b141a]">
            {!selectedConversation ? (
              <LiveEmptyState />
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex h-16 items-center justify-between border-b border-white/6 bg-[#202c33] px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                        selectedConversation.avatarColor,
                      )}
                    >
                      {selectedConversation.customerName
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-[15px] font-medium text-[#e9edef]">
                        {selectedConversation.customerName}
                      </div>
                      <div className="text-xs text-[#8696a0]">
                        {selectedConversation.phone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-[#aebac1]">
                    <Search className="h-5 w-5" />
                    <MoreVertical className="h-5 w-5" />
                  </div>
                </div>

                <div className="border-b border-white/6 bg-[#111b21] px-6 py-4">
                  {selectedAnalysis ? (
                    <LeadSnapshotCard
                      analysis={selectedAnalysis}
                      match={selectedMatches[0]}
                    />
                  ) : (
                    <div className="rounded-[24px] border border-white/8 bg-[#111b21]/88 p-4 text-sm text-[#8696a0]">
                      Lead analysis is loading.
                    </div>
                  )}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="whatsapp-wallpaper min-h-0 overflow-y-auto bg-[#0b141a] px-8 py-6">
                    <div className="mx-auto max-w-4xl">
                      {draftState === "analyzing" ? (
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-[#111b21]/80 px-4 py-2 text-xs text-[#aebac1]">
                          <LoaderCircle className="h-4 w-4 animate-spin text-[#25d366]" />
                          AI is analyzing this conversation
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3">
                        {selectedConversation.messages.map((message) => (
                          <LiveMessageBubble key={message.id} message={message} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="border-l border-white/6 bg-[#162127] p-5">
                    <div className="space-y-4">
                      <ReplyWorkbench
                        draft={draft}
                        draftState={draftState}
                        draftError={draftError}
                        composer={composer}
                        selectedAnalysis={selectedAnalysis}
                        onComposerChange={setComposer}
                        onSuggestionUse={setComposer}
                        onTriggerDraft={(transform) => void triggerDraft(transform)}
                        onSend={(manual) => void sendMessage(manual)}
                      />

                      {selectedMatches.length > 0 ? (
                        <div className="rounded-[24px] border border-white/8 bg-[#111b21]/92 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-[#e9edef]">
                              Lead-fit listings
                            </div>
                            <div className="text-xs text-[#8696a0]">
                              {selectedMatches.length} options
                            </div>
                          </div>
                          <div className="mt-4 space-y-4">
                            {selectedMatches.slice(0, 2).map((match) => (
                              <div
                                key={match.id}
                                className="rounded-2xl border border-white/8 bg-[#0f171c] p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-[#e9edef]">
                                      {match.title}
                                    </div>
                                    <div className="mt-1 text-xs text-[#8696a0]">
                                      {match.location}
                                    </div>
                                  </div>
                                  <div className="text-sm font-semibold text-[#7ce6b0]">
                                    {match.priceText || formatCompactCurrency(match.priceValue)}
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {match.keyAttributes.slice(0, 4).map((attribute) => (
                                    <span
                                      key={attribute}
                                      className="rounded-full bg-[#172229] px-2.5 py-1 text-[11px] text-[#d1d7db]"
                                    >
                                      {attribute}
                                    </span>
                                  ))}
                                </div>

                                <div className="mt-3 text-xs leading-5 text-[#8696a0]">
                                  {match.whyMatched.join(" | ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="text-xs text-[#8696a0]">
                        {selectedConversation
                          ? `Last activity ${formatDay(selectedConversation.lastActivityAt)} ${formatTime(selectedConversation.lastActivityAt)}`
                          : "Waiting for inbound webhook"}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_36%),linear-gradient(180deg,_#eff6f3_0%,_#f5f7f6_42%,_#edf2f7_100%)] p-5 text-slate-900 lg:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1780px] flex-col overflow-hidden rounded-[34px] border border-white/60 bg-white/70 shadow-[0_45px_120px_-65px_rgba(2,132,199,0.45)] backdrop-blur">
        <header className="border-b border-slate-200/80 bg-white/70 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Flamingo Beach Realty
                  </div>
                  <h1 className="font-serif-display text-3xl leading-none tracking-tight text-slate-900">
                    WhatsApp Sales Assistant Console
                  </h1>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Desktop-first operator console for reviewing AI drafts, matching real
                inventory, and controlling WhatsApp responses before they are sent.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white p-1">
                {(["demo", "live"] as AppMode[]).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setMode(candidate);
                        setSelectedId(null);
                        setDraft(null);
                        setDraftState("idle");
                        autoDraftRef.current = "";
                      })
                    }
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium capitalize transition",
                      mode === candidate
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    {candidate} mode
                  </button>
                ))}
              </div>
              <Badge
                label={dashboardQuery.data?.ollama.model || "Ollama"}
                tone="accent"
              />
              <Badge
                label={
                  inventory?.status === "ready"
                    ? `${inventory.count} listings`
                    : "Inventory issue"
                }
                tone={inventory?.status === "ready" ? "default" : "hot"}
              />
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-px bg-slate-200/80 lg:grid-cols-[320px_minmax(0,1fr)_390px]">
          <aside className="bg-[#f6fbf8] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Conversations
                </div>
                <div className="mt-1 text-sm text-slate-500">Seeded demo leads</div>
              </div>
              {pendingAction ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
              ) : null}
            </div>

            <div className="space-y-3 overflow-y-auto pb-6">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === resolvedSelectedId}
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setDraft(null);
                    setDraftState("idle");
                    autoDraftRef.current = "";
                  }}
                  insight={
                    resolvedSelectedId === conversation.id ? insightsQuery.data : undefined
                  }
                />
              ))}
            </div>
          </aside>

          <main className="relative flex min-h-[720px] flex-col bg-[linear-gradient(180deg,_rgba(236,253,245,0.42)_0%,_rgba(255,255,255,0.96)_100%)]">
            <div className="border-b border-slate-200/80 bg-white/75 px-6 py-4">
              {selectedConversation ? (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {selectedConversation.customerName}
                      </h2>
                      {selectedAnalysis ? (
                        <>
                          <Badge label={selectedAnalysis.leadStage} tone="accent" />
                          <Badge
                            label={selectedAnalysis.buyerTemperature}
                            tone={
                              selectedAnalysis.buyerTemperature === "Hot"
                                ? "hot"
                                : selectedAnalysis.buyerTemperature === "Warm"
                                  ? "warm"
                                  : "cool"
                            }
                          />
                          <Badge label={selectedAnalysis.intent} tone="default" />
                        </>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{selectedConversation.phone}</span>
                      <span>Assignee: {selectedConversation.assignee}</span>
                      <span>Source: {selectedConversation.leadSource}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Inventory matches updated</div>
                    <div className="mt-1 font-medium text-slate-700">
                      {relativeTime(selectedConversation.lastActivityAt)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No conversation selected.</div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {selectedConversation?.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200/80 bg-white/85 px-6 py-5 backdrop-blur">
              <div className="mx-auto max-w-4xl space-y-4">
                <div className="rounded-[28px] border border-emerald-200/80 bg-[linear-gradient(135deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.95))] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        {draftState === "analyzing" ? (
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {draftState === "analyzing" ? "AI is analyzing" : "Draft reply"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {draft
                            ? `${draft.toneLabel} | ${Math.round(draft.confidence * 100)}% confidence | ${draft.source}`
                            : "Generate a reviewed outbound reply before sending."}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "default",
                        "shorter",
                        "more-persuasive",
                        "more-premium",
                        "more-direct",
                      ].map((transform) => (
                        <button
                          key={transform}
                          type="button"
                          onClick={() => void triggerDraft(transform)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                          {transform === "default"
                            ? "Regenerate"
                            : transform.replace("more-", "More ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {draftError ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{draftError}</span>
                    </div>
                  ) : null}

                  {draft ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                      <div className="rounded-[22px] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.9)]">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Proposed reply
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {draft.text}
                        </p>
                      </div>
                      <div className="space-y-3 rounded-[22px] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.9)]">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Decision summary
                          </div>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                            {draft.decisionSummary.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge label={draft.intent} tone="default" />
                          <Badge label={draft.toneLabel} tone="accent" />
                          <Badge
                            label={`${Math.round(draft.confidence * 100)}% confidence`}
                            tone="cool"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {draft?.suggestions?.length ? (
                    <div className="mt-4 rounded-[22px] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.9)]">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Suggested replies
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        {draft.suggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => setComposer(suggestion.text)}
                            className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            <div className="flex items-center gap-2">
                              <WandSparkles className="h-4 w-4 text-emerald-600" />
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {suggestion.label}
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {suggestion.text}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.8)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Operator composer
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        Edit before sending. Actual sent messages stay separate from AI suggestions.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void simulateInbound()}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      Inject demo inbound
                    </button>
                  </div>

                  <textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Operator-reviewed message goes here..."
                    className="mt-4 min-h-[132px] w-full rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Human review required before any outbound send action.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void sendMessage(true)}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Mark as sent manually
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendMessage(false)}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <Send className="h-4 w-4" />
                        Send demo reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="bg-[#f8fbfb] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Intelligence Panel
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Structured analysis, explainable ranking, and memory.
                </div>
              </div>
            </div>

            {inventory?.status === "error" ? (
              <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
                <div className="font-semibold">Inventory path unavailable</div>
                <div className="mt-2">{inventory.error}</div>
                <div className="mt-3 text-xs text-rose-600">
                  Update INVENTORY_CSV_PATH or place the CSV at the configured path.
                </div>
              </div>
            ) : null}

            {selectedAnalysis ? (
              <div className="mt-5 space-y-4 overflow-y-auto pb-6">
                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Lead overview</div>
                    <Badge
                      label={`${Math.round(selectedAnalysis.seriousnessProbability * 100)}% serious`}
                      tone="accent"
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Stage
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedAnalysis.leadStage}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Temperature
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedAnalysis.buyerTemperature}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Message type
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedAnalysis.messageType}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Sentiment
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedAnalysis.sentiment}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Detected entities</div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-4">
                      <span>Budget</span>
                      <span className="font-semibold text-slate-900">
                        {selectedAnalysis.budgetDetected}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Zones</span>
                      <span className="text-right font-semibold text-slate-900">
                        {selectedAnalysis.preferredZones.join(", ") || "Not yet detected"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Product type</span>
                      <span className="text-right font-semibold text-slate-900">
                        {selectedAnalysis.productType.join(", ") || "Open"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Bedrooms</span>
                      <span className="font-semibold text-slate-900">
                        {selectedAnalysis.bedrooms.join(", ") || "Not specified"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>Time horizon</span>
                      <span className="font-semibold text-slate-900">
                        {selectedAnalysis.timeHorizon || "Not specified"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Recommended next action
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedAnalysis.recommendedNextAction}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedAnalysis.objections.length > 0 ? (
                      selectedAnalysis.objections.map((objection) => (
                        <Badge key={objection} label={objection} tone="warm" />
                      ))
                    ) : (
                      <Badge label="No objections detected" tone="default" />
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Conversation memory</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedAnalysis.conversationMemory.summary}
                  </p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Preferences
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAnalysis.conversationMemory.preferences.map((item) => (
                          <Badge key={item} label={item} tone="default" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Last listings discussed
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAnalysis.conversationMemory.lastListings.length > 0 ? (
                          selectedAnalysis.conversationMemory.lastListings.map((item) => (
                            <Badge key={item} label={item} tone="cool" />
                          ))
                        ) : (
                          <Badge label="None yet" tone="default" />
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Matched listings</div>
                    <div className="text-xs text-slate-400">
                      {selectedMatches.length} ranked options
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {selectedMatches.length > 0 ? (
                      selectedMatches.slice(0, 4).map((match) => (
                        <ListingCard key={match.id} match={match} />
                      ))
                    ) : (
                      <div className="rounded-[22px] bg-slate-50 p-4 text-sm text-slate-500">
                        Inventory matches will appear here as the conversation becomes more specific.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2 text-slate-800">
                    <MessageCircleMore className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold">Mode wiring</span>
                  </div>
                  <div className="mt-3 leading-6">
                    Demo mode runs from local seeded conversations. Live mode reads the
                    same UI through the webhook-compatible endpoint at{" "}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-700">
                      {dashboardQuery.data?.webhookEndpoint || "/api/webhook/meta"}
                    </code>
                    .
                  </div>
                </section>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-500">
                Select a conversation to load structured analysis.
              </div>
            )}
          </aside>
        </div>

        <footer className="border-t border-slate-200/80 bg-white/70 px-6 py-3 text-xs text-slate-400">
          {selectedConversation ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Last activity {formatDay(selectedConversation.lastActivityAt)} at{" "}
                {formatTime(selectedConversation.lastActivityAt)}
              </span>
              <span>
                {draftState === "analyzing"
                  ? "AI is analyzing"
                  : draft
                    ? "Draft ready"
                    : "Draft idle"}
              </span>
            </div>
          ) : (
            <span>Waiting for conversation selection.</span>
          )}
        </footer>
      </div>
    </div>
  );
}
