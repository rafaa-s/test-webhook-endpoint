import {
  ConversationAnalysis,
  ConversationRecord,
  DraftReply,
  ListingMatch,
  ReplySuggestion,
  SuggestionStyle,
} from "@/lib/types";
import { formatCurrency, generateId } from "@/lib/utils";

import { generateJsonWithOllama } from "@/lib/server/ollama";

type OllamaDraftResponse = {
  draft: string;
  toneLabel: string;
  confidence: number;
  decisionSummary: string[];
  suggestions: Array<{
    label: string;
    style: SuggestionStyle;
    text: string;
  }>;
};

type DraftLanguage = "en" | "es";

type QualificationGap =
  | "purchase_goal"
  | "property_type"
  | "area"
  | "budget"
  | "bedrooms"
  | "local_context";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getConversationTranscript(conversation: ConversationRecord) {
  return conversation.messages.map((message) => message.text).join("\n");
}

function detectDraftLanguage(conversation: ConversationRecord): DraftLanguage {
  const transcript = normalizeText(getConversationTranscript(conversation));
  const spanishSignals = [
    "hola",
    "busco",
    "casa",
    "apartamento",
    "condominio",
    "inversion",
    "invertir",
    "presupuesto",
    "financiamiento",
    "playa",
    "habitaciones",
    "dormitorios",
    "gracias",
    "quiero",
    "me interesa",
    "visita",
    "soy de",
    "vivo en",
  ];
  const englishSignals = [
    "hello",
    "looking for",
    "investment",
    "budget",
    "financing",
    "bedroom",
    "beachfront",
    "ocean view",
    "thanks",
    "interested",
    "schedule",
    "visit",
    "i live in",
    "first time",
  ];

  const spanishScore = spanishSignals.filter((signal) => transcript.includes(signal)).length;
  const englishScore = englishSignals.filter((signal) => transcript.includes(signal)).length;

  return spanishScore > englishScore ? "es" : "en";
}

function hasPurchaseGoalSignal(conversation: ConversationRecord) {
  const transcript = normalizeText(getConversationTranscript(conversation));
  return (
    /\b(investment|invest|roi|yield|rental|lifestyle|relocate|vacation home)\b/.test(
      transcript,
    ) ||
    /\b(inversion|invertir|rentabilidad|renta|vivir|mudarme|vacaciones)\b/.test(
      transcript,
    )
  );
}

function hasLocalContextSignal(conversation: ConversationRecord) {
  const transcript = normalizeText(getConversationTranscript(conversation));
  return (
    /\b(from|relocating from|i live in|first time in costa rica|been to costa rica)\b/.test(
      transcript,
    ) ||
    /\b(soy de|vivo en|me mudo de|primera vez en costa rica|ya conozco costa rica)\b/.test(
      transcript,
    )
  );
}

function getQualificationGaps(
  conversation: ConversationRecord,
  analysis: ConversationAnalysis,
): QualificationGap[] {
  const gaps: QualificationGap[] = [];

  if (!hasPurchaseGoalSignal(conversation) && !analysis.extractedEntities.purchaseIntent) {
    gaps.push("purchase_goal");
  }
  if (analysis.productType.length === 0) {
    gaps.push("property_type");
  }
  if (analysis.preferredZones.length === 0) {
    gaps.push("area");
  }
  if (!analysis.extractedEntities.budget) {
    gaps.push("budget");
  }
  if (analysis.bedrooms.length === 0) {
    gaps.push("bedrooms");
  }
  if (!hasLocalContextSignal(conversation) && !analysis.extractedEntities.nationality) {
    gaps.push("local_context");
  }

  return gaps;
}

function hasLeadClarity(analysis: ConversationAnalysis) {
  const hasArea = analysis.preferredZones.length > 0;
  const hasPropertyType = analysis.productType.length > 0;
  const hasBudget = Boolean(analysis.extractedEntities.budget);
  const hasBedroomSignal = analysis.bedrooms.length > 0;

  return (
    analysis.leadStage === "Qualified" ||
    analysis.leadStage === "Viewing" ||
    (hasArea && hasBudget && (hasPropertyType || hasBedroomSignal)) ||
    (hasArea && hasPropertyType && hasBedroomSignal)
  );
}

