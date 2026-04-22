import { ConversationRecord, ConversationMessage } from "@/lib/types";
import { generateId } from "@/lib/utils";

function isoMinutesAgo(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function inbound(
  text: string,
  minutesAgo: number,
  authorLabel = "Client",
): ConversationMessage {
  return {
    id: generateId("msg"),
    direction: "inbound",
    text,
    timestamp: isoMinutesAgo(minutesAgo),
    kind: "text",
    source: "customer",
    authorLabel,
  };
}

function outbound(
  text: string,
  minutesAgo: number,
  status: ConversationMessage["status"] = "read",
): ConversationMessage {
  return {
    id: generateId("msg"),
    direction: "outbound",
    text,
    timestamp: isoMinutesAgo(minutesAgo),
    kind: "text",
    source: "operator",
    authorLabel: "Sales Assistant",
    status,
  };
}

export function buildDemoConversations(): ConversationRecord[] {
  return [
    {
      id: "lead-flamingo-ocean-view",
      customerName: "Amelia Grant",
      phone: "+1 305 555 0144",
      avatarColor: "from-emerald-500 to-teal-600",
      mode: "demo",
      assignee: "Melanie",
      unreadCount: 2,
      lastActivityAt: isoMinutesAgo(3),
      leadSource: "WhatsApp ad",
      messages: [
        inbound(
          "Hi, I’m looking for a 3 bedroom in Flamingo around 900k, preferably with ocean view.",
          18,
          "Amelia",
        ),
        outbound(
          "Absolutely. Are you open to both condos and single-family homes, or are you leaning one way already?",
          16,
        ),
        inbound(
          "Open to both. This would be for lifestyle first, but rental potential matters too.",
          3,
          "Amelia",
        ),
      ],
    },
    {
      id: "lead-beachfront-foreign-buyer",
      customerName: "Lars Holm",
      phone: "+46 70 555 0191",
      avatarColor: "from-cyan-500 to-sky-700",
      mode: "demo",
      assignee: "Melanie",
      unreadCount: 1,
      lastActivityAt: isoMinutesAgo(9),
      leadSource: "Referral",
      messages: [
        inbound(
          "Hello, I’m relocating from Sweden and want something beachfront, ideally close to services.",
          31,
          "Lars",
        ),
        outbound(
          "Welcome. We can definitely focus on walkable beachfront inventory. What price range feels comfortable for your purchase?",
          27,
        ),
        inbound("Around 1.8M if the property is truly special.", 9, "Lars"),
      ],
    },
    {
      id: "lead-investor-roi",
      customerName: "Noah Patel",
      phone: "+1 646 555 0167",
      avatarColor: "from-amber-500 to-orange-600",
      mode: "demo",
      assignee: "Andres",
      unreadCount: 0,
      lastActivityAt: isoMinutesAgo(22),
      leadSource: "Investor database",
      messages: [
        inbound(
          "I’m evaluating Costa Rica for investment. What kind of ROI are buyers seeing in Flamingo or Tamarindo?",
          54,
          "Noah",
        ),
        outbound(
          "Short-term rental performance depends heavily on location, ocean view, and management strategy. Are you prioritizing yield, appreciation, or a hybrid hold?",
          46,
        ),
        inbound(
          "Hybrid. I want strong appreciation and enough short-term income to cover operating costs.",
          22,
          "Noah",
        ),
      ],
    },
    {
      id: "lead-family-3-4-bed",
      customerName: "Sophia Alvarez",
      phone: "+1 512 555 0128",
      avatarColor: "from-fuchsia-500 to-pink-600",
      mode: "demo",
      assignee: "Melanie",
      unreadCount: 1,
      lastActivityAt: isoMinutesAgo(11),
      leadSource: "Organic inquiry",
      messages: [
        inbound(
          "We’re a family of five looking for a 3 or 4 bedroom home, ideally gated and not too far from schools.",
          42,
          "Sophia",
        ),
        outbound(
          "That helps a lot. Do you want to stay closer to Flamingo / Potrero or are Tamarindo and Hacienda Pinilla also on the table?",
          35,
        ),
        inbound("Hacienda Pinilla is interesting if the community feel is strong.", 11, "Sophia"),
      ],
    },
    {
      id: "lead-visit-availability",
      customerName: "David Lin",
      phone: "+1 415 555 0172",
      avatarColor: "from-violet-500 to-indigo-700",
      mode: "demo",
      assignee: "Andres",
      unreadCount: 3,
      lastActivityAt: isoMinutesAgo(6),
      leadSource: "Past website lead",
      messages: [
        inbound(
          "I’ll be in Guanacaste next Thursday and Friday. Can I line up property visits while I’m there?",
          15,
          "David",
        ),
        outbound(
          "Yes. If you share the areas and budget we can pre-qualify options first and make the schedule efficient.",
          13,
        ),
        inbound(
          "Great. Mid-market to luxury, mostly Flamingo and Potrero, maybe up to 2.2M.",
          6,
          "David",
        ),
      ],
    },
    {
      id: "lead-financing-budget-unclear",
      customerName: "Maya Thompson",
      phone: "+1 720 555 0102",
      avatarColor: "from-slate-500 to-gray-700",
      mode: "demo",
      assignee: "Melanie",
      unreadCount: 1,
      lastActivityAt: isoMinutesAgo(14),
      leadSource: "Instagram",
      messages: [
        inbound(
          "Do foreign buyers usually finance in Costa Rica? We’re interested but still figuring out budget.",
          26,
          "Maya",
        ),
        outbound(
          "There are financing pathways, though terms vary and many buyers use a hybrid strategy. What purchase range are you roughly exploring today?",
          21,
        ),
        inbound(
          "Maybe somewhere between 600k and 1M, and we’re not sure if condo or house makes more sense yet.",
          14,
          "Maya",
        ),
      ],
    },
  ];
}
