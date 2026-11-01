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


export interface CursorEvent {
  x: number;
  y: number;
  action: "move" | "click" | "scroll" | "type";
  label?: string;
  timestamp: number;
}

export interface ScreencastFrame {
  frame: string; // base64 JPEG
  timestamp: number;
  url: string;
  title: string;
  status: "idle" | "navigating" | "evaluating" | "extracting" | "ready" | "error";
  fps: number;
  cursor?: CursorEvent;
  metadata?: {
    offsetTop?: number;
    pageScaleFactor?: number;
    deviceWidth?: number;
    deviceHeight?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
  };
}

export interface BrowserSessionStatus {
  isActive: boolean;
  currentUrl: string;
  currentTitle: string;
  activeService?: string;
  status: "idle" | "navigating" | "evaluating" | "extracting" | "ready" | "error";
  fps: number;
  totalFrames: number;
  lastFrameTimestamp: number;
  lastExtractedPrice?: number;
}

export interface HelperBotSession {
  id: string;
  service: string;
  url: string;
  title: string;
  status: "idle" | "navigating" | "evaluating" | "extracting" | "ready" | "error";
  currentFrame?: string;
  cursor?: CursorEvent;
  extractedResult?: ScrapedPriceResult;
  fps: number;
  totalFrames: number;
  startedAt: number;
  finishedAt?: number;
}

export interface ParallelVerificationResult {
  batchId: string;
  startedAt: string;
  completedAt: string;
  bots: HelperBotSession[];
  bestDeal?: {
    service: string;
    price: number;
    currency: string;
    planName: string;
    savingsVsHighest: number;
  };
}

export interface CalmPlanTier {
  id: string;
  name: string;
  headline: string;
  price: number;
  currency: string;
  billingPeriod: "monthly" | "annually" | "usage" | "one_time";
  normalizedMonthlyPrice: number;
  transparentLabel: string;
  trapAlerts: string[];
  cleanFeatures: string[];
  recommended?: boolean;
  recommendationReason?: string;
  rawMarketingTrapSnippet?: string;
}

export interface CalmPricingResult {
  service: string;
  url: string;
  pageTitle: string;
  category: "Streaming" | "Developer Tools" | "Cloud & Infrastructure" | "SaaS & AI";
  simplifierSummary: string;
  darkPatternsStrippedCount: number;
  hiddenFeesUncovered: string[];
  rawPageComplexityScore: number; // e.g. 85/100
  calmScore: number; // e.g. 98/100
  plans: CalmPlanTier[];
  analyzedAt: string;
}