function formatPriceRange(matches: ListingMatch[]) {
  const prices = matches
    .map((match) => match.priceValue)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return undefined;
  }

  const low = formatCurrency(prices[0]);
  const high = formatCurrency(prices[prices.length - 1]);
  return low === high ? low : `${low} to ${high}`;
}

function buildInventoryRangeSnippet(
  language: DraftLanguage,
  analysis: ConversationAnalysis,
  matches: ListingMatch[],
) {
  const zones = unique(
    [
      ...analysis.preferredZones,
      ...matches.flatMap((match) => [match.neighborhood, match.location]).filter(Boolean),
    ].slice(0, 4) as string[],
  );
  const priceRange = formatPriceRange(matches.slice(0, 4));

  if (language === "es") {
    if (zones.length > 0 && priceRange) {
      return `Trabajamos propiedades en ${zones.join(", ")} y en este momento veo opciones alineadas aproximadamente entre ${priceRange}.`;
    }
    if (zones.length > 0) {
      return `Trabajamos propiedades en ${zones.join(", ")} y podemos orientarte según estilo de vida, inversión o ambos.`;
    }
    return "Manejamos inventario en Flamingo, Potrero, Tamarindo, Reserva Conchal y comunidades cercanas.";
  }

  if (zones.length > 0 && priceRange) {
    return `We handle inventory across ${zones.join(", ")}, and right now I am seeing aligned options roughly between ${priceRange}.`;
  }
  if (zones.length > 0) {
    return `We handle inventory across ${zones.join(", ")} and can guide the search around lifestyle, investment, or both.`;
  }
  return "We cover inventory across Flamingo, Potrero, Tamarindo, Reserva Conchal, and nearby communities.";
}

function buildLinkSnippet(language: DraftLanguage, matches: ListingMatch[]) {
  const shareable = matches.filter((match) => Boolean(match.url)).slice(0, 2);

  if (shareable.length === 0) {
    return "";
  }

  if (language === "es") {
    const listings = shareable
      .map(
        (match) =>
          `${match.title} (${match.priceText || formatCurrency(match.priceValue)}): ${match.url}`,
      )
      .join("\n");
    return `Estas son dos opciones que vale la pena revisar:\n${listings}`;
  }

  const listings = shareable
    .map(
      (match) =>
        `${match.title} (${match.priceText || formatCurrency(match.priceValue)}): ${match.url}`,
    )
    .join("\n");
  return `Here are two relevant options to review:\n${listings}`;
}

function buildGapQuestions(
  language: DraftLanguage,
  gaps: QualificationGap[],
) {
  const ordered = gaps.slice(0, 2);

  const englishQuestions = ordered.map((gap) => {
    switch (gap) {
      case "purchase_goal":
        return "Are you mainly buying for personal use, investment, or a mix of both?";
      case "property_type":
        return "Are you leaning more toward a condo/apartment, a house, or an investment property?";
      case "area":
        return "Do you already have a preferred area like Flamingo, Potrero, Tamarindo, or would you like guidance there?";
      case "budget":
        return "What budget range would feel comfortable so I can narrow this properly?";
      case "bedrooms":
        return "How many bedrooms would you ideally want?";
      case "local_context":
        return "Are you currently living in Costa Rica, or would this be your first time buying here?";
    }
  });

  const spanishQuestions = ordered.map((gap) => {
    switch (gap) {
      case "purchase_goal":
        return "La compra es principalmente para vivir, invertir o una mezcla de ambas?";
      case "property_type":
        return "Te inclinas mas por apartamento/condo, casa o una propiedad pensada para inversion?";
      case "area":
        return "Ya tienes una zona en mente como Flamingo, Potrero o Tamarindo, o quieres que te oriente con eso?";
      case "budget":
        return "Que rango de presupuesto te quedaria comodo para afinar bien la busqueda?";
      case "bedrooms":
        return "Cuantas habitaciones te gustaria tener idealmente?";
      case "local_context":
        return "Actualmente vives en Costa Rica o seria tu primera compra aca?";
    }
  });

  return language === "es"
    ? spanishQuestions.filter(Boolean).join(" ")
    : englishQuestions.filter(Boolean).join(" ");
}

