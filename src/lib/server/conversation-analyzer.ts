import {
  ConversationAnalysis,
  ConversationMemory,
  ConversationRecord,
  ListingMatch,
  NormalizedListing,
} from "@/lib/types";
import { formatCompactCurrency, parseBudgetText } from "@/lib/utils";

type KeywordPattern = {
  label: string;
  patterns: RegExp[];
};

const FEATURE_PATTERNS: KeywordPattern[] = [
  { label: "ocean view", patterns: [/\bocean view\b/, /\bsea view\b/, /\bvista al mar\b/] },
  { label: "beachfront", patterns: [/\bbeachfront\b/, /\bfrente a la playa\b/] },
  { label: "walk to beach", patterns: [/\bwalk to beach\b/, /\bwalking distance to the beach\b/, /\bcerca de la playa\b/] },
  { label: "gated", patterns: [/\bgated\b/, /\bgated community\b/, /\bcomunidad cerrada\b/] },
  { label: "golf", patterns: [/\bgolf\b/, /\bcampo de golf\b/] },
  { label: "pool", patterns: [/\bpool\b/, /\bpiscina\b/] },
  { label: "rental", patterns: [/\brental\b/, /\brentals\b/, /\balquiler\b/, /\brenta\b/] },
  { label: "investment", patterns: [/\binvestment\b/, /\binvestor\b/, /\binvertir\b/, /\binversion\b/] },
  { label: "marina", patterns: [/\bmarina\b/] },
  { label: "luxury", patterns: [/\bluxury\b/, /\blujo\b/] },
  { label: "financing", patterns: [/\bfinancing\b/, /\bfinance\b/, /\bfinanciamiento\b/, /\bhipoteca\b/] },
  { label: "hoa", patterns: [/\bhoa\b/, /\bcuota de mantenimiento\b/] },
];

const PROPERTY_TYPE_PATTERNS: KeywordPattern[] = [
  { label: "condo", patterns: [/\bcondo\b/, /\bcondominium\b/, /\bapartment\b/, /\bapartamento\b/] },
  { label: "home", patterns: [/\bhome\b/, /\bhouse\b/, /\bcasa\b/, /\bhogar\b/] },
  { label: "villa", patterns: [/\bvilla\b/] },
  { label: "land", patterns: [/\bland\b/, /\blot\b/, /\blote\b/, /\bterreno\b/] },
  { label: "development", patterns: [/\bdevelopment\b/, /\bdesarrollo\b/, /\bproject\b/, /\bproyecto\b/] },
  { label: "commercial", patterns: [/\bcommercial\b/, /\bcomercial\b/, /\bhotel\b/, /\bretail\b/] },
  { label: "townhouse", patterns: [/\btownhouse\b/, /\bduplex\b/] },
];

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collectPatternLabels(text: string, patterns: KeywordPattern[]) {
  return patterns
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(text)))
    .map((entry) => entry.label);
}

function extractBedrooms(text: string) {
  const matches = Array.from(
    text.matchAll(
      /(\d+)\s*(?:bed|beds|bedroom|bedrooms|hab|habitacion|habitaciones|dormitorio|dormitorios|recamara|recamaras)/gi,
    ),
  ).map((match) => Number(match[1]));

  return unique(matches.filter(Number.isFinite));
}

function extractBathrooms(text: string) {
  const matches = Array.from(
    text.matchAll(
      /(\d+(?:\.\d+)?)\s*(?:bath|baths|bathroom|bathrooms|bano|banos|baño|baños)/gi,
    ),
  ).map((match) => Number(match[1]));

  return unique(matches.filter(Number.isFinite));
}

function extractPropertyTypes(text: string) {
  return collectPatternLabels(text, PROPERTY_TYPE_PATTERNS);
}

function extractFeatures(text: string) {
  return collectPatternLabels(text, FEATURE_PATTERNS);
}

function extractNationality(text: string) {
  const patterns = [
    /\bfrom\s+([a-z][a-z\s]{2,40})/i,
    /\brelocating from\s+([a-z][a-z\s]{2,40})/i,
    /\bi live in\s+([a-z][a-z\s]{2,40})/i,
    /\bsoy de\s+([a-z][a-z\s]{2,40})/i,
    /\bvivo en\s+([a-z][a-z\s]{2,40})/i,
    /\bme mud[oó] de\s+([a-z][a-z\s]{2,40})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1]
        .trim()
        .replace(/\s{2,}/g, " ")
        .replace(/[.,!?;:]+$/, "");
      return cleaned
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  }

  return undefined;
}

