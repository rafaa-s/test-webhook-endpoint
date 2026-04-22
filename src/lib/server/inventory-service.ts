import fs from "node:fs/promises";

import Papa from "papaparse";

import { appConfig } from "@/lib/config";
import { InventorySnapshot, ListingMatch, NormalizedListing } from "@/lib/types";
import { formatCurrency, parseNumericValue, parseBudgetText, slugify } from "@/lib/utils";

type RawListingRow = Record<string, string>;

type InventoryCache = {
  path: string;
  mtimeMs: number;
  snapshot: InventorySnapshot;
};

const GLOBAL_KEY = "__WA_SALES_INVENTORY_CACHE__";

function getGlobalCache() {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: InventoryCache;
  };

  return globalObject;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickColumn(
  row: RawListingRow,
  headers: string[],
  candidates: string[],
): string | undefined {
  const normalizedMap = new Map(
    headers.map((header) => [normalizeHeader(header), header] as const),
  );

  for (const candidate of candidates) {
    const direct = normalizedMap.get(normalizeHeader(candidate));
    if (direct && row[direct]) return row[direct];
  }

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (candidates.some((candidate) => normalized.includes(normalizeHeader(candidate)))) {
      const value = row[header];
      if (value) return value;
    }
  }

  return undefined;
}

function normalizeListing(row: RawListingRow, headers: string[]): NormalizedListing {
  const title =
    pickColumn(row, headers, ["title", "listing title", "name"]) || "Untitled Listing";
  const listingNumber = pickColumn(row, headers, [
    "listing number",
    "listing_number",
    "mls",
    "reference",
  ]);
  const location = pickColumn(row, headers, ["location", "address", "zone"]) || "Costa Rica";
  const neighborhood = pickColumn(row, headers, ["neighborhood", "community", "area"]);
  const priceText = pickColumn(row, headers, ["price text", "price", "ask price"]);
  const propertyType =
    pickColumn(row, headers, ["property type", "details property type", "type"]) || undefined;
  const status =
    pickColumn(row, headers, ["status", "details status", "availability"]) || undefined;
  const beds = parseNumericValue(
    pickColumn(row, headers, ["beds value", "beds", "bedrooms"]),
  );
  const baths = parseNumericValue(
    pickColumn(row, headers, ["baths value", "baths", "bathrooms"]),
  );
  const sizeText = pickColumn(row, headers, ["size text", "living area"]);
  const sizeValue = parseNumericValue(
    pickColumn(row, headers, ["size value", "size", "appx living area value"]),
  );
  const lotSizeText = pickColumn(row, headers, ["lot size text", "lot size"]);
  const lotSizeValue = parseNumericValue(
    pickColumn(row, headers, ["lot size value", "lot size"]),
  );
  const headline = pickColumn(row, headers, ["about headline", "headline"]);
  const description =
    pickColumn(row, headers, ["about text", "description", "about"]) || "";
  const thumbnailUrl = pickColumn(row, headers, ["photo 1 url", "image", "thumbnail"]);
  const secondaryImageUrl = pickColumn(row, headers, ["photo 2 url"]);
  const url = pickColumn(row, headers, ["url", "link"]);
  const priceValue =
    parseNumericValue(pickColumn(row, headers, ["price value", "price"])) ||
    parseBudgetText(priceText || "");

  const searchableText = [
    title,
    location,
    neighborhood,
    listingNumber,
    propertyType,
    status,
    headline,
    description,
    sizeText,
    lotSizeText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    id: listingNumber || slugify(`${title}-${location}`),
    title,
    location,
    neighborhood,
    listingNumber,
    priceText: priceText || (priceValue ? formatCurrency(priceValue) : undefined),
    priceValue,
    status,
    propertyType,
    beds,
    baths,
    sizeText,
    sizeValue,
    lotSizeText,
    lotSizeValue,
    headline,
    description,
    thumbnailUrl,
    secondaryImageUrl,
    url,
    searchableText,
    raw: row,
  };
}