function buildQualifiedReply(
  language: DraftLanguage,
  analysis: ConversationAnalysis,
  matches: ListingMatch[],
  transform: string,
) {
  const topMatch = matches[0];
  const zone = analysis.preferredZones[0] || topMatch?.location || "your target area";
  const intro =
    language === "es"
      ? `Perfecto. Ya tengo bastante claridad para empezar a proponerte opciones concretas en ${zone}.`
      : `Perfect. I already have enough clarity to start proposing concrete options in ${zone}.`;

  const benchmark = topMatch
    ? language === "es"
      ? `${topMatch.title} me parece un match fuerte por ${topMatch.whyMatched.join(", ")}.`
      : `${topMatch.title} looks like a strong match based on ${topMatch.whyMatched.join(", ")}.`
    : language === "es"
      ? "Ya veo varias opciones alineadas con lo que buscas."
      : "I already see several options aligned with what you want.";

  const linkSnippet = buildLinkSnippet(language, matches);
  const close =
    language === "es"
      ? "Si quieres, despues de que revises estas opciones te digo cual priorizaria yo y por que."
      : "If you want, after you review these I can tell you which one I would prioritize first and why.";

  let text = [intro, benchmark, linkSnippet, close].filter(Boolean).join(" ");

  if (transform === "shorter") {
    text = [intro, linkSnippet].filter(Boolean).join(" ");
  }

  if (transform === "more-persuasive") {
    text =
      language === "es"
        ? `${intro} ${benchmark} ${linkSnippet} Creo que con estas opciones ya podemos pasar de explorar a comparar seriamente y definir la mejor ruta para ti.`
        : `${intro} ${benchmark} ${linkSnippet} I think these options are strong enough to move from browsing into a serious comparison and a clearer decision path.`;
  }

  if (transform === "more-premium") {
    text =
      language === "es"
        ? `${intro} ${benchmark} ${linkSnippet} Si te parece, te preparo una seleccion mas curada y te marco cual tiene mejor balance entre lifestyle, calidad y valor a largo plazo.`
        : `${intro} ${benchmark} ${linkSnippet} If you would like, I can curate this into a more refined shortlist and point out which option offers the best balance of lifestyle, quality, and long-term value.`;
  }

  if (transform === "more-direct") {
    text =
      language === "es"
        ? `${intro} ${linkSnippet} Dime cual te llama mas la atencion y te digo por donde seguir.`
        : `${intro} ${linkSnippet} Tell me which one stands out most and I will recommend the next step.`;
  }

  return text;
}

function buildDiscoveryReply(
  language: DraftLanguage,
  conversation: ConversationRecord,
  analysis: ConversationAnalysis,
  matches: ListingMatch[],
  transform: string,
) {
  const gaps = getQualificationGaps(conversation, analysis);
  const questions = buildGapQuestions(language, gaps);
  const inventorySnippet = buildInventoryRangeSnippet(language, analysis, matches);

  let text =
    language === "es"
      ? `Gracias por escribirnos. Con gusto te ayudo. ${inventorySnippet} Para orientarte bien sin mandarte informacion de mas, ${questions}`
      : `Thanks for reaching out. Happy to help. ${inventorySnippet} So I can guide you properly without overwhelming you, ${questions}`;

  if (transform === "shorter") {
    text =
      language === "es"
        ? `${inventorySnippet} Para ubicarte mejor, ${questions}`
        : `${inventorySnippet} To point you in the right direction, ${questions}`;
  }

  if (transform === "more-persuasive") {
    text =
      language === "es"
        ? `Gracias por escribirnos. ${inventorySnippet} Nuestro equipo puede ayudarte a aterrizar la mejor zona y tipo de propiedad sin perder tiempo viendo opciones que no encajan. Para empezar bien, ${questions}`
        : `Thanks for reaching out. ${inventorySnippet} Our team can help you narrow the right zone and product quickly without wasting time on misaligned options. To start in the right place, ${questions}`;
  }

  if (transform === "more-premium") {
    text =
      language === "es"
        ? `Gracias por escribirnos. ${inventorySnippet} Lo ideal es perfilar primero tu objetivo para luego presentarte una seleccion realmente curada. Para hacerlo bien desde el inicio, ${questions}`
        : `Thanks for reaching out. ${inventorySnippet} The best approach is to profile your goal first so we can present a genuinely curated shortlist afterward. To do that well from the start, ${questions}`;
  }

  if (transform === "more-direct") {
    text =
      language === "es"
        ? `${inventorySnippet} Para afinar la busqueda rapido, ${questions}`
        : `${inventorySnippet} To narrow this down quickly, ${questions}`;
  }

  return text;
}

