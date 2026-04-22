export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatCurrency(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Price on request";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function relativeTime(timestamp: string) {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = then - now;
  const diffMinutes = Math.round(diffMs / 60000);

  if (Math.abs(diffMinutes) < 1) return "just now";
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      diffMinutes,
      "minute",
    );
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      diffHours,
      "hour",
    );
  }

  const diffDays = Math.round(diffHours / 24);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    diffDays,
    "day",
  );
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseNumericValue(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseBudgetText(input: string) {
  const matches = Array.from(
    input.matchAll(
      /(?:\$|usd\s*)?(\d{1,3}(?:[,\d]{0,9})?(?:\.\d+)?)(?:\s*)(k|m|million)?/gi,
    ),
  );

  const parsedCandidates = matches
    .map((match) => {
      const rawAmount = Number(match[1].replace(/,/g, ""));
      const unit = match[2]?.toLowerCase();

      if (!Number.isFinite(rawAmount)) return undefined;

      let amount = rawAmount;
      if (unit === "k") amount = rawAmount * 1_000;
      if (unit === "m" || unit === "million") amount = rawAmount * 1_000_000;

      return amount >= 50_000 ? amount : undefined;
    })
    .filter((value): value is number => typeof value === "number");

  if (parsedCandidates.length === 0) return undefined;

  return Math.max(...parsedCandidates);
}

export function generateId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