function toListingMatch(listing: NormalizedListing, score: number, whyMatched: string[]): ListingMatch {
  const keyAttributes = [
    listing.propertyType,
    listing.beds ? `${listing.beds} bd` : undefined,
    listing.baths ? `${listing.baths} ba` : undefined,
    listing.sizeText,
    listing.status,
  ].filter(Boolean) as string[];

  return {
    id: listing.id,
    title: listing.title,
    location: listing.location,
    neighborhood: listing.neighborhood,
    propertyType: listing.propertyType,
    status: listing.status,
    priceText: listing.priceText,
    priceValue: listing.priceValue,
    beds: listing.beds,
    baths: listing.baths,
    sizeText: listing.sizeText,
    thumbnailUrl: listing.thumbnailUrl,
    url: listing.url,
    whyMatched,
    keyAttributes,
    score,
  };
}

export async function getInventorySnapshot(): Promise<InventorySnapshot> {
  const cacheContainer = getGlobalCache();
  const path = appConfig.inventoryCsvPath;

  try {
    const stats = await fs.stat(path);
    const cached = cacheContainer[GLOBAL_KEY];

    if (cached && cached.path === path && cached.mtimeMs === stats.mtimeMs) {
      return cached.snapshot;
    }

    const csv = await fs.readFile(path, "utf8");
    const parsed = Papa.parse<RawListingRow>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const headers = parsed.meta.fields || [];
    const listings = parsed.data.map((row) => normalizeListing(row, headers));

    const snapshot: InventorySnapshot = {
      status: "ready",
      path,
      count: listings.length,
      headers,
      normalizedFields: [
        "id",
        "title",
        "location",
        "neighborhood",
        "listingNumber",
        "priceValue",
        "beds",
        "baths",
        "propertyType",
        "status",
        "thumbnailUrl",
        "description",
      ],
      loadedAt: new Date().toISOString(),
      listings,
    };

    cacheContainer[GLOBAL_KEY] = {
      path,
      mtimeMs: stats.mtimeMs,
      snapshot,
    };

    return snapshot;
  } catch (error) {
    return {
      status: "error",
      path,
      count: 0,
      headers: [],
      normalizedFields: [],
      error:
        error instanceof Error
          ? error.message
          : "Unknown inventory loading error.",
      listings: [],
    };
  }
}

function hasKeyword(listing: NormalizedListing, keyword: string) {
  return listing.searchableText.includes(keyword.toLowerCase());
}

type MatchInput = {
  area: string[];
  propertyType: string[];
  bedrooms: number[];
  features: string[];
  budgetAmount?: number;
  recentText: string;
};

export function rankListings(
  listings: NormalizedListing[],
  input: MatchInput,
  limit = 5,
) {
  const textTokens = input.recentText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);

  const scored = listings.map((listing) => {
    let score = 0;
    const whyMatched: string[] = [];

    if ((listing.status || "").toLowerCase().includes("active")) {
      score += 4;
    }

    for (const area of input.area) {
      if (hasKeyword(listing, area)) {
        score += 24;
        whyMatched.push(`matched on ${area}`);
      }
    }

    for (const propertyType of input.propertyType) {
      if (hasKeyword(listing, propertyType)) {
        score += 18;
        whyMatched.push(`property type ${propertyType}`);
      }
    }

    for (const feature of input.features) {
      if (hasKeyword(listing, feature)) {
        score += 12;
        whyMatched.push(`feature ${feature}`);
      }
    }

    if (input.bedrooms.length > 0 && typeof listing.beds === "number") {
      const bestGap = Math.min(...input.bedrooms.map((bedroom) => Math.abs(bedroom - listing.beds!)));
      if (bestGap === 0) {
        score += 16;
        whyMatched.push(`${listing.beds} bedrooms`);
      } else if (bestGap === 1) {
        score += 8;
        whyMatched.push(`bedroom proximity`);
      }
    }

    if (input.budgetAmount && listing.priceValue) {
      const delta = Math.abs(listing.priceValue - input.budgetAmount) / input.budgetAmount;
      if (delta <= 0.15) {
        score += 18;
        whyMatched.push("budget proximity");
      } else if (delta <= 0.3) {
        score += 9;
        whyMatched.push("near budget range");
      } else if (listing.priceValue < input.budgetAmount) {
        score += 12;
        whyMatched.push("within budget");
      }
    }

    for (const token of textTokens.slice(0, 12)) {
      if (hasKeyword(listing, token)) {
        score += 2;
      }
    }

    return toListingMatch(listing, score, Array.from(new Set(whyMatched)).slice(0, 4));
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