function buildHeuristicSuggestions(
  conversation: ConversationRecord,
  analysis: ConversationAnalysis,
  matches: ListingMatch[],
): ReplySuggestion[] {
  const language = detectDraftLanguage(conversation);
  const clearEnough = hasLeadClarity(analysis);
  const direct = clearEnough
    ? buildQualifiedReply(language, analysis, matches, "more-direct")
    : buildDiscoveryReply(language, conversation, analysis, matches, "more-direct");
  const consultative = clearEnough
    ? buildQualifiedReply(language, analysis, matches, "default")
    : buildDiscoveryReply(language, conversation, analysis, matches, "default");
  const short = clearEnough
    ? buildQualifiedReply(language, analysis, matches, "shorter")
    : buildDiscoveryReply(language, conversation, analysis, matches, "shorter");

  return [
    {
      id: generateId("sug"),
      label: "Direct sales",
      style: "direct-sales",
      editable: true,
      text: direct,
    },
    {
      id: generateId("sug"),
      label: "Consultative",
      style: "consultative",
      editable: true,
      text: consultative,
    },
    {
      id: generateId("sug"),
      label: "WhatsApp short",
      style: "whatsapp-short",
      editable: true,
      text: short,
    },
  ];
}

function buildHeuristicDraft(
  conversation: ConversationRecord,
  analysis: ConversationAnalysis,
  matches: ListingMatch[],
  transform: string,
): DraftReply {
  const language = detectDraftLanguage(conversation);
  const clearEnough = hasLeadClarity(analysis);
  const topMatch = matches[0];
  const qualificationGaps = getQualificationGaps(conversation, analysis);

  return {
    text: clearEnough
      ? buildQualifiedReply(language, analysis, matches, transform)
      : buildDiscoveryReply(language, conversation, analysis, matches, transform),
    toneLabel:
      transform === "more-direct"
        ? "Direct"
        : transform === "more-premium"
          ? "Premium consultative"
          : clearEnough
            ? "Sales consultative"
            : "Qualification-led",
    confidence: clearEnough ? 0.86 : 0.72,
    decisionSummary: [
      `Reply language: ${language === "es" ? "Spanish" : "English"}.`,
      clearEnough
        ? `Lead is clear enough to share listings${topMatch ? `, anchored on ${topMatch.title}` : ""}.`
        : `Reply prioritizes qualification before sending listing links.`,
      qualificationGaps.length > 0
        ? `Open qualification gaps: ${qualificationGaps.slice(0, 3).join(", ")}.`
        : "Core buying criteria are already present in the thread.",
      `Recommended next action: ${analysis.recommendedNextAction}`,
    ],
    intent: analysis.intent,
    extractedEntities: analysis.extractedEntities,
    listingMatches: matches,
    suggestions: buildHeuristicSuggestions(conversation, analysis, matches),
    transform,
    source: "heuristic",
    updatedAt: new Date().toISOString(),
  };
}

