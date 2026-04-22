export type AppMode = "demo" | "live";

export type DeliveryState =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "manual"
  | "failed";

export type MessageKind =
  | "text"
  | "image"
  | "document"
  | "voice"
  | "location";

export type SuggestionStyle =
  | "direct-sales"
  | "consultative"
  | "whatsapp-short";

export interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  text: string;
  timestamp: string;
  kind: MessageKind;
  status?: DeliveryState;
  source: "customer" | "operator" | "ai-draft" | "ai-suggestion" | "webhook";
  authorLabel: string;
  meta?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  customerName: string;
  phone: string;
  avatarColor: string;
  mode: AppMode;
  assignee: string;
  unreadCount: number;
  lastActivityAt: string;
  lastMessagePreview: string;
  latestInboundAt?: string;
}

export interface ReplySuggestion {
  id: string;
  label: string;
  style: SuggestionStyle;
  text: string;
  editable: boolean;
}

export interface ExtractedEntities {
  area: string[];
  budget?: {
    amount: number;
    raw: string;
    currency: "USD";
    flexibility?: "strict" | "flexible";
  };
  propertyType: string[];
  bedrooms: number[];
  bathrooms: number[];
  urgency?: string;
  nationality?: string;
  purchaseIntent?: string;
  timeHorizon?: string;
  features: string[];
  objections: string[];
}

export interface ConversationMemory {
  preferences: string[];
  lastListings: string[];
  objections: string[];
  funnelStage: string;
  summary: string;
}

export interface ConversationAnalysis {
  messageType: string;
  intent: string;
  leadStage: string;
  buyerTemperature: string;
  budgetDetected: string;
  preferredZones: string[];
  productType: string[];
  bedrooms: number[];
  timeHorizon?: string;
  objections: string[];
  recommendedNextAction: string;
  followUpNeeded: boolean;
  sentiment: string;
  seriousnessProbability: number;
  extractedEntities: ExtractedEntities;
  conversationMemory: ConversationMemory;
}

export interface NormalizedListing {
  id: string;
  title: string;
  location: string;
  neighborhood?: string;
  listingNumber?: string;
  priceText?: string;
  priceValue?: number;
  status?: string;
  propertyType?: string;
  beds?: number;
  baths?: number;
  sizeText?: string;
  sizeValue?: number;
  lotSizeText?: string;
  lotSizeValue?: number;
  headline?: string;
  description?: string;
  thumbnailUrl?: string;
  secondaryImageUrl?: string;
  url?: string;
  searchableText: string;
  raw: Record<string, string>;
}

export interface ListingMatch {
  id: string;
  title: string;
  location: string;
  neighborhood?: string;
  propertyType?: string;
  status?: string;
  priceText?: string;
  priceValue?: number;
  beds?: number;
  baths?: number;
  sizeText?: string;
  thumbnailUrl?: string;
  url?: string;
  whyMatched: string[];
  keyAttributes: string[];
  score: number;
}

export interface DraftReply {
  text: string;
  toneLabel: string;
  confidence: number;
  decisionSummary: string[];
  intent: string;
  extractedEntities: ExtractedEntities;
  listingMatches: ListingMatch[];
  suggestions: ReplySuggestion[];
  transform: string;
  source: "ollama" | "heuristic";
  updatedAt: string;
}

export interface ConversationRecord {
  id: string;
  customerName: string;
  phone: string;
  avatarColor: string;
  mode: AppMode;
  assignee: string;
  unreadCount: number;
  lastActivityAt: string;
  leadSource: string;
  messages: ConversationMessage[];
  draft?: DraftReply;
}

export interface InventorySnapshot {
  status: "ready" | "error";
  path: string;
  count: number;
  headers: string[];
  normalizedFields: string[];
  loadedAt?: string;
  error?: string;
  listings: NormalizedListing[];
}

export interface DashboardResponse {
  mode: AppMode;
  inventory: Omit<InventorySnapshot, "listings">;
  conversations: ConversationSummary[];
  ollama: {
    baseUrl: string;
    model: string;
  };
  whatsapp: {
    webhookEndpoint: string;
    apiConfigured: boolean;
    phoneNumberIdConfigured: boolean;
    businessAccountIdConfigured: boolean;
    appIdConfigured: boolean;
    appSecretConfigured: boolean;
    graphApiVersion: string;
    externalWebhookUrl: string;
    localSecretsJsonPath: string;
  };
  webhookEndpoint: string;
}

export interface ConversationInsightsResponse {
  mode: AppMode;
  conversation: ConversationRecord;
  analysis: ConversationAnalysis;
  matches: ListingMatch[];
  inventory: Omit<InventorySnapshot, "listings">;
}
