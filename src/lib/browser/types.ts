export interface ScrapedPriceResult {
  service: string;
  url?: string;
  planName: string;
  price: number;
  currency: string;
  billingPeriod: string;
  extractedAt: string;
  source: "live_browser" | "cache_fallback";
  confidence: number;
  rawText?: string;
}

export interface BrowserScrapeOptions {
  headless?: boolean;
  timeoutMs?: number;
  serviceUrl?: string;
}

export interface MerchantPricingProfile {
  name: string;
  defaultUrl: string;
  planName: string;
  baselinePrice: number;
  currency: string;
  billingPeriod: string;
  priceSelectors: string[];
}