export async function buildDraftReply(payload: {
  conversation: ConversationRecord;
  analysis: ConversationAnalysis;
  matches: ListingMatch[];
  transform: string;
}) {
  const heuristicDraft = buildHeuristicDraft(
    payload.conversation,
    payload.analysis,
    payload.matches,
    payload.transform,
  );
  const language = detectDraftLanguage(payload.conversation);
  const clearEnough = hasLeadClarity(payload.analysis);
  const qualificationGaps = getQualificationGaps(
    payload.conversation,
    payload.analysis,
  );
  const listingContext = payload.matches.slice(0, 4).map((match) => ({
    title: match.title,
    price: match.priceText || formatCurrency(match.priceValue),
    location: match.location,
    url: match.url,
    whyMatched: match.whyMatched,
  }));

  try {
    const aiResponse = await generateJsonWithOllama<OllamaDraftResponse>({
      system:
        "You are a senior real estate sales assistant writing operator-reviewed WhatsApp replies. Respond only with valid JSON. Do not include markdown. Keep explanations concise and safe for operator review. No hidden reasoning. Match the customer's language: English or Spanish. If the lead is still early, ask at most two focused qualification questions and do not send listing links yet. First understand goal, product type, zone, budget, and context. Once the lead is clear enough, you may share up to two relevant listing URLs. Be warm, concise, and attentive. Avoid bombarding the lead with too much information.",
      prompt: JSON.stringify(
        {
          transform: payload.transform,
          targetLanguage: language,
          leadClarity: clearEnough ? "clear_enough_for_links" : "qualification_first",
          qualificationGaps,
          customer: payload.conversation.customerName,
          latestMessages: payload.conversation.messages.slice(-8).map((message) => ({
            direction: message.direction,
            text: message.text,
          })),
          analysis: {
            intent: payload.analysis.intent,
            leadStage: payload.analysis.leadStage,
            buyerTemperature: payload.analysis.buyerTemperature,
            budgetDetected: payload.analysis.budgetDetected,
            preferredZones: payload.analysis.preferredZones,
            productType: payload.analysis.productType,
            bedrooms: payload.analysis.bedrooms,
            purchaseIntent: payload.analysis.extractedEntities.purchaseIntent,
            nationality: payload.analysis.extractedEntities.nationality,
            objections: payload.analysis.objections,
            recommendedNextAction: payload.analysis.recommendedNextAction,
          },
          listingContext,
          operatorRules: [
            "If the lead is not clearly qualified, ask concise discovery questions first.",
            "Do not send listing links before there is enough clarity.",
            "When early in the conversation, mention the team can guide across zones and inventory ranges without overloading the lead.",
            "When clear enough, include at most two relevant listing URLs and briefly explain why they fit.",
            "Keep the message WhatsApp-ready and human.",
          ],
          expectedSchema: {
            draft: "string",
            toneLabel: "string",
            confidence: "number between 0 and 1",
            decisionSummary: ["array of 2-4 short strings"],
            suggestions: [
              { label: "Direct sales", style: "direct-sales", text: "string" },
              { label: "Consultative", style: "consultative", text: "string" },
              { label: "WhatsApp short", style: "whatsapp-short", text: "string" },
            ],
          },
        },
        null,
        2,
      ),
    });

    return {
      ...heuristicDraft,
      text: aiResponse.draft || heuristicDraft.text,
      toneLabel: aiResponse.toneLabel || heuristicDraft.toneLabel,
      confidence:
        typeof aiResponse.confidence === "number"
          ? Math.max(0, Math.min(1, aiResponse.confidence))
          : heuristicDraft.confidence,
      decisionSummary:
        aiResponse.decisionSummary?.length > 0
          ? aiResponse.decisionSummary.slice(0, 4)
          : heuristicDraft.decisionSummary,
      suggestions:
        aiResponse.suggestions?.length >= 3
          ? aiResponse.suggestions.slice(0, 3).map((suggestion) => ({
              id: generateId("sug"),
              label: suggestion.label,
              style: suggestion.style,
              text: suggestion.text,
              editable: true,
            }))
          : heuristicDraft.suggestions,
      source: "ollama" as const,
      updatedAt: new Date().toISOString(),
    } satisfies DraftReply;
  } catch {
    return heuristicDraft;
  }
}