function extractTimeHorizon(text: string) {
  if (/\b(asap|right away|immediately|urgent)\b/.test(text)) return "Immediate";
  if (/\b(next week|this week|next thursday|next friday)\b/.test(text)) {
    return "Within 1 week";
  }
  if (/\b(next month|within a month)\b/.test(text)) return "Within 1 month";
  if (/\b(this year|within 6 months)\b/.test(text)) return "This year";
  if (/\b(lo antes posible|urgente|de inmediato)\b/.test(text)) return "Immediate";
  if (/\b(la proxima semana|esta semana)\b/.test(text)) return "Within 1 week";
  if (/\b(el proximo mes|en un mes)\b/.test(text)) return "Within 1 month";
  if (/\b(este ano|este a[oñ]o|en 2026|en 2027)\b/.test(text)) return "This year";
  return undefined;
}

function extractObjections(text: string) {
  const objections = [];

  if (/\b(financing|finance|loan|mortgage|financiamiento|hipoteca)\b/.test(text)) {
    objections.push("Financing uncertainty");
  }
  if (/\bhoa\b|\bcuota de mantenimiento\b/.test(text)) {
    objections.push("HOA sensitivity");
  }
  if (/\btoo expensive\b|\bvery expensive\b|\bmuy caro\b|\bse sale del presupuesto\b/.test(text)) {
    objections.push("Price resistance");
  }
  if (/\bnot sure\b|\bstill figuring out\b|\bno estoy seguro\b|\bestoy viendo opciones\b/.test(text)) {
    objections.push("Decision uncertainty");
  }
  if (/\broi\b|\byield\b|\breturn\b|\bretorno\b|\brentabilidad\b/.test(text)) {
    objections.push("Return-on-investment validation");
  }
  if (/\brental\b|\balquiler\b|\brenta\b/.test(text)) {
    objections.push("Rental performance validation");
  }

  return unique(objections);
}

function detectZones(text: string, listings: NormalizedListing[]) {
  const knownZones = unique(
    listings
      .flatMap((listing) => [listing.neighborhood, listing.location])
      .filter(Boolean)
      .map((value) => value!)
      .flatMap((value) =>
        value
          .split(/[,/]/)
          .map((part) => part.trim())
          .filter((part) => part.length > 2),
      ),
  );

  const normalizedText = normalizeText(text);

  return knownZones
    .filter((zone) => normalizedText.includes(normalizeText(zone)))
    .slice(0, 5);
}

function classifyMessageType(lastInboundText: string) {
  if (
    /\b(visit|tour|availability|showing|see it|schedule)\b/.test(lastInboundText) ||
    /\b(visita|tour|disponibilidad|agendar|coordinar)\b/.test(lastInboundText)
  ) {
    return "Visit coordination";
  }

  if (
    /\b(roi|yield|appreciation|invest|investment)\b/.test(lastInboundText) ||
    /\b(retorno|rentabilidad|inversion|invertir)\b/.test(lastInboundText)
  ) {
    return "Investment qualification";
  }

  if (
    /\b(budget|usd|million|financing|loan|mortgage)\b/.test(lastInboundText) ||
    /\b(presupuesto|dolares|dolares|millones|financiamiento|hipoteca)\b/.test(
      lastInboundText,
    )
  ) {
    return "Budget qualification";
  }

  if (
    /\b(too expensive|hoa|fees|not sure)\b/.test(lastInboundText) ||
    /\b(muy caro|cuota|mantenimiento|no estoy seguro)\b/.test(lastInboundText)
  ) {
    return "Objection handling";
  }

  if (
    /\b(offer|reserve|contract|next steps)\b/.test(lastInboundText) ||
    /\b(oferta|reservar|contrato|siguientes pasos)\b/.test(lastInboundText)
  ) {
    return "Closing intent";
  }

  if (
    /\b(follow up|checking in|just following up)\b/.test(lastInboundText) ||
    /\b(seguimiento|solo queria saber|queria retomar)\b/.test(lastInboundText)
  ) {
    return "Follow-up";
  }

  if (
    /\b(looking for|interested in|want something)\b/.test(lastInboundText) ||
    /\b(busco|estoy buscando|me interesa|quiero algo)\b/.test(lastInboundText)
  ) {
    return "Property request";
  }

  return "First inquiry";
}

