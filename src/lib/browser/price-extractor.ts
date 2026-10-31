/**
 * Financial Price & Currency Extractor for Web Pages
 */

export interface ExtractedPriceInfo {
  price: number;
  currency: string;
  billingPeriod: string;
  rawMatched: string;
}

const CURRENCY_MAP: Record<string, string> = {
  "$": "USD",
  "USD": "USD",
  "€": "EUR",
  "EUR": "EUR",
  "£": "GBP",
  "GBP": "GBP",
  "¥": "JPY",
  "CAD": "CAD",
  "AUD": "AUD",
};

/**
 * Extracts numeric price, currency symbol, and recurrence interval from text
 */
export function extractPriceFromText(text: string): ExtractedPriceInfo | null {
  if (!text) return null;

  // Patterns matching $15.49, $15.99/mo, 15.99 USD, $11.99 per month, etc.
  const priceRegex =
    /(?:(\$|€|£|USD|EUR|GBP)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(USD|EUR|GBP|\$|€|£))/i;

  const match = text.match(priceRegex);
  if (!match) return null;

  let currencySymbol = match[1] || match[4] || "$";
  const amountStr = match[2] || match[3];

  const price = parseFloat(amountStr);
  if (isNaN(price) || price <= 0) return null;

  currencySymbol = currencySymbol.toUpperCase();
  const currency = CURRENCY_MAP[currencySymbol] || "USD";

  // Detect billing frequency
  let billingPeriod = "monthly";
  const lower = text.toLowerCase();
  if (lower.includes("year") || lower.includes("/yr") || lower.includes("annual")) {
    billingPeriod = "annually";
  } else if (lower.includes("week") || lower.includes("/wk")) {
    billingPeriod = "weekly";
  } else if (lower.includes("day") || lower.includes("/day")) {
    billingPeriod = "daily";
  }

  return {
    price,
    currency,
    billingPeriod,
    rawMatched: match[0],
  };
}