function classifyIntent(lastInboundText: string) {
  if (
    /\b(visit|tour|availability|schedule)\b/.test(lastInboundText) ||
    /\b(visita|disponibilidad|agendar)\b/.test(lastInboundText)
  ) {
    return "Schedule viewings";
  }

  if (
    /\b(roi|yield|appreciation|invest)\b/.test(lastInboundText) ||
    /\b(retorno|rentabilidad|invertir|inversion)\b/.test(lastInboundText)
  ) {
    return "Evaluate investment potential";
  }

  if (
    /\b(financing|loan|mortgage)\b/.test(lastInboundText) ||
    /\b(financiamiento|hipoteca)\b/.test(lastInboundText)
  ) {
    return "Understand financing pathways";
  }

  if (
    /\b(beachfront|ocean view|flamingo|tamarindo|pinilla)\b/.test(lastInboundText) ||
    /\b(frente a la playa|vista al mar|flamingo|tamarindo|pinilla)\b/.test(
      lastInboundText,
    )
  ) {
    return "Find matched listings";
  }

  return "Start qualification";
}

function classifyStage(messageType: string, hasBudget: boolean, zones: string[]) {
  if (messageType === "Closing intent") return "Closing";
  if (messageType === "Visit coordination") return "Viewing";
  if (messageType === "Objection handling") return "Consideration";
  if (hasBudget && zones.length > 0) return "Qualified";
  if (messageType === "Budget qualification") return "Qualification";
  return "Discovery";
}

function classifyTemperature(
  lastInboundText: string,
  hasBudget: boolean,
  zones: string[],
  bedrooms: number[],
) {
  let score = 0;

  if (hasBudget) score += 30;
  if (zones.length > 0) score += 25;
  if (bedrooms.length > 0) score += 15;
  if (
    /\b(visit|tour|availability|next thursday|next friday|asap)\b/.test(lastInboundText) ||
    /\b(visita|disponibilidad|esta semana|la proxima semana|lo antes posible)\b/.test(
      lastInboundText,
    )
  ) {
    score += 20;
  }
  if (
    /\b(maybe|not sure|still figuring out)\b/.test(lastInboundText) ||
    /\b(tal vez|no estoy seguro|estoy viendo)\b/.test(lastInboundText)
  ) {
    score -= 15;
  }

  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Exploratory";
}

function classifySentiment(lastInboundText: string) {
  if (/\b(great|love|perfect|excellent|ideal)\b/.test(lastInboundText)) {
    return "Positive";
  }
  if (/\b(genial|me encanta|perfecto|ideal)\b/.test(lastInboundText)) {
    return "Positive";
  }
  if (
    /\b(concern|not sure|worried|too expensive)\b/.test(lastInboundText) ||
    /\b(preocupado|no estoy seguro|muy caro)\b/.test(lastInboundText)
  ) {
    return "Guarded";
  }
  return "Neutral";
}

function classifyPurchaseIntent(text: string) {
  const wantsInvestment =
    /\b(roi|yield|appreciation|invest|investment|rental income)\b/.test(text) ||
    /\b(retorno|rentabilidad|invertir|inversion|ingreso por renta)\b/.test(text);
  const wantsLifestyle =
    /\b(live in|relocate|family home|primary home|vacation home)\b/.test(text) ||
    /\b(vivir|mudarme|familia|casa de vacaciones|uso personal)\b/.test(text);

  if (wantsInvestment && wantsLifestyle) return "Lifestyle + investment";
  if (wantsInvestment) return "Investment";
  if (wantsLifestyle) return "Lifestyle purchase";
  return undefined;
}

function buildRecommendedNextAction(
  messageType: string,
  stage: string,
  purchaseIntent?: string,
) {
  if (messageType === "Visit coordination") {
    return "Shortlist 3 tour-ready listings and confirm availability windows.";
  }
  if (messageType === "Investment qualification") {
    return "Respond with ROI framing plus 2 inventory options with rental relevance.";
  }
  if (messageType === "Budget qualification") {
    return "Confirm budget ceiling, property type preference, and ideal zone.";
  }
  if (stage === "Qualified") {
    return "Send matched listings with one qualifying question to move toward a call.";
  }
  if (!purchaseIntent) {
    return "Clarify whether the lead is buying for lifestyle, investment, or both.";
  }
  return "Ask one crisp qualification question and anchor with curated inventory.";
}

function buildConversationMemory(
  conversation: ConversationRecord,
  stage: string,
  zones: string[],
  propertyTypes: string[],
  bedrooms: number[],
  objections: string[],
  purchaseIntent: string | undefined,
  matches: ListingMatch[],
): ConversationMemory {
  const preferences = [
    ...zones,
    ...propertyTypes,
    ...bedrooms.map((bedroom) => `${bedroom} bedrooms`),
    purchaseIntent,
  ].filter(Boolean) as string[];

  const focusSummary =
    preferences.length > 0
      ? `Lead is focused on ${unique(preferences).slice(0, 4).join(", ")} and is currently in ${stage.toLowerCase()} stage.`
      : `Lead is in ${stage.toLowerCase()} stage and still needs sharper qualification.`;

  return {
    preferences: unique(preferences).slice(0, 6),
    lastListings: matches.slice(0, 3).map((match) => match.title),
    objections,
    funnelStage: stage,
    summary: focusSummary,
  };
}

export function analyzeConversation(
  conversation: ConversationRecord,
  listings: NormalizedListing[],
  matches: ListingMatch[] = [],
): ConversationAnalysis {
  const transcript = conversation.messages
    .map((message) => `${message.direction}: ${message.text}`)
    .join("\n");
  const normalizedTranscript = normalizeText(transcript);
  const lastInbound = [...conversation.messages]
    .reverse()
    .find((message) => message.direction === "inbound");
  const lastInboundText = normalizeText(lastInbound?.text || "");

  const budgetAmount = parseBudgetText(transcript);
  const zones = detectZones(transcript, listings);
  const propertyTypes = extractPropertyTypes(normalizedTranscript);
  const bedrooms = extractBedrooms(transcript);
  const bathrooms = extractBathrooms(transcript);
  const features = extractFeatures(normalizedTranscript);
  const objections = extractObjections(normalizedTranscript);
  const nationality = extractNationality(transcript);
  const timeHorizon = extractTimeHorizon(normalizedTranscript);
  const purchaseIntent = classifyPurchaseIntent(normalizedTranscript);

  const messageType = classifyMessageType(lastInboundText);
  const intent =
    zones.length > 0 ||
    propertyTypes.length > 0 ||
    bedrooms.length > 0 ||
    Boolean(budgetAmount)
      ? "Find matched listings"
      : classifyIntent(lastInboundText);
  const leadStage = classifyStage(messageType, Boolean(budgetAmount), zones);
  const buyerTemperature = classifyTemperature(
    lastInboundText,
    Boolean(budgetAmount),
    zones,
    bedrooms,
  );
  const sentiment = classifySentiment(lastInboundText);
  const seriousnessProbability =
    buyerTemperature === "Hot"
      ? 0.84
      : buyerTemperature === "Warm"
        ? 0.63
        : 0.36;

  const memory = buildConversationMemory(
    conversation,
    leadStage,
    zones,
    propertyTypes,
    bedrooms,
    objections,
    purchaseIntent,
    matches,
  );

  return {
    messageType,
    intent,
    leadStage,
    buyerTemperature,
    budgetDetected: budgetAmount ? formatCompactCurrency(budgetAmount) : "Not yet qualified",
    preferredZones: zones,
    productType: propertyTypes,
    bedrooms,
    timeHorizon,
    objections,
    recommendedNextAction: buildRecommendedNextAction(
      messageType,
      leadStage,
      purchaseIntent,
    ),
    followUpNeeded: Boolean(lastInbound),
    sentiment,
    seriousnessProbability,
    extractedEntities: {
      area: zones,
      budget: budgetAmount
        ? {
            amount: budgetAmount,
            raw: formatCompactCurrency(budgetAmount),
            currency: "USD",
          }
        : undefined,
      propertyType: propertyTypes,
      bedrooms,
      bathrooms,
      urgency:
        buyerTemperature === "Hot"
          ? "High"
          : buyerTemperature === "Warm"
            ? "Medium"
            : "Low",
      nationality,
      purchaseIntent,
      timeHorizon,
      features,
      objections,
    },
    conversationMemory: memory,
  };
}
